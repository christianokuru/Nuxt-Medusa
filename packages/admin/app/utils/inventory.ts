import type { HttpTypes } from "@medusajs/types"
import type { DotTone } from "../components/app/Dot.vue"

export const LOW_STOCK = 10

export type InventoryItem = HttpTypes.AdminInventoryItem & {
  variants?: { id: string, title?: string | null, product?: { id: string, title?: string | null, thumbnail?: string | null } | null }[]
}

export function available(item: Pick<HttpTypes.AdminInventoryItem, "stocked_quantity" | "reserved_quantity">) {
  return Number(item.stocked_quantity ?? 0) - Number(item.reserved_quantity ?? 0)
}

export function stockState(qty: number): { label: string, tone: DotTone } {
  if (qty <= 0) {
    return { label: "Out of stock", tone: "error" }
  }
  if (qty <= LOW_STOCK) {
    return { label: "Low stock", tone: "warning" }
  }
  return { label: "In stock", tone: "success" }
}

export function inventoryTitle(item: InventoryItem) {
  const variant = item.variants?.[0]
  return {
    product: variant?.product?.title ?? item.title ?? item.sku ?? "Item",
    variant: variant?.title ?? item.title ?? "",
    thumbnail: variant?.product?.thumbnail ?? item.thumbnail ?? null,
    productId: variant?.product?.id ?? null,
  }
}

const numberFormat = new Intl.NumberFormat()
export const formatCount = (n: number) => numberFormat.format(n)
