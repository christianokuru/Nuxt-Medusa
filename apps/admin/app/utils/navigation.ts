import type { NavigationMenuItem } from "@nuxt/ui"

// Sidebar links, grouped. Items without a page yet are disabled.
// Extensions add their own links (see layouts/default.vue).
// The Home link comes from the analytics extension (@nuxt-medusa/medusa-analytics).
export const navigationGroups: { label: string, items: NavigationMenuItem[] }[] = [
  {
    label: "Commerce",
    items: [
      { label: "Orders", icon: "i-lucide-shopping-bag", to: "/orders" },
      { label: "Products", icon: "i-lucide-tag", to: "/products" },
      { label: "Inventory", icon: "i-lucide-boxes", to: "/inventory" },
      { label: "Customers", icon: "i-lucide-users", to: "/customers" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { label: "Promotions", icon: "i-lucide-badge-percent", disabled: true },
      { label: "Price lists", icon: "i-lucide-receipt", disabled: true },
    ],
  },
]

export const footerNavigation: NavigationMenuItem[] = [
  { label: "Settings", icon: "i-lucide-settings-2", to: "/settings" },
]
