import { createHmac } from "node:crypto"
import PaystackProviderService from "../service"

const SECRET = "sk_test_unit"
const logger = { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() } as never

type Call = { url: string, method: string, body: unknown, auth: string | null }

// Fake Paystack API: routes return canned JSON and record every call.
function mockFetch(routes: Record<string, (body: unknown) => { status?: number, json: unknown }>) {
  const calls: Call[] = []
  global.fetch = jest.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET"
    const body = init.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ url, method, body, auth: (init.headers as Record<string, string>)?.Authorization ?? null })
    const key = `${method} ${new URL(url).pathname}`
    const route = Object.entries(routes).find(([pattern]) => key.startsWith(pattern))
    const result = route ? route[1](body) : { status: 404, json: { status: false, message: "Not found" } }
    return new Response(JSON.stringify(result.json), { status: result.status ?? 200 })
  }) as never
  return calls
}

const tx = (over: Record<string, unknown> = {}) => ({
  id: 99,
  status: "success",
  reference: "payses_1--abc",
  amount: 1250000,
  currency: "NGN",
  paid_at: "2026-11-14T10:00:00Z",
  ...over,
})

describe("PaystackProviderService", () => {
  const service = new PaystackProviderService({ logger }, { secretKey: SECRET })

  it("requires a secret key", () => {
    expect(() => PaystackProviderService.validateOptions({})).toThrow(/secretKey/)
  })

  it("starts a transaction in kobo with the session id in the reference", async () => {
    const calls = mockFetch({
      "POST /transaction/initialize": body => ({
        json: { status: true, message: "ok", data: { authorization_url: "https://checkout.paystack.com/x", access_code: "ac_1", reference: (body as { reference: string }).reference } },
      }),
    })
    const result = await service.initiatePayment({
      amount: 12500,
      currency_code: "ngn",
      data: { session_id: "payses_1" },
      context: { customer: { email: "ada@example.com" } as never },
    })

    expect(calls[0]!.auth).toBe(`Bearer ${SECRET}`)
    expect(calls[0]!.body).toMatchObject({ email: "ada@example.com", amount: 1250000, currency: "NGN", metadata: { session_id: "payses_1" } })
    expect(result.status).toBe("pending")
    expect(String(result.id)).toMatch(/^payses_1--[0-9a-f]{12}$/)
    expect(result.data).toMatchObject({ authorization_url: "https://checkout.paystack.com/x", access_code: "ac_1", amount_subunit: 1250000, currency: "NGN" })
  })

  it("refuses to start without an email", async () => {
    mockFetch({})
    await expect(service.initiatePayment({ amount: 10, currency_code: "ngn", data: { session_id: "payses_1" } })).rejects.toThrow(/email/)
  })

  it("reports a verified, matching payment as captured", async () => {
    mockFetch({ "GET /transaction/verify/": () => ({ json: { status: true, message: "ok", data: tx() } }) })
    const result = await service.authorizePayment({ data: { reference: "payses_1--abc", amount_subunit: 1250000, currency: "NGN" } })
    expect(result.status).toBe("captured")
    expect(result.data).toMatchObject({ transaction_id: 99, paystack_status: "success" })
  })

  it("rejects a payment for less than the order total", async () => {
    mockFetch({ "GET /transaction/verify/": () => ({ json: { status: true, message: "ok", data: tx({ amount: 100 }) } }) })
    const result = await service.authorizePayment({ data: { reference: "payses_1--abc", amount_subunit: 1250000, currency: "NGN" } })
    expect(result.status).toBe("error")
  })

  it("treats unpaid and abandoned payments as pending, failed as error", async () => {
    for (const [status, expected] of [["abandoned", "pending"], ["ongoing", "pending"], ["failed", "error"], ["reversed", "canceled"]]) {
      mockFetch({ "GET /transaction/verify/": () => ({ json: { status: true, message: "ok", data: tx({ status }) } }) })
      const result = await service.getPaymentStatus({ data: { reference: "payses_1--abc", amount_subunit: 1250000, currency: "NGN" } })
      expect(result.status).toBe(expected)
    }
  })

  it("refunds in kobo against the reference", async () => {
    const calls = mockFetch({ "POST /refund": () => ({ json: { status: true, message: "ok", data: { id: 7, status: "pending", amount: 500000 } } }) })
    const result = await service.refundPayment({ amount: 5000, data: { reference: "payses_1--abc" } })
    expect(calls[0]!.body).toEqual({ transaction: "payses_1--abc", amount: 500000 })
    expect(result.data?.refunds).toEqual([{ id: 7, status: "pending", amount: 5000 }])
  })

  describe("webhooks", () => {
    const event = { event: "charge.success", data: { reference: "payses_1--abc", amount: 1250000 } }
    const raw = JSON.stringify(event)
    const signed = createHmac("sha512", SECRET).update(raw).digest("hex")

    it("accepts a correctly signed charge after verifying it with Paystack", async () => {
      const calls = mockFetch({ "GET /transaction/verify/": () => ({ json: { status: true, message: "ok", data: tx() } }) })
      const result = await service.getWebhookActionAndData({ data: event, rawData: Buffer.from(raw), headers: { "x-paystack-signature": signed } })
      expect(result).toEqual({ action: "captured", data: { session_id: "payses_1", amount: 12500 } })
      expect(calls).toHaveLength(1)
    })

    it("ignores a forged signature without calling Paystack", async () => {
      const calls = mockFetch({})
      const result = await service.getWebhookActionAndData({ data: event, rawData: raw, headers: { "x-paystack-signature": "0".repeat(128) } })
      expect(result.action).toBe("not_supported")
      expect(calls).toHaveLength(0)
    })

    it("ignores a valid signature when Paystack says the charge did not succeed", async () => {
      mockFetch({ "GET /transaction/verify/": () => ({ json: { status: true, message: "ok", data: tx({ status: "failed" }) } }) })
      const result = await service.getWebhookActionAndData({ data: event, rawData: raw, headers: { "x-paystack-signature": signed } })
      expect(result.action).toBe("not_supported")
    })

    it("ignores other events", async () => {
      const other = JSON.stringify({ event: "transfer.success", data: {} })
      const sig = createHmac("sha512", SECRET).update(other).digest("hex")
      mockFetch({})
      const result = await service.getWebhookActionAndData({ data: JSON.parse(other), rawData: other, headers: { "x-paystack-signature": sig } })
      expect(result.action).toBe("not_supported")
    })
  })
})
