import { h, type FunctionalComponent, type VNode, type VNodeChild } from "vue"
import type { EmailAddress, EmailBrand, EmailOrder, EmailOrderItem } from "./types"

// Building blocks for the emails, written as Vue render functions.
// Email apps need tables and inline styles, so that's what these produce.

export const palette = {
  paper: "#f4f1ec",
  card: "#fffdfa",
  ink: "#171614",
  muted: "#6b665f",
  line: "#e7e3dc",
}

export const fonts = {
  serif: "Georgia, 'Times New Roman', Times, serif",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
}

export function money(amount: number, currency: string, locale = "en-US") {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: currency.toUpperCase() }).format(amount)
  }
  catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`
  }
}

export function longDate(value: string, locale = "en-US") {
  try {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(value))
  }
  catch {
    return value
  }
}

const table = (style: string, children: VNodeChild, attrs: Record<string, unknown> = {}) =>
  h("table", { role: "presentation", cellpadding: 0, cellspacing: 0, border: 0, width: "100%", style, ...attrs }, [h("tbody", children as VNode[])])

const RESPONSIVE_CSS = `
@media (max-width: 600px) {
  .container { width: 100% !important; }
  .px { padding-left: 22px !important; padding-right: 22px !important; }
  .h1 { font-size: 28px !important; }
}
`

export const Layout: FunctionalComponent<{ brand: EmailBrand, subject: string, preheader: string }> = (props, { slots }) => {
  const { brand } = props
  return h("html", { lang: "en" }, [
    h("head", [
      h("meta", { charset: "utf-8" }),
      h("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
      h("meta", { name: "x-apple-disable-message-reformatting" }),
      h("title", props.subject),
      h("style", { innerHTML: RESPONSIVE_CSS }),
    ]),
    h("body", { style: `margin:0;padding:0;background:${palette.paper};-webkit-text-size-adjust:100%;` }, [
      // Preview text shown in the inbox list, hidden in the email itself.
      h("div", { style: "display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;" }, props.preheader),
      table(`background:${palette.paper};`, [
        h("tr", [
          h("td", { align: "center", style: "padding:32px 12px 40px;" }, [
            table(`width:560px;max-width:560px;background:${palette.card};border:1px solid ${palette.line};`, [
              h("tr", [
                h("td", { class: "px", style: "padding:34px 44px 0;" }, [
                  brand.logoUrl
                    ? h("img", { src: brand.logoUrl, alt: brand.name, width: 120, style: "display:block;border:0;max-width:120px;height:auto;" })
                    : h("p", { style: `margin:0;font-family:${fonts.serif};font-size:22px;color:${palette.ink};letter-spacing:-0.01em;` }, brand.name),
                ]),
              ]),
              h("tr", [h("td", { class: "px", style: "padding:30px 44px 44px;" }, slots.default?.())]),
            ], { class: "container", width: 560 }),
            Footer(brand),
          ]),
        ]),
      ]),
    ]),
  ])
}

function Footer(brand: EmailBrand) {
  const text = `margin:0 0 6px;font-family:${fonts.sans};font-size:12px;line-height:1.6;color:${palette.muted};`
  const link = `color:${palette.muted};text-decoration:underline;`
  return table("width:560px;max-width:560px;", [
    h("tr", [
      h("td", { class: "px", style: "padding:22px 44px 0;" }, [
        brand.supportEmail
          ? h("p", { style: text }, ["Questions? Write to ", h("a", { href: `mailto:${brand.supportEmail}`, style: link }, brand.supportEmail), "."])
          : null,
        h("p", { style: text }, [
          brand.storeUrl ? h("a", { href: brand.storeUrl, style: link }, brand.name) : brand.name,
          brand.address ? ` · ${brand.address}` : null,
        ]),
      ]),
    ]),
  ], { class: "container", width: 560 })
}

export const Eyebrow: FunctionalComponent = (_, { slots }) =>
  h("p", { style: `margin:0 0 14px;font-family:${fonts.sans};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${palette.muted};` }, slots.default?.())

export const Heading: FunctionalComponent = (_, { slots }) =>
  h("h1", { class: "h1", style: `margin:0 0 16px;font-family:${fonts.serif};font-weight:normal;font-size:34px;line-height:1.12;letter-spacing:-0.015em;color:${palette.ink};` }, slots.default?.())

export const Paragraph: FunctionalComponent<{ muted?: boolean }> = (props, { slots }) =>
  h("p", { style: `margin:0 0 16px;font-family:${fonts.sans};font-size:15px;line-height:1.65;color:${props.muted ? palette.muted : palette.ink};` }, slots.default?.())

export const SectionTitle: FunctionalComponent = (_, { slots }) =>
  h("p", { style: `margin:0 0 4px;padding-top:28px;font-family:${fonts.serif};font-size:19px;color:${palette.ink};` }, slots.default?.())

/** A button that works in every email app, including Outlook. */
export const Button: FunctionalComponent<{ href: string, color?: string }> = (props, { slots }) =>
  h("table", { role: "presentation", cellpadding: 0, cellspacing: 0, border: 0, style: "margin:8px 0 8px;" }, [
    h("tbody", [
      h("tr", [
        h("td", { bgcolor: props.color ?? palette.ink, style: `background:${props.color ?? palette.ink};border-radius:6px;` }, [
          h("a", {
            href: props.href,
            target: "_blank",
            style: `display:inline-block;padding:13px 24px;font-family:${fonts.sans};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;`,
          }, slots.default?.()),
        ]),
      ]),
    ]),
  ])

export function Items(items: EmailOrderItem[], currency: string, locale?: string) {
  return table("margin-top:10px;", items.map(item =>
    h("tr", [
      h("td", { width: 64, valign: "top", style: `padding:14px 0;border-top:1px solid ${palette.line};width:64px;` }, [
        item.thumbnail
          ? h("img", { src: item.thumbnail, alt: "", width: 52, height: 52, style: `display:block;width:52px;height:52px;object-fit:cover;border-radius:4px;background:${palette.paper};border:0;` })
          : h("div", { style: `width:52px;height:52px;border-radius:4px;background:${palette.paper};` }),
      ]),
      h("td", { valign: "top", style: `padding:14px 12px 14px 0;border-top:1px solid ${palette.line};font-family:${fonts.sans};font-size:14px;line-height:1.5;color:${palette.ink};` }, [
        item.title,
        h("br"),
        h("span", { style: `color:${palette.muted};font-size:13px;` }, [item.subtitle ? `${item.subtitle} · ` : "", `Qty ${item.quantity}`]),
      ]),
      h("td", { valign: "top", align: "right", style: `padding:14px 0;border-top:1px solid ${palette.line};font-family:${fonts.sans};font-size:14px;color:${palette.ink};white-space:nowrap;` }, money(item.total, currency, locale)),
    ]),
  ))
}

export function Totals(order: EmailOrder, locale?: string) {
  const row = (label: string, value: string, strong = false) =>
    h("tr", [
      h("td", { style: `padding:${strong ? "12px" : "4px"} 0 4px;font-family:${fonts.sans};font-size:${strong ? 15 : 14}px;color:${strong ? palette.ink : palette.muted};${strong ? `border-top:1px solid ${palette.line};font-weight:600;` : ""}` }, label),
      h("td", { align: "right", style: `padding:${strong ? "12px" : "4px"} 0 4px;font-family:${fonts.sans};font-size:${strong ? 15 : 14}px;color:${palette.ink};${strong ? `border-top:1px solid ${palette.line};font-weight:600;` : ""}` }, value),
    ])
  const m = (n: number) => money(n, order.currency_code, locale)
  return table(`margin-top:4px;border-top:1px solid ${palette.line};padding-top:8px;`, [
    h("tr", [h("td", { colspan: 2, style: "height:8px;" })]),
    row("Subtotal", m(order.subtotal)),
    order.discount_total > 0 ? row("Discount", `−${m(order.discount_total)}`) : null,
    row("Shipping", order.shipping_total > 0 ? m(order.shipping_total) : "Free"),
    order.tax_total > 0 ? row("Tax", m(order.tax_total)) : null,
    row("Total", m(order.total), true),
  ])
}

export function Address(title: string, address: EmailAddress | null | undefined, extra?: string | null) {
  if (!address && !extra) {
    return null
  }
  return [
    h(SectionTitle, () => title),
    h("p", { style: `margin:0;font-family:${fonts.sans};font-size:14px;line-height:1.6;color:${palette.ink};` }, [
      ...(address ? [address.name, ...address.lines].flatMap((line, i) => (i ? [h("br"), line] : [line])) : []),
      extra ? [address ? h("br") : null, h("span", { style: `color:${palette.muted};` }, extra)] : null,
    ]),
  ]
}
