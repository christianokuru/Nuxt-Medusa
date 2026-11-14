import type { NavigationMenuItem } from "@nuxt/ui"

// Sidebar links, grouped. Items without a page yet are disabled.
// Later, plugins will be able to add their own items here.
export const navigationGroups: { label: string, items: NavigationMenuItem[] }[] = [
  {
    label: "Commerce",
    items: [
      { label: "Orders", icon: "i-lucide-shopping-bag", disabled: true },
      { label: "Products", icon: "i-lucide-tag", to: "/products" },
      { label: "Inventory", icon: "i-lucide-boxes", disabled: true },
      { label: "Customers", icon: "i-lucide-users", disabled: true },
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
  { label: "Settings", icon: "i-lucide-settings-2", disabled: true },
]
