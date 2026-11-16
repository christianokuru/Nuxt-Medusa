import type { HttpTypes } from "@medusajs/types"

export function customerName(c: Pick<HttpTypes.AdminCustomer, "first_name" | "last_name" | "email">) {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Unnamed customer"
}

/** Second line under the name: the email, unless the name already is the email. */
export function customerSubtitle(c: Pick<HttpTypes.AdminCustomer, "first_name" | "last_name" | "email">) {
  return c.first_name || c.last_name ? (c.email ?? "") : ""
}

export function customerInitials(c: Pick<HttpTypes.AdminCustomer, "first_name" | "last_name" | "email">) {
  const parts = [c.first_name, c.last_name].filter(Boolean) as string[]
  const source = parts.length ? parts : [c.email ?? "?"]
  return source.map(p => p.charAt(0).toUpperCase()).join("").slice(0, 2)
}
