import type { EmailBrand, OrderEmailData } from "./types"

/** Made-up order for previews and test emails. */
export function sampleOrderEmailData(brand: EmailBrand, currency = "usd"): OrderEmailData {
  const items = [
    { title: "Linen Overshirt", subtitle: "Sand · M", quantity: 1, total: 120, thumbnail: null },
    { title: "Everyday Tee", subtitle: "Black · M", quantity: 2, total: 64, thumbnail: null },
  ]
  return {
    brand,
    customer_name: "Ada Okafor",
    order: {
      id: "order_sample",
      display_id: 1042,
      created_at: new Date().toISOString(),
      email: "ada@example.com",
      currency_code: currency,
      items,
      subtotal: 184,
      shipping_total: 8,
      discount_total: 10,
      tax_total: 0,
      total: 182,
      shipping_address: { name: "Ada Okafor", lines: ["12 Admiralty Way", "Lekki, Lagos 105102", "Nigeria"] },
      shipping_method: "Standard delivery",
      url: brand.storeUrl ? `${brand.storeUrl.replace(/\/$/, "")}/account/orders/order_sample` : null,
    },
    tracking: [{ number: "1Z999AA10123456784", url: "https://example.com/track/1Z999AA10123456784" }],
    shipment_items: [items[0]!],
  }
}
