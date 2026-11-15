import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { getOrderDetailWorkflow } from "@medusajs/medusa/core-flows"
import type { EmailAddress, EmailBrand, EmailOrderItem, OrderEmailData } from "../templates"
import type { ResendPluginOptions } from "./options"

const ORDER_FIELDS = [
  "id", "display_id", "created_at", "email", "currency_code",
  "total", "item_subtotal", "shipping_total", "discount_total", "tax_total",
  "items.id", "items.title", "items.product_title", "items.variant_title", "items.quantity", "items.subtotal", "items.thumbnail",
  "shipping_address.*", "shipping_methods.name",
  "customer.first_name", "customer.last_name",
  "fulfillments.id", "fulfillments.labels.*", "fulfillments.items.*",
]

type Num = number | string | { numeric?: number } | null | undefined
const num = (value: Num) => {
  const n = typeof value === "object" && value !== null ? Number(value.numeric) : Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" })
  }
  catch {
    return null
  }
})()

function address(a: Record<string, string | null | undefined> | null | undefined): EmailAddress | null {
  if (!a?.address_1) {
    return null
  }
  const cityLine = [a.city, a.province, a.postal_code].filter(Boolean).join(", ")
  const country = a.country_code ? regionNames?.of(a.country_code.toUpperCase()) ?? a.country_code.toUpperCase() : null
  return {
    name: [a.first_name, a.last_name].filter(Boolean).join(" ") || a.company || "",
    lines: [a.address_1, a.address_2, cityLine, country].filter((line): line is string => !!line),
  }
}

export async function storeBrand(container: MedusaContainer, options: ResendPluginOptions): Promise<EmailBrand> {
  let name = options.brand?.name
  if (!name) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({ entity: "store", fields: ["name"], pagination: { take: 1, skip: 0 } })
    name = (data[0] as { name?: string } | undefined)?.name || "Our store"
  }
  return { ...options.brand, name }
}

/**
 * Load an order and shape it for the email templates.
 * Pass `fulfillmentId` for shipped/delivered emails, to list only that shipment's items and tracking.
 */
export async function orderEmailData(
  container: MedusaContainer,
  orderId: string,
  options: ResendPluginOptions,
  fulfillmentId?: string,
): Promise<OrderEmailData> {
  const { result } = await getOrderDetailWorkflow(container).run({
    input: { order_id: orderId, fields: ORDER_FIELDS, filters: { is_draft_order: false } },
  })
  const order = result as any

  const items: (EmailOrderItem & { id: string })[] = (order.items ?? []).map((item: any) => ({
    id: item.id,
    title: item.product_title ?? item.title,
    subtitle: item.variant_title && item.variant_title !== "Default variant" ? item.variant_title : null,
    quantity: num(item.quantity),
    total: num(item.subtotal),
    thumbnail: item.thumbnail ?? null,
  }))

  const fulfillment = fulfillmentId ? (order.fulfillments ?? []).find((f: any) => f.id === fulfillmentId) : null
  const shipmentItems = fulfillment
    ? (fulfillment.items ?? []).map((fi: any) => {
        const item = items.find(i => i.id === fi.line_item_id)
        const quantity = num(fi.quantity)
        return {
          title: item?.title ?? fi.title,
          subtitle: item?.subtitle ?? null,
          quantity,
          total: item ? (item.total / (item.quantity || 1)) * quantity : 0,
          thumbnail: item?.thumbnail ?? null,
        }
      })
    : undefined

  const shipping = address(order.shipping_address)
  const customerName = [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(" ") || shipping?.name || null

  return {
    brand: await storeBrand(container, options),
    customer_name: customerName,
    order: {
      id: order.id,
      display_id: order.display_id,
      created_at: new Date(order.created_at).toISOString(),
      email: order.email,
      currency_code: order.currency_code,
      items: items.map(({ id: _id, ...rest }) => rest),
      subtotal: num(order.item_subtotal),
      shipping_total: num(order.shipping_total),
      discount_total: num(order.discount_total),
      tax_total: num(order.tax_total),
      total: num(order.total),
      shipping_address: shipping,
      shipping_method: order.shipping_methods?.[0]?.name ?? null,
      url: options.orderUrl
        ? options.orderUrl.replace("{id}", encodeURIComponent(order.id)).replace("{display_id}", String(order.display_id))
        : null,
    },
    tracking: fulfillment
      ? (fulfillment.labels ?? []).map((l: any) => ({ number: l.tracking_number || null, url: l.tracking_url && l.tracking_url !== "#" ? l.tracking_url : null }))
      : undefined,
    shipment_items: shipmentItems,
  }
}
