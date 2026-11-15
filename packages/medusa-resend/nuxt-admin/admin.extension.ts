import { defineAdminExtension } from "@nuxt-medusa/admin-kit/define"

export default defineAdminExtension({
  id: "resend-emails",
  name: "Order emails",
  settings: [{ label: "Emails", to: "/settings/emails", icon: "i-lucide-mail", order: 30 }],
  widgets: [
    { zone: "order.details.after", component: () => import("./app/components/emails/OrderEmails.vue"), order: 50 },
  ],
})
