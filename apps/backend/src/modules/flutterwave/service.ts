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
  headerValue,
  providerError,
  requestJson,
  safeEqual,
  sessionIdFromReference,
  toNumber,
} from "../../lib/payments"

export type FlutterwaveOptions = {
  /** Secret key: FLWSECK_TEST-... or FLWSECK-... */
  secretKey: string
  /** The "secret hash" set in Flutterwave's webhook settings. Required for webhooks. */
  webhookHash?: string
  /** Where Flutterwave sends the customer after paying (your store's checkout page). */
  redirectUrl?: string
  /** Name shown on Flutterwave's payment page. */
  storeName?: string
  /** Override the API URL (tests). */
  apiUrl?: string
}

type FlutterwaveTransaction = {
  id: number
  tx_ref: string
  status: "successful" | "failed" | "pending" | string
  amount: number
  currency: string
  created_at?: string
}

type FlutterwaveResponse<T> = { status: "success" | "error", message: string, data: T }

const NAME = "Flutterwave"

/**
 * Flutterwave payments (Flutterwave Standard, API v3).
 *
 * Flow: the store starts a payment session -> we create a Flutterwave payment link.
 * The customer pays there and is sent back to `redirectUrl`. Flutterwave charges right
 * away, so a successful payment is reported as "captured". It is confirmed when the
 * store completes the cart (we verify with Flutterwave) or by the webhook (secret hash
 * checked, then verified with the API).
 */
class FlutterwaveProviderService extends AbstractPaymentProvider<FlutterwaveOptions> {
  static identifier = "flutterwave"

  protected options_: FlutterwaveOptions
  protected logger_: Logger
  protected apiUrl_: string

  static validateOptions(options: Record<string, unknown>) {
    if (!options?.secretKey || typeof options.secretKey !== "string") {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Flutterwave: the `secretKey` option is required.")
    }
  }

  constructor(container: { logger: Logger }, options: FlutterwaveOptions) {
    super(container, options)
    this.options_ = options
    this.logger_ = container.logger
    this.apiUrl_ = (options.apiUrl ?? "https://api.flutterwave.com/v3").replace(/\/$/, "")
  }

  // ----- API calls -----

  protected async api<T>(path: string, method = "GET", body?: unknown): Promise<FlutterwaveResponse<T>> {
    const res = await requestJson<FlutterwaveResponse<T>>(NAME, `${this.apiUrl_}${path}`, {
      method,
      body,
      secretKey: this.options_.secretKey,
    })
    if (!res.ok || res.body.status !== "success") {
      throw providerError(NAME, res.body.message)
    }
    return res.body
  }

  protected async verify(txRef: string): Promise<FlutterwaveTransaction | null> {
    const res = await requestJson<FlutterwaveResponse<FlutterwaveTransaction>>(
      NAME,
      `${this.apiUrl_}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
      { secretKey: this.options_.secretKey },
    )
    // No transaction yet: the customer has not paid.
    if (res.status === 404 || (res.body.status === "error" && /no transaction|not found/i.test(res.body.message ?? ""))) {
      return null
    }
    if (!res.ok || res.body.status !== "success") {
      throw providerError(NAME, res.body.message)
    }
    return res.body.data
  }

  protected toSessionStatus(tx: FlutterwaveTransaction | null, data: Record<string, unknown>): PaymentSessionStatus {
    if (!tx) {
      return "pending"
    }
    if (tx.status === "successful") {
      const expected = Number(data.amount)
      const currency = String(data.currency ?? "").toUpperCase()
      if ((expected && tx.amount < expected) || (currency && tx.currency?.toUpperCase() !== currency)) {
        this.logger_.warn(`Flutterwave: transaction ${tx.tx_ref} amount or currency does not match the session.`)
        return "error"
      }
      return "captured"
    }
    if (tx.status === "failed") {
      return "error"
    }
    return "pending"
  }

  protected txRef(data?: Record<string, unknown>): string {
    const ref = data?.tx_ref
    if (typeof ref !== "string" || !ref) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Flutterwave: payment has no reference.")
    }
    return ref
  }

  // ----- Payment provider methods -----

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const sessionId = String(input.data?.session_id ?? "")
    const email = customerEmail(input.context, input.data)
    if (!email) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Flutterwave needs the customer's email. Add an email to the cart first.")
    }
    const amount = toNumber(input.amount)
    const currency = input.currency_code.toUpperCase()
    const txRef = createReference(sessionId || "payses")
    const customer = input.context?.customer
    const name = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || undefined

    const { data } = await this.api<{ link: string }>("/payments", "POST", {
      tx_ref: txRef,
      amount,
      currency,
      redirect_url: this.options_.redirectUrl,
      customer: { email, name },
      meta: { session_id: sessionId },
      customizations: this.options_.storeName ? { title: this.options_.storeName } : undefined,
    })

    return {
      id: txRef,
      status: "pending",
      data: {
        session_id: sessionId,
        tx_ref: txRef,
        payment_link: data.link,
        amount,
        currency,
        email,
      },
    }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    // Amount or currency changed: create a new payment link.
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
    const tx = await this.verify(this.txRef(data))
    return {
      status: this.toSessionStatus(tx, data),
      data: { ...data, transaction_id: tx?.id ?? null, flutterwave_status: tx?.status ?? null },
    }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    // Flutterwave charges immediately; nothing more to do.
    return { data: input.data ?? {} }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const data = input.data ?? {}
    let transactionId = data.transaction_id as number | null | undefined
    if (!transactionId) {
      transactionId = (await this.verify(this.txRef(data)))?.id
    }
    if (!transactionId) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Flutterwave: no paid transaction to refund.")
    }
    const amount = toNumber(input.amount)
    const { data: refund } = await this.api<{ id: number, status: string, amount_refunded?: number }>(
      `/transactions/${transactionId}/refund`,
      "POST",
      { amount },
    )
    const refunds = Array.isArray(data.refunds) ? data.refunds : []
    return {
      data: {
        ...data,
        transaction_id: transactionId,
        refunds: [...refunds, { id: refund.id, status: refund.status, amount: refund.amount_refunded ?? amount }],
      },
    }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    // Unpaid payment links simply expire; paid ones need a refund instead.
    return { data: input.data ?? {} }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data ?? {} }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const data = input.data ?? {}
    const tx = await this.verify(this.txRef(data))
    return { status: this.toSessionStatus(tx, data), data }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const data = input.data ?? {}
    const tx = await this.verify(this.txRef(data))
    return { data: { ...data, transaction: tx } }
  }

  async getWebhookActionAndData(payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
    // 1. Check the secret hash Flutterwave sends in the `verif-hash` header.
    const hash = headerValue(payload.headers, "verif-hash")
    if (!this.options_.webhookHash) {
      this.logger_.warn("Flutterwave webhook ignored: set the `webhookHash` option to accept webhooks.")
      return { action: PaymentActions.NOT_SUPPORTED }
    }
    if (!hash || !safeEqual(hash, this.options_.webhookHash)) {
      this.logger_.warn("Flutterwave webhook ignored: invalid verif-hash.")
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    // 2. Only completed charges matter here.
    const event = payload.data as { event?: string, data?: { tx_ref?: string } }
    const txRef = event.data?.tx_ref
    if (event.event !== "charge.completed" || !txRef) {
      return { action: PaymentActions.NOT_SUPPORTED }
    }
    const sessionId = sessionIdFromReference(txRef)
    if (!sessionId) {
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    // 3. Never trust the webhook body alone: ask Flutterwave for the real status.
    const tx = await this.verify(txRef)
    if (!tx || tx.status !== "successful") {
      return { action: PaymentActions.NOT_SUPPORTED }
    }
    return {
      action: PaymentActions.SUCCESSFUL,
      data: { session_id: sessionId, amount: tx.amount },
    }
  }
}

export default FlutterwaveProviderService
