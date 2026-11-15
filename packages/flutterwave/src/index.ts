import { ProviderError, requestJson, safeEqual } from "./utils"

export { createReference, headerValue, prefixFromReference, ProviderError } from "./utils"

const NAME = "Flutterwave"

export interface FlutterwaveConfig {
  /** Secret key: FLWSECK_TEST-... or FLWSECK-... Keep it on the server. */
  secretKey: string
  /** The "secret hash" set in Flutterwave → Settings → Webhooks. Needed for webhooks. */
  webhookHash?: string
  /** Override the API URL (tests). */
  apiUrl?: string
  /** Request timeout in ms. Default 20000. */
  timeoutMs?: number
}

export interface FlutterwaveTransaction {
  id: number
  tx_ref: string
  status: "successful" | "failed" | "pending" | string
  /** Main units (Flutterwave doesn't use subunits). */
  amount: number
  currency: string
  created_at?: string
  customer?: { email?: string, name?: string }
}

export interface PaymentLinkInput {
  /** Your own reference. Tip: `createReference(orderId)`. */
  txRef: string
  /** Main units, e.g. 12500 for ₦12,500. */
  amount: number
  currency: string
  /** Where Flutterwave sends the customer after paying. */
  redirectUrl?: string
  customer: { email: string, name?: string, phone?: string }
  meta?: Record<string, unknown>
  /** Title and logo on Flutterwave's payment page. */
  title?: string
  logo?: string
  /** Limit payment methods, e.g. "card,banktransfer,ussd". */
  paymentOptions?: string
}

/** Same meaning as in the Paystack package. */
export type PaymentOutcome = "paid" | "mismatch" | "failed" | "pending"

type ApiResponse<T> = { status: "success" | "error", message: string, data: T }

export function createFlutterwave(config: FlutterwaveConfig) {
  if (!config?.secretKey) {
    throw new ProviderError(NAME, "a secretKey is required")
  }
  const apiUrl = (config.apiUrl ?? "https://api.flutterwave.com/v3").replace(/\/$/, "")

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
    if (!res.ok || res.body.status !== "success") {
      throw new ProviderError(NAME, res.body.message || "request was not accepted", res.status)
    }
    return res.body.data
  }

  /** Get a transaction by your reference. `null` when there is none yet (not paid). */
  async function verifyByReference(txRef: string): Promise<FlutterwaveTransaction | null> {
    const res = await call<FlutterwaveTransaction>(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`)
    if (res.status === 404 || (res.body.status === "error" && /no transaction|not found/i.test(res.body.message ?? ""))) {
      return null
    }
    if (!res.ok || res.body.status !== "success") {
      throw new ProviderError(NAME, res.body.message || "could not verify the transaction", res.status)
    }
    return res.body.data
  }

  function outcome(tx: FlutterwaveTransaction | null, expected?: { amount?: number, currency?: string }): PaymentOutcome {
    if (!tx) {
      return "pending"
    }
    if (tx.status === "successful") {
      const currency = expected?.currency?.toUpperCase()
      if ((expected?.amount && tx.amount < expected.amount) || (currency && tx.currency?.toUpperCase() !== currency)) {
        return "mismatch"
      }
      return "paid"
    }
    return tx.status === "failed" ? "failed" : "pending"
  }

  /** True when the `verif-hash` header matches your webhook secret hash. */
  function verifyWebhookHash(hash: string | null | undefined): boolean {
    return !!config.webhookHash && !!hash && safeEqual(hash, config.webhookHash)
  }

  return {
    /** Create a hosted payment page. Send the customer to the returned `link`. */
    async createPaymentLink(input: PaymentLinkInput) {
      const data = await api<{ link: string }>("/payments", "POST", {
        tx_ref: input.txRef,
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        redirect_url: input.redirectUrl,
        customer: { email: input.customer.email, name: input.customer.name, phonenumber: input.customer.phone },
        meta: input.meta,
        payment_options: input.paymentOptions,
        customizations: input.title || input.logo ? { title: input.title, logo: input.logo } : undefined,
      })
      return { link: data.link, tx_ref: input.txRef }
    },

    verifyByReference,
    outcome,

    /** Refund all or part (main units) of a transaction, by Flutterwave's transaction id. */
    refund(transactionId: number | string, amount?: number) {
      return api<{ id: number, status: string, amount_refunded?: number }>(
        `/transactions/${encodeURIComponent(String(transactionId))}/refund`,
        "POST",
        amount === undefined ? {} : { amount },
      )
    },

    verifyWebhookHash,

    /**
     * Handle a webhook safely: checks the secret hash, keeps only `charge.completed`, then
     * asks Flutterwave for the real transaction. Returns `null` for anything you should ignore.
     * Always reply 200 to Flutterwave, even for `null`.
     */
    async confirmWebhook(body: unknown, hash: string | null | undefined) {
      if (!verifyWebhookHash(hash)) {
        return null
      }
      const event = (typeof body === "string" ? safeParse(body) : body) as { event?: string, data?: { tx_ref?: string } } | null
      const txRef = event?.data?.tx_ref
      if (event?.event !== "charge.completed" || !txRef) {
        return null
      }
      const transaction = await verifyByReference(txRef)
      if (!transaction || transaction.status !== "successful") {
        return null
      }
      return { event: event.event, transaction }
    },

    /** Any other Flutterwave endpoint: `request("/banks/NG")`. */
    request: api,
  }
}

function safeParse(text: string) {
  try {
    return JSON.parse(text)
  }
  catch {
    return null
  }
}

export type FlutterwaveClient = ReturnType<typeof createFlutterwave>
