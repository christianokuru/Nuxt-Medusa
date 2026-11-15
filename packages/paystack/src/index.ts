import { createHmac } from "node:crypto"
import { ProviderError, requestJson, safeEqual, toSubunit } from "./utils"

export { createReference, fromSubunit, headerValue, prefixFromReference, ProviderError, toSubunit } from "./utils"

const NAME = "Paystack"

export interface PaystackConfig {
  /** Secret key: sk_test_... or sk_live_... Keep it on the server. */
  secretKey: string
  /** Override the API URL (tests). */
  apiUrl?: string
  /** Request timeout in ms. Default 20000. */
  timeoutMs?: number
}

export type PaystackTransactionStatus =
  | "success" | "failed" | "abandoned" | "ongoing" | "pending" | "processing" | "queued" | "reversed"

export interface PaystackTransaction {
  id: number
  status: PaystackTransactionStatus
  reference: string
  /** In subunits (kobo, pesewas...). Use `fromSubunit` for the main amount. */
  amount: number
  currency: string
  paid_at?: string | null
  gateway_response?: string
  customer?: { email?: string }
  metadata?: Record<string, unknown> | string | null
}

export interface InitializeInput {
  email: string
  /** Main units, e.g. 12500 for ₦12,500. Converted to kobo for you. */
  amount: number
  /** NGN, GHS, ZAR, KES, USD... */
  currency: string
  /** Your own reference. Tip: `createReference(orderId)`. */
  reference?: string
  /** Where Paystack sends the customer after paying. */
  callbackUrl?: string
  metadata?: Record<string, unknown>
  /** Limit payment methods, e.g. ["card", "bank_transfer"]. */
  channels?: string[]
}

export interface InitializeResult {
  authorization_url: string
  access_code: string
  reference: string
}

/**
 * What a transaction means for an order, after checking amount and currency:
 * - paid: successful and for at least the expected amount
 * - mismatch: successful but for less, or another currency (do not ship)
 * - failed / reversed: no money
 * - pending: not paid yet (still possible)
 */
export type PaymentOutcome = "paid" | "mismatch" | "failed" | "reversed" | "pending"

type ApiResponse<T> = { status: boolean, message: string, data: T }

export function createPaystack(config: PaystackConfig) {
  if (!config?.secretKey) {
    throw new ProviderError(NAME, "a secretKey is required")
  }
  const apiUrl = (config.apiUrl ?? "https://api.paystack.co").replace(/\/$/, "")

  async function call<T>(path: string, method = "GET", body?: unknown) {
    return requestJson<ApiResponse<T>>(NAME, `${apiUrl}${path}`, {
      method,
      body,
      secretKey: config.secretKey,
      timeoutMs: config.timeoutMs,
    })
  }

  async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const res = await call<T>(path, method, body)
    if (!res.ok || res.body.status !== true) {
      throw new ProviderError(NAME, res.body.message || "request was not accepted", res.status)
    }
    return res.body.data
  }

  /** Get a transaction by reference. `null` when Paystack doesn't know it (not paid yet). */
  async function verify(reference: string): Promise<PaystackTransaction | null> {
    const res = await call<PaystackTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`)
    if (res.status === 404 || (res.body.status === false && /not found/i.test(res.body.message ?? ""))) {
      return null
    }
    if (!res.ok || res.body.status !== true) {
      throw new ProviderError(NAME, res.body.message || "could not verify the transaction", res.status)
    }
    return res.body.data
  }

  /** Check a transaction against what you expected to be paid (main units). */
  function outcome(tx: PaystackTransaction | null, expected?: { amount?: number, currency?: string }): PaymentOutcome {
    if (!tx) {
      return "pending"
    }
    switch (tx.status) {
      case "success": {
        const amount = expected?.amount ? toSubunit(expected.amount) : 0
        const currency = expected?.currency?.toUpperCase()
        if ((amount && tx.amount < amount) || (currency && tx.currency?.toUpperCase() !== currency)) {
          return "mismatch"
        }
        return "paid"
      }
      case "failed":
        return "failed"
      case "reversed":
        return "reversed"
      default:
        return "pending"
    }
  }

  /** True when the `x-paystack-signature` header matches the raw request body. */
  function verifySignature(rawBody: string | Buffer | Uint8Array, signature: string | null | undefined): boolean {
    if (!signature || !rawBody) {
      return false
    }
    const expected = createHmac("sha512", config.secretKey).update(rawBody).digest("hex")
    return safeEqual(expected, signature)
  }

  return {
    /** Start a payment. Send the customer to `authorization_url`, or use `access_code` with Paystack's popup. */
    initialize(input: InitializeInput): Promise<InitializeResult> {
      return api<InitializeResult>("/transaction/initialize", "POST", {
        email: input.email,
        amount: toSubunit(input.amount),
        currency: input.currency.toUpperCase(),
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
        channels: input.channels,
      })
    },

    verify,
    outcome,

    /** Refund all or part (main units) of a transaction, by reference or id. */
    async refund(input: { transaction: string | number, amount?: number }) {
      const refund = await api<{ id: number, status: string, amount?: number }>("/refund", "POST", {
        transaction: input.transaction,
        amount: input.amount === undefined ? undefined : toSubunit(input.amount),
      })
      return { ...refund, amount: refund.amount ?? (input.amount === undefined ? undefined : toSubunit(input.amount)) }
    },

    verifySignature,

    /**
     * Handle a webhook safely: checks the signature, keeps only `charge.success`, then asks
     * Paystack for the real transaction. Returns `null` for anything you should ignore.
     * Always reply 200 to Paystack, even for `null`.
     */
    async confirmWebhook(rawBody: string | Buffer | Uint8Array, signature: string | null | undefined) {
      if (!verifySignature(rawBody, signature)) {
        return null
      }
      let event: { event?: string, data?: { reference?: string } }
      try {
        event = JSON.parse(Buffer.from(rawBody as Uint8Array).toString("utf8"))
      }
      catch {
        return null
      }
      if (event.event !== "charge.success" || !event.data?.reference) {
        return null
      }
      const transaction = await verify(event.data.reference)
      if (!transaction || transaction.status !== "success") {
        return null
      }
      return { event: event.event, transaction }
    },

    /** Any other Paystack endpoint: `request("/bank?country=nigeria")`. */
    request: api,
  }
}

export type PaystackClient = ReturnType<typeof createPaystack>
