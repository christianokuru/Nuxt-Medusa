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
  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  return normalise(values.join(" ")) === normalise(variant.title ?? "") ? null : values.join(" · ")
}

export const DEFAULT_OPTION_TITLE = "Default option"
export const DEFAULT_OPTION_VALUE = "Default option value"

// Products without real options get one hidden "Default option".
export function isDefaultOption(option?: { title?: string | null }) {
  return option?.title === DEFAULT_OPTION_TITLE
}
