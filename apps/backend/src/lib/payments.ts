import { randomBytes, timingSafeEqual } from "node:crypto"
import { BigNumber, MedusaError } from "@medusajs/framework/utils"
import type { BigNumberInput, PaymentProviderContext } from "@medusajs/framework/types"

// Shared helpers for the Paystack and Flutterwave payment providers.

/** Medusa amount (BigNumber, string or number, in main units) -> plain number. */
export function toNumber(amount: BigNumberInput): number {
  return Number(new BigNumber(amount).numeric)
}

/** 12.5 -> 1250 (kobo, pesewas, cents...). */
export function toSubunit(amount: number): number {
  return Math.round(amount * 100)
}

export function fromSubunit(amount: number): number {
  return amount / 100
}

/**
 * Payment reference sent to the provider: "<session_id>--<random>".
 * The random part keeps it unique when a session is started again,
 * and the session id can always be read back from it.
 */
export function createReference(sessionId: string): string {
  return `${sessionId}--${randomBytes(6).toString("hex")}`
}

export function sessionIdFromReference(reference: unknown): string | null {
  if (typeof reference !== "string" || !reference.includes("--")) {
    return null
  }
  return reference.split("--")[0] || null
}

/** Compare two secrets without leaking timing information. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/** First value of a header that may be a string or a list. */
export function headerValue(headers: Record<string, unknown>, name: string): string | null {
  const value = headers[name] ?? headers[name.toLowerCase()]
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : null
  }
  return typeof value === "string" ? value : null
}

/** Customer email for the payment page: from the customer, or what the store sent. */
export function customerEmail(context: PaymentProviderContext | undefined, data: Record<string, unknown> | undefined): string | null {
  const fromCustomer = context?.customer?.email
  if (fromCustomer) {
    return fromCustomer
  }
  const client = (data?.client ?? {}) as Record<string, unknown>
  const candidate = data?.email ?? client.email
  return typeof candidate === "string" && /.+@.+\..+/.test(candidate) ? candidate : null
}

type JsonResponse = { status?: boolean | string, message?: string, data?: unknown }

/** Small JSON client with a timeout and readable errors. */
export async function requestJson<T extends JsonResponse>(
  provider: string,
  url: string,
  init: { method?: string, secretKey: string, body?: unknown, timeoutMs?: number },
): Promise<{ ok: boolean, status: number, body: T }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 20_000)
  try {
    const res = await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${init.secretKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    })
    const text = await res.text()
    let body: T
    try {
      body = (text ? JSON.parse(text) : {}) as T
    } catch {
      body = { message: text.slice(0, 200) } as T
    }
    return { ok: res.ok, status: res.status, body }
  } catch (error) {
    const reason = (error as Error).name === "AbortError" ? "timed out" : (error as Error).message
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `${provider} request failed: ${reason}`)
  } finally {
    clearTimeout(timer)
  }
}

export function providerError(provider: string, message?: string): MedusaError {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `${provider}: ${message || "request was not accepted"}`)
}
