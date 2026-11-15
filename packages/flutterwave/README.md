# @nuxt-medusa/flutterwave

Flutterwave payments (Flutterwave Standard, API v3) for any Node.js server, plus a ready-made Medusa payment provider.

- Hosted payment page: cards, bank transfer, USSD, mobile money.
- Safe webhooks: checks your secret hash, then confirms the transaction with Flutterwave's API.
- No dependencies.

## Install

```bash
npm install @nuxt-medusa/flutterwave
```

## Any Node.js project

```ts
import { createFlutterwave, createReference } from "@nuxt-medusa/flutterwave"

const flw = createFlutterwave({
  secretKey: process.env.FLUTTERWAVE_SECRET_KEY!,
  webhookHash: process.env.FLUTTERWAVE_WEBHOOK_HASH, // same value as in Flutterwave → Settings → Webhooks
})

// 1. Create a payment page and send the customer to `link`
const { link, tx_ref } = await flw.createPaymentLink({
  txRef: createReference(order.id),
  amount: 12500,
  currency: "NGN",
  customer: { email: "ada@example.com", name: "Ada Okafor" },
  redirectUrl: "https://shop.example.com/checkout/done",
  title: "My Shop",
})

// 2. Was it paid, in full?
const tx = await flw.verifyByReference(tx_ref)
flw.outcome(tx, { amount: 12500, currency: "NGN" }) // "paid" | "mismatch" | "failed" | "pending"

// 3. Webhook
const result = await flw.confirmWebhook(body, request.headers["verif-hash"])
if (result) {
  // result.transaction is verified with Flutterwave. Mark the order paid.
}

// Refunds (Flutterwave transaction id, amount in main units)
await flw.refund(tx.id, 5000)
```

## Medusa

```ts
providers: [{
  resolve: "@nuxt-medusa/flutterwave/medusa",
  id: "flutterwave",
  options: {
    secretKey: process.env.FLUTTERWAVE_SECRET_KEY,
    webhookHash: process.env.FLUTTERWAVE_WEBHOOK_HASH,
    redirectUrl: process.env.FLUTTERWAVE_REDIRECT_URL,
    storeName: "My Shop",
    // logoUrl, paymentOptions: "card,banktransfer,ussd"
  },
}]
```

- Provider id: `pp_flutterwave_flutterwave`. Webhook URL: `https://<backend>/hooks/payment/flutterwave_flutterwave`
- The payment session's `data.payment_link` is the page to send the customer to.

## Tests

```bash
npm test
```
