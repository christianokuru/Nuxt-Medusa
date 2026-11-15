import { randomBytes, timingSafeEqual } from "node:crypto"

/**
 * A payment reference: "<prefix>--<random>". Use your order, cart or session id as
 * the prefix, so you can read it back from webhooks with `prefixFromReference`.
 */
export function createReference(prefix: string): string {
  return `${prefix}--${randomBytes(6).toString("hex")}`
}

export function prefixFromReference(reference: unknown): string | null {
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

/** First value of a header that may be a string or a list (Node, Express, h3...). */
export function headerValue(headers: Record<string, unknown> | Headers | undefined, name: string): string | null {
  if (!headers) {
    return null
  }
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name)
  }
  const record = headers as Record<string, unknown>
  const value = record[name] ?? record[name.toLowerCase()]
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : null
  }
  return typeof value === "string" ? value : null
}

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    /** HTTP status from the provider, if there was a response. */
    readonly status?: number,
  ) {
    super(`${provider}: ${message}`)
    this.name = `${provider}Error`
  }
}

/** JSON request with a bearer token, a timeout and readable errors. */
export async function requestJson<T>(
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
    }
    catch {
      body = { message: text.slice(0, 200) } as T
    }
    return { ok: res.ok, status: res.status, body }
  }
  catch (error) {
    const reason = (error as Error).name === "AbortError" ? "request timed out" : `request failed: ${(error as Error).message}`
    throw new ProviderError(provider, reason)
  }
  finally {
    clearTimeout(timer)
  }
}
