import { defineAdminExtension } from "@nuxt-medusa/admin-kit/define"

export default defineAdminExtension({
  id: "analytics",
  name: "Analytics",
  // An empty group puts the link at the very top of the sidebar, without a heading.
  nav: [{ label: "Home", to: "/", icon: "i-lucide-house", group: "", order: 0 }],
})
