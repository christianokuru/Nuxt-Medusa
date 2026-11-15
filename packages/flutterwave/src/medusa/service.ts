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
import { createFlutterwave, type FlutterwaveClient, type FlutterwaveTransaction, type PaymentOutcome } from "../index"
import { createReference, headerValue, prefixFromReference } from "../utils"
import { customerEmail, medusaErrors, toNumber } from "./helpers"

export type FlutterwaveProviderOptions = {
  /** Secret key: FLWSECK_TEST-... or FLWSECK-... */
  secretKey: string
  /** The "secret hash" set in Flutterwave's webhook settings. Required for webhooks. */
  webhookHash?: string
  /** Where Flutterwave sends the customer after paying (your store's checkout page). */
  redirectUrl?: string
  /** Name shown on Flutterwave's payment page. */
  storeName?: string
  /** Logo URL shown on Flutterwave's payment page. */
  logoUrl?: string
  /** Limit payment methods, e.g. "card,banktransfer,ussd". */
  paymentOptions?: string
  /** Override the API URL (tests). */
  apiUrl?: string
}

const STATUS: Record<PaymentOutcome, PaymentSessionStatus> = {
  paid: "captured",
  mismatch: "error",
  failed: "error",
  pending: "pending",
}

/**
 * Flutterwave payments for Medusa (Flutterwave Standard, API v3).
 *
 * The store starts a payment session -> we create a Flutterwave payment link. The customer
 * pays there and is sent back to `redirectUrl`. Flutterwave charges right away, so a
 * successful payment is reported as "captured". It is confirmed when the store completes
 * the cart (verified with Flutterwave) or by the webhook (secret hash checked, then verified).
 */
class FlutterwaveProviderService extends AbstractPaymentProvider<FlutterwaveProviderOptions> {
  static identifier = "flutterwave"

  protected options_: FlutterwaveProviderOptions
  protected logger_: Logger
  protected flutterwave_: FlutterwaveClient

  static validateOptions(options: Record<string, unknown>) {
    if (!options?.secretKey || typeof options.secretKey !== "string") {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Flutterwave: the `secretKey` option is required.")
    }
  }

  constructor(container: { logger: Logger }, options: FlutterwaveProviderOptions) {
    super(container, options)
    this.options_ = options
    this.logger_ = container.logger
    this.flutterwave_ = createFlutterwave({ secretKey: options.secretKey, webhookHash: options.webhookHash, apiUrl: options.apiUrl })
  }

  protected txRef(data?: Record<string, unknown>): string {
    const ref = data?.tx_ref
    if (typeof ref !== "string" || !ref) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Flutterwave: payment has no reference.")
    }
    return ref
  }

  protected verify(data: Record<string, unknown>) {
    return medusaErrors(() => this.flutterwave_.verifyByReference(this.txRef(data)))
  }

  protected toSessionStatus(tx: FlutterwaveTransaction | null, data: Record<string, unknown>): PaymentSessionStatus {
    const result = this.flutterwave_.outcome(tx, {
      amount: Number(data.amount) || undefined,
      currency: typeof data.currency === "string" ? data.currency : undefined,
    })
    if (result === "mismatch") {
      this.logger_.warn(`Flutterwave: transaction ${tx?.tx_ref} amount or currency does not match the session.`)
    }
    return STATUS[result]
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const sessionId = String(input.data?.session_id ?? "")
    const email = customerEmail(input.context, input.data)
    if (!email) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Flutterwave needs the customer's email. Add an email to the cart first.")
    }
    const amount = toNumber(input.amount)
    const currency = input.currency_code.toUpperCase()
    const customer = input.context?.customer
    const name = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || undefined

    const { link, tx_ref } = await medusaErrors(() => this.flutterwave_.createPaymentLink({
      txRef: createReference(sessionId || "payses"),
      amount,
      currency,
      redirectUrl: this.options_.redirectUrl,
      customer: { email, name },
      meta: { session_id: sessionId },
      title: this.options_.storeName,
      logo: this.options_.logoUrl,
      paymentOptions: this.options_.paymentOptions,
    }))

    return {
      id: tx_ref,
      status: "pending",
      data: { session_id: sessionId, tx_ref, payment_link: link, amount, currency, email },
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
    const tx = await this.verify(data)
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
      transactionId = (await this.verify(data))?.id
    }
    if (!transactionId) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Flutterwave: no paid transaction to refund.")
    }
    const amount = toNumber(input.amount)
    const refund = await medusaErrors(() => this.flutterwave_.refund(transactionId!, amount))
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
    const tx = await this.verify(data)
    return { status: this.toSessionStatus(tx, data), data }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const data = input.data ?? {}
    const tx = await this.verify(data)
    return { data: { ...data, transaction: tx } }
  }

  async getWebhookActionAndData(payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
    // Secret hash check, charge.completed only, then the real status from Flutterwave's API.
    const hash = headerValue(payload.headers, "verif-hash")
    if (!this.options_.webhookHash) {
      this.logger_.warn("Flutterwave webhook ignored: set the `webhookHash` option to accept webhooks.")
      return { action: PaymentActions.NOT_SUPPORTED }
    }
    if (!this.flutterwave_.verifyWebhookHash(hash)) {
      this.logger_.warn("Flutterwave webhook ignored: invalid verif-hash.")
      return { action: PaymentActions.NOT_SUPPORTED }
    }
    const result = await medusaErrors(() => this.flutterwave_.confirmWebhook(payload.data, hash))
    const sessionId = prefixFromReference(result?.transaction.tx_ref)
    if (!result || !sessionId) {
      return { action: PaymentActions.NOT_SUPPORTED }
    }
    return {
      action: PaymentActions.SUCCESSFUL,
      data: { session_id: sessionId, amount: result.transaction.amount },
    }
  }
}

export default FlutterwaveProviderService
