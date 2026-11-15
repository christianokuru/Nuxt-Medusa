import FlutterwaveProviderService from "../medusa/service"

const SECRET = "FLWSECK_TEST-unit"
const HASH = "my-webhook-hash"
const logger = { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() } as never

type Call = { url: string, method: string, body: unknown }

function mockFetch(routes: Record<string, (body: unknown) => { status?: number, json: unknown }>) {
  const calls: Call[] = []
  global.fetch = jest.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET"
    const body = init.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ url, method, body })
    const key = `${method} ${new URL(url).pathname}`
    const route = Object.entries(routes).find(([pattern]) => key.startsWith(pattern))
    const result = route ? route[1](body) : { status: 404, json: { status: "error", message: "No transaction was found for this id" } }
    return new Response(JSON.stringify(result.json), { status: result.status ?? 200 })
  }) as never
  return calls
}

const tx = (over: Record<string, unknown> = {}) => ({
  id: 4242,
  tx_ref: "payses_9--abc",
  status: "successful",
  amount: 12500,
  currency: "NGN",
  ...over,
})

describe("FlutterwaveProviderService", () => {
  const service = new FlutterwaveProviderService({ logger }, { secretKey: SECRET, webhookHash: HASH, redirectUrl: "https://shop.test/done" })

  it("requires a secret key", () => {
    expect(() => FlutterwaveProviderService.validateOptions({})).toThrow(/secretKey/)
  })

  it("creates a payment link in main units", async () => {
    const calls = mockFetch({ "POST /v3/payments": () => ({ json: { status: "success", message: "ok", data: { link: "https://checkout.flutterwave.com/pay/x" } } }) })
    const result = await service.initiatePayment({
      amount: 12500,
      currency_code: "ngn",
      data: { session_id: "payses_9" },
      context: { customer: { email: "ada@example.com", first_name: "Ada", last_name: "Obi" } as never },
    })
    expect(calls[0]!.body).toMatchObject({
      amount: 12500,
      currency: "NGN",
      redirect_url: "https://shop.test/done",
      customer: { email: "ada@example.com", name: "Ada Obi" },
      meta: { session_id: "payses_9" },
    })
    expect(String(result.id)).toMatch(/^payses_9--/)
    expect(result.data).toMatchObject({ payment_link: "https://checkout.flutterwave.com/pay/x", amount: 12500, currency: "NGN" })
  })

  it("reports a verified, matching payment as captured", async () => {
    mockFetch({ "GET /v3/transactions/verify_by_reference": () => ({ json: { status: "success", message: "ok", data: tx() } }) })
    const result = await service.authorizePayment({ data: { tx_ref: "payses_9--abc", amount: 12500, currency: "NGN" } })
    expect(result.status).toBe("captured")
    expect(result.data).toMatchObject({ transaction_id: 4242 })
  })

  it("rejects a wrong currency", async () => {
    mockFetch({ "GET /v3/transactions/verify_by_reference": () => ({ json: { status: "success", message: "ok", data: tx({ currency: "GHS" }) } }) })
    const result = await service.authorizePayment({ data: { tx_ref: "payses_9--abc", amount: 12500, currency: "NGN" } })
    expect(result.status).toBe("error")
  })

  it("is pending when the customer has not paid yet", async () => {
    mockFetch({})
    const result = await service.getPaymentStatus({ data: { tx_ref: "payses_9--abc", amount: 12500, currency: "NGN" } })
    expect(result.status).toBe("pending")
  })

  it("refunds against the transaction id", async () => {
    const calls = mockFetch({ "POST /v3/transactions/4242/refund": () => ({ json: { status: "success", message: "ok", data: { id: 1, status: "completed", amount_refunded: 2500 } } }) })
    const result = await service.refundPayment({ amount: 2500, data: { tx_ref: "payses_9--abc", transaction_id: 4242 } })
    expect(calls[0]!.body).toEqual({ amount: 2500 })
    expect(result.data?.refunds).toEqual([{ id: 1, status: "completed", amount: 2500 }])
  })

  describe("webhooks", () => {
    const event = { event: "charge.completed", data: { tx_ref: "payses_9--abc", status: "successful", amount: 12500 } }

    it("accepts the right secret hash after verifying with Flutterwave", async () => {
      const calls = mockFetch({ "GET /v3/transactions/verify_by_reference": () => ({ json: { status: "success", message: "ok", data: tx() } }) })
      const result = await service.getWebhookActionAndData({ data: event, rawData: JSON.stringify(event), headers: { "verif-hash": HASH } })
      expect(result).toEqual({ action: "captured", data: { session_id: "payses_9", amount: 12500 } })
      expect(calls).toHaveLength(1)
    })

    it("ignores a wrong hash without calling Flutterwave", async () => {
      const calls = mockFetch({})
      const result = await service.getWebhookActionAndData({ data: event, rawData: "", headers: { "verif-hash": "nope" } })
      expect(result.action).toBe("not_supported")
      expect(calls).toHaveLength(0)
    })

    it("ignores webhooks when no hash is configured", async () => {
      const open = new FlutterwaveProviderService({ logger }, { secretKey: SECRET })
      const result = await open.getWebhookActionAndData({ data: event, rawData: "", headers: { "verif-hash": "" } })
      expect(result.action).toBe("not_supported")
    })

    it("does not trust a body that claims success when the API disagrees", async () => {
      mockFetch({ "GET /v3/transactions/verify_by_reference": () => ({ json: { status: "success", message: "ok", data: tx({ status: "failed" }) } }) })
      const result = await service.getWebhookActionAndData({ data: event, rawData: "", headers: { "verif-hash": HASH } })
      expect(result.action).toBe("not_supported")
    })
  })
})
