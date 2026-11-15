import { createFlutterwave } from "../index"

function mockFetch(handler: (url: string) => { status?: number, json: unknown }) {
  const calls: { url: string, body: unknown }[] = []
  global.fetch = jest.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, body: init.body ? JSON.parse(String(init.body)) : undefined })
    const result = handler(url)
    return new Response(JSON.stringify(result.json), { status: result.status ?? 200 })
  }) as never
  return calls
}

describe("createFlutterwave (plain Node, no Medusa)", () => {
  const flw = createFlutterwave({ secretKey: "FLWSECK_TEST-x", webhookHash: "hash" })

  it("creates a payment link", async () => {
    const calls = mockFetch(() => ({ json: { status: "success", message: "ok", data: { link: "https://checkout.flutterwave.com/x" } } }))
    const result = await flw.createPaymentLink({ txRef: "order_1--aa", amount: 5000, currency: "ngn", customer: { email: "a@b.co", phone: "080" }, title: "Shop" })
    expect(calls[0]!.body).toMatchObject({ tx_ref: "order_1--aa", amount: 5000, currency: "NGN", customer: { email: "a@b.co", phonenumber: "080" }, customizations: { title: "Shop" } })
    expect(result).toEqual({ link: "https://checkout.flutterwave.com/x", tx_ref: "order_1--aa" })
  })

  it("returns null for a transaction that doesn't exist yet", async () => {
    mockFetch(() => ({ status: 404, json: { status: "error", message: "No transaction was found for this id" } }))
    expect(await flw.verifyByReference("order_1--aa")).toBeNull()
  })

  it("confirms webhooks only with the right hash and a real successful transaction", async () => {
    const body = { event: "charge.completed", data: { tx_ref: "order_1--aa" } }
    mockFetch(() => ({ json: { status: "success", message: "ok", data: { id: 5, tx_ref: "order_1--aa", status: "successful", amount: 5000, currency: "NGN" } } }))
    expect((await flw.confirmWebhook(body, "hash"))?.transaction.id).toBe(5)
    expect(await flw.confirmWebhook(JSON.stringify(body), "hash")).not.toBeNull()
    expect(await flw.confirmWebhook(body, "wrong")).toBeNull()
    expect(await createFlutterwave({ secretKey: "x" }).confirmWebhook(body, "hash")).toBeNull()
  })
})
