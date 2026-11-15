import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { getOrdersListWorkflow } from "@medusajs/medusa/core-flows"

// Summary for the admin home page: sales, orders, new customers, best sellers
// and the things that need attention. Admin routes need a logged-in admin.
//
// GET /admin/analytics?from=<ISO>&to=<ISO>&tz=<IANA time zone>&interval=day|hour&compare_from=<ISO>
// The previous period (for "vs last period") has the same length and starts at
// `compare_from` (default: right before `from`). Sales are grouped by local day or hour.

const PAGE = 200
// Safety limit so a very large store can't make one request load everything.
const MAX_ROWS = 5000
const LOW_STOCK = 10
const MAX_RANGE_DAYS = 400

type OrderRow = {
  id: string
  created_at: string | Date
  currency_code: string
  status: string
  total?: number | string | null
  payment_status?: string
  fulfillment_status?: string
  items?: {
    product_id?: string | null
    product_title?: string | null
    title?: string | null
    thumbnail?: string | null
    quantity?: number | string | null
  }[]
}

const num = (value: unknown) => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function parseDate(value: unknown, name: string) {
  const date = typeof value === "string" ? new Date(value) : new Date(Number.NaN)
  if (Number.isNaN(date.getTime())) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `"${name}" must be a date`)
  }
  return date
}

// Turns a date into a local bucket key: "2026-11-15" (day) or "2026-11-15T14" (hour).
function bucketKey(tz: unknown, interval: "day" | "hour") {
  const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" }
  if (interval === "hour") {
    options.hour = "2-digit"
    options.hourCycle = "h23"
  }
  let format: Intl.DateTimeFormat
  try {
    format = new Intl.DateTimeFormat("en-CA", { ...options, timeZone: typeof tz === "string" && tz ? tz : "UTC" })
  }
  catch {
    format = new Intl.DateTimeFormat("en-CA", { ...options, timeZone: "UTC" })
  }
  return (date: Date) => {
    const parts = Object.fromEntries(format.formatToParts(date).map(p => [p.type, p.value]))
    const day = `${parts.year}-${parts.month}-${parts.day}`
    return interval === "hour" ? `${day}T${parts.hour}` : day
  }
}

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const to = parseDate(req.query.to, "to")
  const from = parseDate(req.query.from, "from")
  const length = to.getTime() - from.getTime()
  if (length <= 0 || length > MAX_RANGE_DAYS * 86_400_000) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `The range must be between 1 and ${MAX_RANGE_DAYS} days`)
  }
  const previousFrom = req.query.compare_from ? parseDate(req.query.compare_from, "compare_from") : new Date(from.getTime() - length)
  const previousTo = new Date(previousFrom.getTime() + length)
  if (previousTo > from) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "The previous period must end before \"from\"")
  }
  const interval = req.query.interval === "hour" ? "hour" : "day"
  const toBucket = bucketKey(req.query.tz, interval)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  let truncated = false

  async function listOrders(filters: Record<string, unknown>, fields: string[]) {
    const rows: OrderRow[] = []
    for (let skip = 0; ; skip += PAGE) {
      const { result } = await getOrdersListWorkflow(req.scope).run({
        input: {
          fields,
          variables: { filters: { ...filters, is_draft_order: false }, skip, take: PAGE, order: { created_at: "DESC" } },
        },
      })
      const page = (result as { rows: OrderRow[] }).rows
      rows.push(...page)
      if (page.length < PAGE) {
        return rows
      }
      if (rows.length >= MAX_ROWS) {
        truncated = true
        return rows
      }
    }
  }

  const [periodOrders, openOrders, customers, previousCustomers, inventory] = await Promise.all([
    listOrders(
      { created_at: { $gte: previousFrom.toISOString(), $lt: to.toISOString() } },
      ["id", "created_at", "currency_code", "status", "total", "items.product_id", "items.product_title", "items.title", "items.thumbnail", "items.quantity"],
    ),
    listOrders({ status: ["pending"] }, ["id", "status", "payment_status", "fulfillment_status"]),
    query.graph({
      entity: "customer",
      fields: ["id"],
      filters: { created_at: { $gte: from.toISOString(), $lt: to.toISOString() } },
      pagination: { take: 1, skip: 0 },
    }),
    query.graph({
      entity: "customer",
      fields: ["id"],
      filters: { created_at: { $gte: previousFrom.toISOString(), $lt: previousTo.toISOString() } },
      pagination: { take: 1, skip: 0 },
    }),
    listInventory(),
  ])

  async function listInventory() {
    const items: { id: string, title: string, available: number }[] = []
    for (let skip = 0; ; skip += PAGE) {
      const { data } = await query.graph({
        entity: "inventory_item",
        fields: ["id", "sku", "title", "location_levels.stocked_quantity", "location_levels.reserved_quantity", "variants.title", "variants.product.title"],
        pagination: { take: PAGE, skip },
      })
      for (const item of data as any[]) {
        const levels = item.location_levels ?? []
        // Items not stocked anywhere aren't tracked yet, so they're not "out of stock".
        if (!levels.length) {
          continue
        }
        const stock = levels.reduce((sum: number, l: any) => sum + num(l.stocked_quantity) - num(l.reserved_quantity), 0)
        const variant = item.variants?.[0]
        const title = [variant?.product?.title, variant?.title].filter(Boolean).join(" · ") || item.title || item.sku || "Item"
        items.push({ id: item.id, title, available: stock })
      }
      if (data.length < PAGE) {
        return items
      }
      if (skip + PAGE >= MAX_ROWS) {
        truncated = true
        return items
      }
    }
  }

  // Sales by currency and by day. Cancelled orders don't count as sales.
  type Bucket = { sales: number, orders: number }
  const currencies = new Map<string, { current: Bucket, previous: Bucket, days: Map<string, Bucket> }>()
  const products = new Map<string, { product_id: string | null, title: string, thumbnail: string | null, quantity: number }>()
  let orders = 0
  let previousOrders = 0

  for (const order of periodOrders) {
    if (order.status === "canceled" || order.status === "draft") {
      continue
    }
    const created = new Date(order.created_at)
    const isCurrent = created >= from
    // Orders between the two periods belong to neither.
    if (!isCurrent && created >= previousTo) {
      continue
    }
    const code = order.currency_code
    if (!currencies.has(code)) {
      currencies.set(code, { current: { sales: 0, orders: 0 }, previous: { sales: 0, orders: 0 }, days: new Map() })
    }
    const entry = currencies.get(code)!
    const bucket = isCurrent ? entry.current : entry.previous
    bucket.sales += num(order.total)
    bucket.orders += 1

    if (!isCurrent) {
      previousOrders += 1
      continue
    }
    orders += 1
    const day = toBucket(created)
    const daily = entry.days.get(day) ?? { sales: 0, orders: 0 }
    daily.sales += num(order.total)
    daily.orders += 1
    entry.days.set(day, daily)

    for (const item of order.items ?? []) {
      const key = item.product_id ?? item.product_title ?? item.title ?? "unknown"
      const product = products.get(key) ?? {
        product_id: item.product_id ?? null,
        title: item.product_title ?? item.title ?? "Product",
        thumbnail: item.thumbnail ?? null,
        quantity: 0,
      }
      product.quantity += num(item.quantity)
      products.set(key, product)
    }
  }

  const count = (statuses: string[], field: "payment_status" | "fulfillment_status") =>
    openOrders.filter(o => statuses.includes(o[field] ?? "")).length

  const lowStock = inventory.filter(i => i.available > 0 && i.available <= LOW_STOCK)
  const outOfStock = inventory.filter(i => i.available <= 0)

  res.json({
    range: { from: from.toISOString(), to: to.toISOString(), previous_from: previousFrom.toISOString(), previous_to: previousTo.toISOString(), interval },
    orders: { current: orders, previous: previousOrders },
    customers: {
      current: customers.metadata?.count ?? 0,
      previous: previousCustomers.metadata?.count ?? 0,
    },
    sales: [...currencies.entries()]
      .map(([currency_code, entry]) => ({
        currency_code,
        current: entry.current,
        previous: entry.previous,
        buckets: [...entry.days.entries()].map(([key, b]) => ({ key, ...b })).sort((a, b) => a.key.localeCompare(b.key)),
      }))
      .sort((a, b) => b.current.orders - a.current.orders),
    top_products: [...products.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    attention: {
      to_pack: count(["not_fulfilled", "partially_fulfilled"], "fulfillment_status"),
      to_ship: count(["fulfilled", "partially_shipped"], "fulfillment_status"),
      to_collect: count(["authorized", "partially_authorized"], "payment_status"),
      low_stock: lowStock.length,
      out_of_stock: outOfStock.length,
      stock_items: [...outOfStock, ...lowStock].sort((a, b) => a.available - b.available).slice(0, 5),
    },
    truncated,
  })
}
