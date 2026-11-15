import { createSSRApp, h, type VNodeChild } from "vue"
import { renderToString } from "vue/server-renderer"
import { Address, Button, Eyebrow, Heading, Items, Layout, longDate, money, Paragraph, SectionTitle, Totals } from "./components"
import type { OrderEmailData, RenderedEmail } from "./types"

export type { EmailAddress, EmailBrand, EmailOrder, EmailOrderItem, EmailTracking, OrderEmailData, RenderedEmail } from "./types"
export { sampleOrderEmailData } from "./sample"

interface EmailTemplate {
  /** Shown in the admin. */
  label: string
  description: string
  subject: (data: OrderEmailData) => string
  preheader: (data: OrderEmailData) => string
  body: (data: OrderEmailData) => VNodeChild
  text: (data: OrderEmailData) => string
}

const firstName = (data: OrderEmailData) => data.customer_name?.trim().split(/\s+/)[0] || ""

const orderText = (data: OrderEmailData, items = data.order.items) => {
  const { order, brand } = data
  const lines = items.map(i => `- ${i.title}${i.subtitle ? ` (${i.subtitle})` : ""} x ${i.quantity}: ${money(i.total, order.currency_code, brand.locale)}`)
  return lines.join("\n")
}

export const templates = {
  "order-placed": {
    label: "Order confirmation",
    description: "Sent when a customer places an order.",
    subject: ({ order }) => `Your order #${order.display_id} is confirmed`,
    preheader: ({ order, brand }) => `We've received order #${order.display_id} (${money(order.total, order.currency_code, brand.locale)}) and are getting it ready.`,
    body: (data) => {
      const { order, brand } = data
      const name = firstName(data)
      return [
        h(Eyebrow, () => `Order #${order.display_id} · ${longDate(order.created_at, brand.locale)}`),
        h(Heading, () => (name ? `Thank you, ${name}.` : "Thank you for your order.")),
        h(Paragraph, () => "We've received your order and are getting it ready. We'll email you again as soon as it ships."),
        order.url ? h(Button, { href: order.url, color: brand.color }, () => "View your order") : null,
        h(SectionTitle, () => "Your order"),
        Items(order.items, order.currency_code, brand.locale),
        Totals(order, brand.locale),
        Address("Delivering to", order.shipping_address, order.shipping_method),
      ]
    },
    text: (data) => {
      const { order, brand } = data
      return [
        `Thank you for your order${firstName(data) ? `, ${firstName(data)}` : ""}.`,
        "",
        `Order #${order.display_id} - ${longDate(order.created_at, brand.locale)}`,
        "We've received your order and are getting it ready. We'll email you again as soon as it ships.",
        "",
        orderText(data),
        "",
        `Total: ${money(order.total, order.currency_code, brand.locale)}`,
        order.url ? `\nView your order: ${order.url}` : "",
      ].join("\n")
    },
  },

  "order-shipped": {
    label: "Shipping confirmation",
    description: "Sent when you mark items as shipped. Includes tracking links.",
    subject: ({ order }) => `Your order #${order.display_id} is on its way`,
    preheader: ({ order }) => `Order #${order.display_id} has left us. Track it any time.`,
    body: (data) => {
      const { order, brand } = data
      const items = data.shipment_items?.length ? data.shipment_items : order.items
      const partial = !!data.shipment_items?.length && data.shipment_items.length < order.items.length
      const tracking = (data.tracking ?? []).filter(t => t.number || t.url)
      return [
        h(Eyebrow, () => `Order #${order.display_id}`),
        h(Heading, () => "Your order is on its way."),
        h(Paragraph, () => (partial
          ? "Part of your order has left us. We'll let you know when the rest ships."
          : "Good news: your order has left us and is on its way to you.")),
        ...tracking.map(t => [
          t.url ? h(Button, { href: t.url, color: brand.color }, () => "Track your package") : null,
          t.number ? h(Paragraph, { muted: true }, () => `Tracking number: ${t.number}`) : null,
        ]),
        h(SectionTitle, () => (partial ? "In this shipment" : "Your items")),
        Items(items, order.currency_code, brand.locale),
        Address("Delivering to", order.shipping_address, order.shipping_method),
      ]
    },
    text: (data) => {
      const tracking = (data.tracking ?? []).map(t => [t.number && `Tracking number: ${t.number}`, t.url && `Track: ${t.url}`].filter(Boolean).join("\n"))
      return [
        "Your order is on its way.",
        "",
        `Order #${data.order.display_id} has left us.`,
        ...tracking,
        "",
        orderText(data, data.shipment_items?.length ? data.shipment_items : data.order.items),
      ].join("\n")
    },
  },

  "order-delivered": {
    label: "Delivery confirmation",
    description: "Sent when you mark an order as delivered.",
    subject: ({ order }) => `Your order #${order.display_id} has arrived`,
    preheader: ({ order }) => `Order #${order.display_id} was delivered. We hope you love it.`,
    body: (data) => {
      const { order, brand } = data
      const items = data.shipment_items?.length ? data.shipment_items : order.items
      return [
        h(Eyebrow, () => `Order #${order.display_id}`),
        h(Heading, () => "Your order has arrived."),
        h(Paragraph, () => "Your package was delivered. We hope you love it."),
        h(Paragraph, { muted: true }, () => (brand.supportEmail
          ? `Something not right? Write to ${brand.supportEmail} and we'll sort it out.`
          : "Something not right? Reply to this email and we'll sort it out.")),
        brand.storeUrl ? h(Button, { href: brand.storeUrl, color: brand.color }, () => "Shop again") : null,
        h(SectionTitle, () => "Delivered"),
        Items(items, order.currency_code, brand.locale),
      ]
    },
    text: data => [
      "Your order has arrived.",
      "",
      `Order #${data.order.display_id} was delivered. We hope you love it.`,
      "",
      orderText(data, data.shipment_items?.length ? data.shipment_items : data.order.items),
    ].join("\n"),
  },
} satisfies Record<string, EmailTemplate>

export type TemplateName = keyof typeof templates

export const templateNames = Object.keys(templates) as TemplateName[]

export function isTemplateName(name: unknown): name is TemplateName {
  return typeof name === "string" && name in templates
}

/** Render an email to subject, HTML and plain text. Works in any Node.js app. */
export async function renderEmail(name: TemplateName, data: OrderEmailData): Promise<RenderedEmail> {
  const template: EmailTemplate = templates[name]
  const subject = template.subject(data)
  const app = createSSRApp({
    render: () => h(Layout, { brand: data.brand, subject, preheader: template.preheader(data) }, () => template.body(data)),
  })
  const html = `<!DOCTYPE html>${await renderToString(app)}`
  return { subject, html, text: template.text(data) }
}
