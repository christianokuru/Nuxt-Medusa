import type { Component } from "vue"
import type { HttpTypes } from "@medusajs/types"

/**
 * Every spot in the admin where extensions can add widgets,
 * and the data each widget there receives as its `data` prop.
 *
 * To add a zone: add it here, then place `<AdminZone name="..." :data="..." />` in a page.
 */
export interface AdminZones {
  "dashboard.before": AdminDashboardZoneData
  "dashboard.after": AdminDashboardZoneData
  "product.list.before": Record<string, never>
  "product.list.after": Record<string, never>
  "product.details.before": AdminProductZoneData
  "product.details.after": AdminProductZoneData
  "order.list.before": Record<string, never>
  "order.details.before": AdminOrderZoneData
  "order.details.after": AdminOrderZoneData
  "customer.details.before": AdminCustomerZoneData
  "customer.details.after": AdminCustomerZoneData
}

export interface AdminDashboardZoneData {
  /** The time period picked on the home page. */
  range: "today" | "7d" | "30d" | "90d"
  /** Reload the home page figures. */
  refresh: () => Promise<void>
}

export interface AdminOrderZoneData {
  order: HttpTypes.AdminOrder
  /** Reload the order after the widget changes it. */
  refresh: () => Promise<void>
}

export interface AdminCustomerZoneData {
  customer: HttpTypes.AdminCustomer
  /** Reload the customer after the widget changes it. */
  refresh: () => Promise<void>
}

export interface AdminProductZoneData {
  product: HttpTypes.AdminProduct
  /** Reload the product after the widget changes it. */
  refresh: () => Promise<void>
}

export type AdminZoneName = keyof AdminZones

export const adminZoneNames = [
  "dashboard.before",
  "dashboard.after",
  "product.list.before",
  "product.list.after",
  "product.details.before",
  "product.details.after",
  "order.list.before",
  "order.details.before",
  "order.details.after",
  "customer.details.before",
  "customer.details.after",
] as const satisfies readonly AdminZoneName[]

/** Props a widget component receives: `defineProps<AdminWidgetProps<"product.details.after">>()` */
export interface AdminWidgetProps<Z extends AdminZoneName = AdminZoneName> {
  data: AdminZones[Z]
}

export interface AdminWidget<Z extends AdminZoneName = AdminZoneName> {
  /** Zone (or zones) to show the widget in. */
  zone: Z | Z[]
  /** Lazy component: `() => import("./components/MyWidget.vue")` */
  component: () => Promise<Component | { default: Component }>
  /** Lower numbers show first. Default 100. */
  order?: number
}

export interface AdminNavItem {
  label: string
  /** Page path, e.g. "/reviews". Add the page to the extension's `app/pages`. */
  to: string
  /** Lucide icon, e.g. "i-lucide-star". */
  icon?: string
  /** Sidebar group. An existing group ("Commerce", "Marketing") or a new one. Default "Extensions". */
  group?: string
  /** Lower numbers show first within the group. Default 100. */
  order?: number
}

export interface AdminExtension {
  /** Unique id, e.g. "acme-reviews". */
  id: string
  /** Human name, shown in error messages. */
  name?: string
  widgets?: AdminWidget[]
  nav?: AdminNavItem[]
}

/** Describe an extension. Put this in `admin.extension.ts` at the root of a Nuxt layer. */
export function defineAdminExtension(extension: AdminExtension): AdminExtension {
  return extension
}

/** Type helper for a single widget, so `zone` is checked. */
export function defineAdminWidget<Z extends AdminZoneName>(widget: AdminWidget<Z>): AdminWidget<Z> {
  return widget
}
