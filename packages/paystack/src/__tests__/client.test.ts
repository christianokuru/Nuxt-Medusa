import { createHmac } from "node:crypto"
import { createPaystack, createReference, prefixFromReference } from "../index"

const SECRET = "sk_test_client"

function mockFetch(handler: (url: string, init: RequestInit) => { status?: number, json: unknown }) {
  const calls: { url: string, body: unknown }[] = []
  global.fetch = jest.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, body: init.body ? JSON.parse(String(init.body)) : undefined })
    const result = handler(url, init)
    return new Response(JSON.stringify(result.json), { status: result.status ?? 200 })
  }) as never
  return calls
}

describe("createPaystack (plain Node, no Medusa)", () => {
  const paystack = createPaystack({ secretKey: SECRET })

  it("needs a secret key", () => {
    expect(() => createPaystack({ secretKey: "" })).toThrow(/secretKey/)
  })

  it("initializes in kobo and returns Paystack's data", async () => {
    const calls = mockFetch(() => ({ json: { status: true, message: "ok", data: { authorization_url: "https://checkout.paystack.com/x", access_code: "ac", reference: "order_1--aa" } } }))
    const result = await paystack.initialize({ email: "a@b.co", amount: 2500.5, currency: "ngn", reference: "order_1--aa" })
    expect(calls[0]!.body).toMatchObject({ amount: 250050, currency: "NGN", email: "a@b.co" })
    expect(result.authorization_url).toContain("paystack")
  })

  it("turns API errors into readable errors", async () => {
    mockFetch(() => ({ status: 401, json: { status: false, message: "Invalid key" } }))
    await expect(paystack.initialize({ email: "a@b.co", amount: 1, currency: "NGN" })).rejects.toThrow("Paystack: Invalid key")
  })

  it("checks amount and currency", () => {
    const tx = { id: 1, status: "success", reference: "r", amount: 10000, currency: "NGN" } as const
    expect(paystack.outcome(tx, { amount: 100, currency: "NGN" })).toBe("paid")
    expect(paystack.outcome(tx, { amount: 150, currency: "NGN" })).toBe("mismatch")
    expect(paystack.outcome(tx, { amount: 100, currency: "GHS" })).toBe("mismatch")
    expect(paystack.outcome(null)).toBe("pending")
  })

  it("confirms a signed webhook only after verifying with the API", async () => {
    const body = JSON.stringify({ event: "charge.success", data: { reference: "order_1--aa" } })
    const signature = createHmac("sha512", SECRET).update(body).digest("hex")
    mockFetch(() => ({ json: { status: true, message: "ok", data: { id: 1, status: "success", reference: "order_1--aa", amount: 500, currency: "NGN" } } }))
    const result = await paystack.confirmWebhook(body, signature)
    expect(result?.transaction.reference).toBe("order_1--aa")
    expect(await paystack.confirmWebhook(body, "bad")).toBeNull()
  })

  it("makes and reads references", () => {
    const ref = createReference("order_9")
    expect(prefixFromReference(ref)).toBe("order_9")
  })
})
