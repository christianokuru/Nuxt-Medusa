import type { NavigationMenuItem } from "@nuxt/ui"

// Main sidebar links. Items without a page yet are shown as disabled.
// Later, plugins will be able to add their own items here.
export const mainNavigation: NavigationMenuItem[] = [
  { label: "Orders", icon: "i-lucide-shopping-cart", disabled: true, badge: "Soon" },
  { label: "Products", icon: "i-lucide-tag", to: "/products" },
  { label: "Inventory", icon: "i-lucide-boxes", disabled: true, badge: "Soon" },
  { label: "Customers", icon: "i-lucide-users", disabled: true, badge: "Soon" },
  { label: "Promotions", icon: "i-lucide-badge-percent", disabled: true, badge: "Soon" },
  { label: "Price Lists", icon: "i-lucide-receipt", disabled: true, badge: "Soon" },
]

export const footerNavigation: NavigationMenuItem[] = [
  { label: "Settings", icon: "i-lucide-settings", disabled: true, badge: "Soon" },
]
