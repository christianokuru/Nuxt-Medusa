import type { HttpTypes } from "@medusajs/types"

export const productStatuses = [
  { label: "Published", value: "published", description: "Visible in your store" },
  { label: "Draft", value: "draft", description: "Only visible here" },
  { label: "Proposed", value: "proposed", description: "Waiting for review" },
  { label: "Rejected", value: "rejected", description: "Not accepted" },
] as const

export type ProductStatus = (typeof productStatuses)[number]["value"]

export const productStatusFilters = [
  { label: "All", value: "all" },
  ...productStatuses.map(s => ({ label: s.label, value: s.value })),
] as const

export type ProductStatusFilter = (typeof productStatusFilters)[number]["value"]

// Colour of the small dot shown next to a status.
export function statusDotClass(status?: string | null) {
  switch (status) {
    case "published":
      return "bg-emerald-500"
    case "proposed":
      return "bg-amber-500"
    case "rejected":
      return "bg-rose-500"
    default:
      return "bg-stone-400 dark:bg-stone-500"
  }
}

export function capitalize(value?: string | null) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : ""
}

// Turn a title into a URL handle: "Summer Dress" -> "summer-dress".
export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// Every combination of option values: [[S, M], [Red]] -> [[S, Red], [M, Red]].
export function combinations(lists: string[][]): string[][] {
  return lists.reduce<string[][]>(
    (acc, list) => acc.flatMap(combo => list.map(value => [...combo, value])),
    [[]],
  )
}

// "M · Red" for a variant, in the product's option order.
// Returns null when it would only repeat the variant's name.
export function variantOptionLabel(
  variant: HttpTypes.AdminProductVariant,
  productOptions: HttpTypes.AdminProductOption[] = [],
) {
  const order = productOptions.map(o => o.id)
  const values = [...(variant.options ?? [])]
    .filter(o => !isDefaultOption(o.option ?? productOptions.find(p => p.id === o.option_id)))
    .sort((a, b) => order.indexOf(a.option_id ?? "") - order.indexOf(b.option_id ?? ""))
    .map(o => o.value)
    .filter(Boolean)
  if (!values.length) {
    return null
  }
  // Compare as sets of words, so "S / Sand" and "Sand · S" count as the same.
  const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).sort().join(" ")
  return words(values.join(" ")) === words(variant.title ?? "") ? null : values.join(" · ")
}

export const DEFAULT_OPTION_TITLE = "Default option"
export const DEFAULT_OPTION_VALUE = "Default option value"

// Medusa returns a product's options in no fixed order. Sort them by
// creation time (then id) so they always show in the same order.
export function sortOptions<T extends { id: string, created_at?: string | Date | null }>(options: T[] | null | undefined): T[] {
  return [...(options ?? [])].sort((a, b) => {
    const time = new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
    return time || a.id.localeCompare(b.id)
  })
}

// Options in the order the product's variant names use ("S / Sand" -> Size, Colour),
// falling back to creation order. Keeps names and dropdowns consistent.
export function productOptionsInOrder(product: HttpTypes.AdminProduct | null | undefined) {
  const options = sortOptions(product?.options)
  const parts = (product?.variants?.[0]?.title ?? "").split(" / ").map(s => s.trim())
  const position = (o: HttpTypes.AdminProductOption) => {
    const i = parts.findIndex(p => (o.values ?? []).some(v => v.value === p))
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  return options
    .map((o, index) => ({ o, index, pos: position(o) }))
    .sort((a, b) => a.pos - b.pos || a.index - b.index)
    .map(x => x.o)
}

// Products without real options get one hidden "Default option".
export function isDefaultOption(option?: { title?: string | null }) {
  return option?.title === DEFAULT_OPTION_TITLE
}
