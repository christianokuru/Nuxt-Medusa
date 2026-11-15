# @nuxt-medusa/medusa-resend

Order emails for Medusa 2, sent with [Resend](https://resend.com):

| Email | Sent when |
| --- | --- |
| Order confirmation | A customer places an order |
| Shipping confirmation | You mark items as shipped (with tracking links). Skipped if you untick "notify customer". |
| Delivery confirmation | You mark an order as delivered |

- Templates are written in Vue (render functions), work in every email app, and look right on phones.
- The same email is never sent twice for the same event.
- Admin (Nuxt Medusa admin): **Settings → Emails** to preview each email and send a test, and an **Emails** box on each order showing what was sent, with "Send again".
- The provider also sends any email with `content` (`{ subject, html, text }`), so other plugins can use it.

## Install

```bash
npm install @nuxt-medusa/medusa-resend
```

### Backend (`medusa-config.ts`)

Two parts: the **provider** sends emails, the **plugin** decides when and what they look like.

```ts
modules: [{
  key: Modules.NOTIFICATION,
  resolve: "@medusajs/medusa/notification",
  options: {
    providers: [{
      resolve: "@nuxt-medusa/medusa-resend/providers/resend",
      id: "resend",
      options: {
        channels: ["email"],
        apiKey: process.env.RESEND_API_KEY,
        from: "My Shop <orders@myshop.com>", // domain verified in Resend
        replyTo: "help@myshop.com",          // optional
      },
    }],
  },
}],
plugins: [{
  resolve: "@nuxt-medusa/medusa-resend",
  options: {
    brand: {
      // name: defaults to the store name in Medusa
      logoUrl: "https://myshop.com/logo.png",
      color: "#171614",
      storeUrl: "https://myshop.com",
      supportEmail: "help@myshop.com",
      address: "12 Admiralty Way, Lagos",
      locale: "en-NG",
    },
    orderUrl: "https://myshop.com/account/orders/{id}", // optional
    // emails: { "order-delivered": false },           // turn single emails off
  },
}]
```

Without the provider, the plugin does nothing (no errors), and the admin shows how to turn emails on.

### Admin (`nuxt.config.ts`)

```ts
extends: ["@nuxt-medusa/medusa-resend/nuxt-admin"]
```

## Use the templates anywhere

The templates don't need Medusa:

```ts
import { renderEmail, sampleOrderEmailData } from "@nuxt-medusa/medusa-resend/templates"

const { subject, html, text } = await renderEmail("order-placed", data) // data: OrderEmailData
```

## Admin API

| Route | What it does |
| --- | --- |
| `GET /admin/emails` | Is sending set up, and the list of emails |
| `GET /admin/emails/preview?template=...` | Render an email with a made-up order (or `&order_id=`) |
| `POST /admin/emails/send-test` | `{ template, to }`: send a test |
| `GET /admin/emails/sent?order_id=...` | Emails sent for an order |
| `POST /admin/emails/resend` | `{ notification_id }`: send the same email again |

## Develop

```bash
npm run build   # compiles src/ into .medusa/server
```
