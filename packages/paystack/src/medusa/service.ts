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
import { createPaystack, type PaymentOutcome, type PaystackClient, type PaystackTransaction } from "../index"
import { createReference, fromSubunit, headerValue, prefixFromReference, toSubunit } from "../utils"
import { customerEmail, medusaErrors, toNumber } from "./helpers"

export type PaystackProviderOptions = {
  /** Secret key: sk_test_... or sk_live_... */
  secretKey: string
  /** Where Paystack sends the customer after paying (your store's checkout page). */
  callbackUrl?: string
  /** Limit payment methods, e.g. ["card", "bank_transfer"]. */
  channels?: string[]
  /** Override the API URL (tests). */
  apiUrl?: string
}

const STATUS: Record<PaymentOutcome, PaymentSessionStatus> = {
  paid: "captured",
  mismatch: "error",
  failed: "error",
  reversed: "canceled",
  pending: "pending",
}

/**
 * Paystack payments for Medusa.
 *
 * The store starts a payment session -> we create a Paystack transaction and return its
 * `authorization_url` / `access_code`. The customer pays on Paystack's page or popup.
 * Paystack charges right away, so a successful payment is reported as "captured". The
 * payment is confirmed when the store completes the cart (verified with Paystack) or when
 * Paystack's webhook arrives (signature checked, then verified with the API).
 */
class PaystackProviderService extends AbstractPaymentProvider<PaystackProviderOptions> {
  static identifier = "paystack"

  protected options_: PaystackProviderOptions
  protected logger_: Logger
  protected paystack_: PaystackClient

  static validateOptions(options: Record<string, unknown>) {
    if (!options?.secretKey || typeof options.secretKey !== "string") {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Paystack: the `secretKey` option is required.")
    }
  }

  constructor(container: { logger: Logger }, options: PaystackProviderOptions) {
    super(container, options)
    this.options_ = options
    this.logger_ = container.logger
    this.paystack_ = createPaystack({ secretKey: options.secretKey, apiUrl: options.apiUrl })
  }

  protected reference(data?: Record<string, unknown>): string {
    const reference = data?.reference
    if (typeof reference !== "string" || !reference) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Paystack: payment has no reference.")
    }
    return reference
  }

  protected verify(data: Record<string, unknown>) {
    return medusaErrors(() => this.paystack_.verify(this.reference(data)))
  }

  /** Paystack status -> Medusa status, also checking the amount and currency. */
  protected toSessionStatus(tx: PaystackTransaction | null, data: Record<string, unknown>): PaymentSessionStatus {
    const subunit = Number(data.amount_subunit)
    const result = this.paystack_.outcome(tx, {
      amount: subunit ? fromSubunit(subunit) : undefined,
      currency: typeof data.currency === "string" ? data.currency : undefined,
    })
    if (result === "mismatch") {
      this.logger_.warn(`Paystack: transaction ${tx?.reference} amount or currency does not match the session.`)
    }
    return STATUS[result]
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const sessionId = String(input.data?.session_id ?? "")
    const email = customerEmail(input.context, input.data)
    if (!email) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Paystack needs the customer's email. Add an email to the cart first.")
    }
    const amount = toNumber(input.amount)
    const currency = input.currency_code.toUpperCase()

    const data = await medusaErrors(() => this.paystack_.initialize({
      email,
      amount,
      currency,
      reference: createReference(sessionId || "payses"),
      callbackUrl: this.options_.callbackUrl,
      channels: this.options_.channels,
      metadata: { session_id: sessionId },
    }))

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
    const tx = await this.verify(data)
    return {
      status: this.toSessionStatus(tx, data),
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
    const refund = await medusaErrors(() => this.paystack_.refund({ transaction: this.reference(data), amount }))
    const refunds = Array.isArray(data.refunds) ? data.refunds : []
    return {
      data: {
        ...data,
        refunds: [...refunds, { id: refund.id, status: refund.status, amount: refund.amount ? fromSubunit(refund.amount) : amount }],
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
    const tx = await this.verify(data)
    return { status: this.toSessionStatus(tx, data), data }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const data = input.data ?? {}
    const tx = await this.verify(data)
    return { data: { ...data, transaction: tx } }
  }

  async getWebhookActionAndData(payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
    // Signature check, charge.success only, then the real status from Paystack's API.
    const raw = typeof payload.rawData === "string" ? payload.rawData : payload.rawData?.toString("utf8")
    const signature = headerValue(payload.headers, "x-paystack-signature")
    if (!this.paystack_.verifySignature(raw ?? "", signature)) {
      this.logger_.warn("Paystack webhook ignored: missing or invalid signature.")
      return { action: PaymentActions.NOT_SUPPORTED }
    }
    const result = await medusaErrors(() => this.paystack_.confirmWebhook(raw!, signature))
    const sessionId = prefixFromReference(result?.transaction.reference)
    if (!result || !sessionId) {
      return { action: PaymentActions.NOT_SUPPORTED }
    }
    return {
      action: PaymentActions.SUCCESSFUL,
      data: { session_id: sessionId, amount: fromSubunit(result.transaction.amount) },
    }
  }
}

export default PaystackProviderService
