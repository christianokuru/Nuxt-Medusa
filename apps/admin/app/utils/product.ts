export const productStatusOptions = [
  { label: "All statuses", value: "all" },
  { label: "Published", value: "published" },
  { label: "Draft", value: "draft" },
  { label: "Proposed", value: "proposed" },
  { label: "Rejected", value: "rejected" },
] as const

export type ProductStatusFilter = (typeof productStatusOptions)[number]["value"]

export function productStatusColor(status?: string) {
  switch (status) {
    case "published":
      return "success" as const
    case "proposed":
      return "warning" as const
    case "rejected":
      return "error" as const
    default:
      return "neutral" as const
  }
}

export function capitalize(value?: string | null) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : ""
}
