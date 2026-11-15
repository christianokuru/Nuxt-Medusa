// Helpers for the home page (dashboard). The numbers come from GET /admin/analytics
// (src/api/admin/analytics/route.ts in this package).

export type DashboardRangeKey = "today" | "7d" | "30d" | "90d"

export const dashboardRanges: { value: DashboardRangeKey, label: string, days: number, compareLabel: string }[] = [
  { value: "today", label: "Today", days: 1, compareLabel: "same time yesterday" },
  { value: "7d", label: "7 days", days: 7, compareLabel: "previous 7 days" },
  { value: "30d", label: "30 days", days: 30, compareLabel: "previous 30 days" },
  { value: "90d", label: "90 days", days: 90, compareLabel: "previous 90 days" },
]

export interface DashboardBucket { key: string, sales: number, orders: number }

export interface DashboardSummary {
  range: { from: string, to: string, previous_from: string, previous_to: string, interval: "day" | "hour" }
  orders: { current: number, previous: number }
  customers: { current: number, previous: number }
  sales: {
    currency_code: string
    current: { sales: number, orders: number }
    previous: { sales: number, orders: number }
    buckets: DashboardBucket[]
  }[]
  top_products: { product_id: string | null, title: string, thumbnail: string | null, quantity: number }[]
  attention: {
    to_pack: number
    to_ship: number
    to_collect: number
    low_stock: number
    out_of_stock: number
    stock_items: { id: string, title: string, available: number }[]
  }
  truncated: boolean
}

const pad = (n: number) => String(n).padStart(2, "0")
export const localDayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function startOfDay(d: Date) {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(d: Date, days: number) {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + days)
  return copy
}

/** Query for the backend. The previous period ends at the same time of day, `days` earlier. */
export function dashboardQuery(key: DashboardRangeKey, now = new Date()) {
  const { days } = dashboardRanges.find(r => r.value === key)!
  const from = addDays(startOfDay(now), -(days - 1))
  return {
    from: from.toISOString(),
    to: now.toISOString(),
    compare_from: addDays(from, -days).toISOString(),
    interval: key === "today" ? "hour" : "day",
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}

export interface ChartBar { label: string, detail: string, sales: number, orders: number }

/**
 * Bars for the chart, with empty days/hours filled in.
 * Today: 24 hours. 7 and 30 days: one bar a day. 90 days: one bar a week.
 */
export function chartBars(key: DashboardRangeKey, buckets: DashboardBucket[], now = new Date()): ChartBar[] {
  const byKey = new Map(buckets.map(b => [b.key, b]))
  const dayLabel = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" })
  const longDay = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" })

  if (key === "today") {
    const today = localDayKey(now)
    const hour = new Intl.DateTimeFormat(undefined, { hour: "numeric" })
    return Array.from({ length: 24 }, (_, h) => {
      const b = byKey.get(`${today}T${pad(h)}`)
      const at = new Date(now)
      at.setHours(h, 0, 0, 0)
      const next = new Date(at)
      next.setHours(h + 1)
      return { label: hour.format(at), detail: `${hour.format(at)} – ${hour.format(next)}`, sales: b?.sales ?? 0, orders: b?.orders ?? 0 }
    })
  }

  const { days } = dashboardRanges.find(r => r.value === key)!
  const start = addDays(startOfDay(now), -(days - 1))
  const daily = Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i)
    const b = byKey.get(localDayKey(date))
    return { date, sales: b?.sales ?? 0, orders: b?.orders ?? 0 }
  })

  if (key !== "90d") {
    return daily.map(d => ({ label: dayLabel.format(d.date), detail: longDay.format(d.date), sales: d.sales, orders: d.orders }))
  }

  const weeks: ChartBar[] = []
  for (let i = 0; i < daily.length; i += 7) {
    const chunk = daily.slice(i, i + 7)
    const first = chunk[0]!.date
    const last = chunk[chunk.length - 1]!.date
    weeks.push({
      label: dayLabel.format(first),
      detail: `${dayLabel.format(first)} – ${dayLabel.format(last)}`,
      sales: chunk.reduce((s, d) => s + d.sales, 0),
      orders: chunk.reduce((s, d) => s + d.orders, 0),
    })
  }
  return weeks
}

/** Percentage change, or null when there's nothing to compare with. */
export function change(current: number, previous: number) {
  if (!previous) {
    return null
  }
  return ((current - previous) / previous) * 100
}

/** A round number at or above `max`, for the chart's top line. */
export function niceCeiling(max: number) {
  if (max <= 0) {
    return 1
  }
  const power = 10 ** Math.floor(Math.log10(max))
  const step = [1, 2, 2.5, 5, 10].find(s => s * power >= max)!
  return step * power
}

export function formatMoneyCompact(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      notation: amount >= 10_000 ? "compact" : "standard",
      maximumFractionDigits: amount >= 10_000 ? 1 : 0,
    }).format(amount)
  }
  catch {
    return String(Math.round(amount))
  }
}

export function greeting(now = new Date()) {
  const h = now.getHours()
  if (h < 12) {
    return "Good morning"
  }
  if (h < 18) {
    return "Good afternoon"
  }
  return "Good evening"
}
