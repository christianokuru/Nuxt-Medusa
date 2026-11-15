import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import FlutterwaveProviderService from "./service"

export { FlutterwaveProviderService }
export type { FlutterwaveProviderOptions } from "./service"

// Medusa payment provider. In medusa-config.ts:
// { resolve: "@nuxt-medusa/flutterwave/medusa", id: "flutterwave", options: { secretKey, webhookHash, redirectUrl } }
export default ModuleProvider(Modules.PAYMENT, {
  services: [FlutterwaveProviderService],
})
