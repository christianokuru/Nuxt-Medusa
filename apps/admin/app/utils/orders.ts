import type { HttpTypes } from "@medusajs/types"
import type { DotTone } from "~/components/app/Dot.vue"

type StatusInfo = { label: string, tone: DotTone }

const PAYMENT: Record<string, StatusInfo> = {
  not_paid: { label: "Not paid", tone: "warning" },
  awaiting: { label: "Awaiting payment", tone: "warning" },
  requires_action: { label: "Needs action", tone: "warning" },
  authorized: { label: "Authorised", tone: "info" },
  partially_authorized: { label: "Partly authorised", tone: "info" },
  captured: { label: "Paid", tone: "success" },
  partially_captured: { label: "Partly paid", tone: "info" },
  partially_refunded: { label: "Partly refunded", tone: "warning" },
  refunded: { label: "Refunded", tone: "neutral" },
  canceled: { label: "Cancelled", tone: "neutral" },
}

const FULFILLMENT: Record<string, StatusInfo> = {
  not_fulfilled: { label: "Not fulfilled", tone: "warning" },
  partially_fulfilled: { label: "Partly fulfilled", tone: "info" },
  fulfilled: { label: "Fulfilled", tone: "info" },
  partially_shipped: { label: "Partly shipped", tone: "info" },
  shipped: { label: "Shipped", tone: "success" },
  partially_delivered: { label: "Partly delivered", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
  canceled: { label: "Cancelled", tone: "neutral" },
}

const ORDER: Record<string, StatusInfo> = {
  pending: { label: "Open", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  canceled: { label: "Cancelled", tone: "neutral" },
  archived: { label: "Archived", tone: "neutral" },
  requires_action: { label: "Needs action", tone: "warning" },
  draft: { label: "Draft", tone: "neutral" },
}

const fallback = (value?: string | null): StatusInfo => ({ label: capitalize(value?.replace(/_/g, " ")) || "—", tone: "neutral" })

export const paymentStatus = (s?: string | null) => (s && PAYMENT[s]) || fallback(s)
export const fulfillmentStatus = (s?: string | null) => (s && FULFILLMENT[s]) || fallback(s)
export const orderStatus = (s?: string | null) => (s && ORDER[s]) || fallback(s)

export const orderStatusFilters = [
  { label: "All", value: "all" },
  { label: "Open", value: "pending" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "canceled" },
] as const

export function orderCustomerName(order: Pick<HttpTypes.AdminOrder, "customer" | "shipping_address" | "email">) {
  const fromCustomer = [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(" ")
  const fromAddress = [order.shipping_address?.first_name, order.shipping_address?.last_name].filter(Boolean).join(" ")
  return fromCustomer || fromAddress || order.email || "Guest"
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) {
    return "—"
  }
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value))
}

export function addressLines(address?: HttpTypes.AdminOrderAddress | null) {
  if (!address) {
    return []
  }
  return [
    [address.first_name, address.last_name].filter(Boolean).join(" "),
    address.company,
    address.address_1,
    address.address_2,
    [address.postal_code, address.city].filter(Boolean).join(" "),
    address.province,
    address.country_code ? countryName(address.country_code) : null,
  ].filter(Boolean) as string[]
}

/** A fulfilment with the items and labels the API returns when requested. */
export type OrderFulfillment = HttpTypes.AdminOrderFulfillment & {
  items?: { id: string, line_item_id?: string | null, quantity: number }[]
  labels?: { id: string, tracking_number?: string | null, tracking_url?: string | null }[]
}

/** Quantity of a line item that still needs to be fulfilled. */
export function remainingToFulfill(item: HttpTypes.AdminOrderLineItem) {
  const fulfilled = Number(item.detail?.fulfilled_quantity ?? 0)
  return Math.max(0, Number(item.quantity) - fulfilled)
}
