import { createHmac } from "node:crypto"
import { AbstractPaymentProvider, MedusaError, PaymentActions } from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  Logger,
  PaymentSessionStatus,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import {
  createReference,
  customerEmail,
  fromSubunit,
  headerValue,
  providerError,
  requestJson,
  safeEqual,
  sessionIdFromReference,
  toNumber,
  toSubunit,
} from "../../lib/payments"

export type PaystackOptions = {
  /** Secret key: sk_test_... or sk_live_... */
  secretKey: string
  /** Where Paystack sends the customer after paying (your store's checkout page). */
  callbackUrl?: string
  /** Override the API URL (tests). */
  apiUrl?: string
}

type PaystackTransaction = {
  id: number
  status: "success" | "failed" | "abandoned" | "ongoing" | "pending" | "processing" | "queued" | "reversed"
  reference: string
  amount: number
  currency: string
  paid_at?: string | null
  gateway_response?: string
  metadata?: { session_id?: string } | string | null
}

type PaystackResponse<T> = { status: boolean, message: string, data: T }

const NAME = "Paystack"

/**
 * Paystack payments.
 *
 * Flow: the store starts a payment session -> we create a Paystack transaction and
 * return its `authorization_url` / `access_code`. The customer pays on Paystack's page
 * or popup. Paystack charges right away, so a successful payment is reported as
 * "captured". The payment is confirmed when the store completes the cart (we verify
 * with Paystack) or when Paystack's webhook arrives (signature checked, then verified).
 */
class PaystackProviderService extends AbstractPaymentProvider<PaystackOptions> {
  static identifier = "paystack"

  protected options_: PaystackOptions
  protected logger_: Logger
  protected apiUrl_: string

  static validateOptions(options: Record<string, unknown>) {
    if (!options?.secretKey || typeof options.secretKey !== "string") {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Paystack: the `secretKey` option is required.")
    }
  }

  constructor(container: { logger: Logger }, options: PaystackOptions) {
    super(container, options)
    this.options_ = options
    this.logger_ = container.logger
    this.apiUrl_ = (options.apiUrl ?? "https://api.paystack.co").replace(/\/$/, "")
  }

  // ----- API calls -----

  protected async api<T>(path: string, method = "GET", body?: unknown): Promise<PaystackResponse<T>> {
    const res = await requestJson<PaystackResponse<T>>(NAME, `${this.apiUrl_}${path}`, {
      method,
      body,
      secretKey: this.options_.secretKey,
    })
    if (!res.ok || res.body.status !== true) {
      throw providerError(NAME, res.body.message)
    }
    return res.body
  }

  protected async verify(reference: string): Promise<PaystackTransaction | null> {
    const res = await requestJson<PaystackResponse<PaystackTransaction>>(
      NAME,
      `${this.apiUrl_}/transaction/verify/${encodeURIComponent(reference)}`,
      { secretKey: this.options_.secretKey },
    )
    if (res.status === 404 || (res.body.status === false && /not found/i.test(res.body.message ?? ""))) {
      return null
    }
    if (!res.ok || res.body.status !== true) {
      throw providerError(NAME, res.body.message)
    }
    return res.body.data
  }

  /** Paystack status -> Medusa status, also checking the amount and currency. */
  protected toSessionStatus(tx: PaystackTransaction | null, data: Record<string, unknown>): PaymentSessionStatus {
    if (!tx) {
      return "pending"
    }
    switch (tx.status) {
      case "success": {
        const expected = Number(data.amount_subunit)
        const currency = String(data.currency ?? "").toUpperCase()
        if ((expected && tx.amount < expected) || (currency && tx.currency?.toUpperCase() !== currency)) {
          this.logger_.warn(`Paystack: transaction ${tx.reference} amount or currency does not match the session.`)
          return "error"
        }
        return "captured"
      }
      case "failed":
        return "error"
      case "reversed":
        return "canceled"
      default:
        // abandoned, ongoing, pending, processing, queued: the customer can still pay.
        return "pending"
    }
  }

  protected reference(data?: Record<string, unknown>): string {
    const reference = data?.reference
    if (typeof reference !== "string" || !reference) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Paystack: payment has no reference.")
    }
    return reference
  }

  // ----- Payment provider methods -----

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const sessionId = String(input.data?.session_id ?? "")
    const email = customerEmail(input.context, input.data)
    if (!email) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Paystack needs the customer's email. Add an email to the cart first.")
    }
    const amount = toNumber(input.amount)
    const currency = input.currency_code.toUpperCase()
    const reference = createReference(sessionId || "payses")

    const { data } = await this.api<{ authorization_url: string, access_code: string, reference: string }>(
      "/transaction/initialize",
      "POST",
      {
        email,
        amount: toSubunit(amount),
        currency,
        reference,
        callback_url: this.options_.callbackUrl,
        metadata: { session_id: sessionId },
      },
    )

    return {
      id: data.reference,
      status: "pending",
      data: {
        session_id: sessionId,
        reference: data.reference,
        access_code: data.access_code,
        authorization_url: data.authorization_url,
        amount,
        amount_subunit: toSubunit(amount),
        currency,
        email,
      },
    }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    // Amount or currency changed: start a new Paystack transaction.
    const result = await this.initiatePayment({
      amount: input.amount,
      currency_code: input.currency_code,
      context: input.context,
      data: { ...(input.data ?? {}), session_id: input.data?.session_id },
    })
    return { status: result.status, data: result.data }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const data = input.data ?? {}
    const tx = await this.verify(this.reference(data))
    const status = this.toSessionStatus(tx, data)
    return {
      status,
      data: {
        ...data,
        transaction_id: tx?.id ?? null,
        paystack_status: tx?.status ?? null,
        paid_at: tx?.paid_at ?? null,
      },
    }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    // Paystack charges immediately; nothing more to do.
    return { data: input.data ?? {} }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const data = input.data ?? {}
    const amount = toNumber(input.amount)
    const { data: refund } = await this.api<{ id: number, status: string, amount: number }>("/refund", "POST", {
      transaction: this.reference(data),
      amount: toSubunit(amount),
    })
    const refunds = Array.isArray(data.refunds) ? data.refunds : []
    return {
      data: {
        ...data,
        refunds: [...refunds, { id: refund.id, status: refund.status, amount: fromSubunit(refund.amount ?? toSubunit(amount)) }],
      },
    }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    // Unpaid Paystack transactions simply expire; paid ones need a refund instead.
    return { data: input.data ?? {} }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data ?? {} }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const data = input.data ?? {}
    const tx = await this.verify(this.reference(data))
    return { status: this.toSessionStatus(tx, data), data }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const data = input.data ?? {}
    const tx = await this.verify(this.reference(data))
    return { data: { ...data, transaction: tx } }
  }

  async getWebhookActionAndData(payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
    // 1. Check the signature: HMAC-SHA512 of the raw body with the secret key.
    const signature = headerValue(payload.headers, "x-paystack-signature")
    const raw = typeof payload.rawData === "string" ? payload.rawData : payload.rawData?.toString("utf8")
    if (!signature || !raw) {
      this.logger_.warn("Paystack webhook ignored: missing signature or body.")
      return { action: PaymentActions.NOT_SUPPORTED }
    }
    const expected = createHmac("sha512", this.options_.secretKey).update(raw).digest("hex")
    if (!safeEqual(expected, signature)) {
      this.logger_.warn("Paystack webhook ignored: invalid signature.")
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    // 2. Only successful charges matter here.
    const event = payload.data as { event?: string, data?: { reference?: string } }
    if (event.event !== "charge.success" || !event.data?.reference) {
      return { action: PaymentActions.NOT_SUPPORTED }
    }
    const sessionId = sessionIdFromReference(event.data.reference)
    if (!sessionId) {
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    // 3. Never trust the webhook body alone: ask Paystack for the real status.
    const tx = await this.verify(event.data.reference)
    if (!tx || tx.status !== "success") {
      return { action: PaymentActions.NOT_SUPPORTED }
    }
    return {
      action: PaymentActions.SUCCESSFUL,
      data: { session_id: sessionId, amount: fromSubunit(tx.amount) },
    }
  }
}

export default PaystackProviderService
