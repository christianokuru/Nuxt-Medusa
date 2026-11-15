import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import ResendNotificationProviderService from "./service"

export { ResendNotificationProviderService }
export type { ResendProviderOptions } from "./service"

// Medusa notification provider. In medusa-config.ts, under the notification module:
// { resolve: "@nuxt-medusa/medusa-resend/providers/resend", id: "resend",
//   options: { channels: ["email"], apiKey, from, replyTo } }
export default ModuleProvider(Modules.NOTIFICATION, {
  services: [ResendNotificationProviderService],
})
