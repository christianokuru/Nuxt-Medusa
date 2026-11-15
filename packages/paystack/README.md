# @nuxt-medusa/paystack

Paystack payments for any Node.js server (Nuxt server routes, Express, Medusa...), plus a ready-made Medusa payment provider.

- Amounts in main units (₦12,500 = `12500`). Conversion to kobo is done for you.
- Safe webhooks: checks the signature, then confirms the transaction with Paystack's API.
- No dependencies.

## Install

```bash
npm install @nuxt-medusa/paystack
```

(See the main README for installing from GitHub instead of npm.)

## Any Node.js project

```ts
import { createPaystack, createReference } from "@nuxt-medusa/paystack"

const paystack = createPaystack({ secretKey: process.env.PAYSTACK_SECRET_KEY! })

// 1. Start a payment and send the customer to authorization_url
const { authorization_url } = await paystack.initialize({
  email: "ada@example.com",
  amount: 12500,
  currency: "NGN",
  reference: createReference(order.id), // "<order id>--<random>"
  callbackUrl: "https://shop.example.com/checkout/done",
})

// 2. When they come back (or any time): was it paid, in full?
const tx = await paystack.verify(reference)
paystack.outcome(tx, { amount: 12500, currency: "NGN" }) // "paid" | "mismatch" | "failed" | "reversed" | "pending"

// 3. Webhook (use the RAW request body)
const result = await paystack.confirmWebhook(rawBody, request.headers["x-paystack-signature"])
if (result) {
  // result.transaction is verified with Paystack. Mark the order paid.
}
// Always answer 200.

// Refunds (all or part, main units)
await paystack.refund({ transaction: reference, amount: 5000 })
```

Errors are thrown as `ProviderError` with a readable message (`"Paystack: Invalid key"`).

## Medusa

In `medusa-config.ts`:

```ts
modules: [{
  key: Modules.PAYMENT,
  resolve: "@medusajs/medusa/payment",
  options: {
    providers: [{
      resolve: "@nuxt-medusa/paystack/medusa",
      id: "paystack",
      options: {
        secretKey: process.env.PAYSTACK_SECRET_KEY,
        callbackUrl: process.env.PAYSTACK_CALLBACK_URL, // your checkout "done" page
        // channels: ["card", "bank_transfer"],
      },
    }],
  },
}]
```

- Provider id in Medusa: `pp_paystack_paystack`. Enable it on a region.
- Webhook URL for the Paystack dashboard: `https://<backend>/hooks/payment/paystack_paystack`
- The payment session's `data` has `authorization_url` and `access_code` for your checkout page.
- Paystack charges immediately, so successful payments show as captured.

## Tests

```bash
npm test
```
