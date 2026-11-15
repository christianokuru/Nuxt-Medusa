import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import PaystackProviderService from "./service"

export { PaystackProviderService }
export type { PaystackProviderOptions } from "./service"

// Medusa payment provider. In medusa-config.ts:
// { resolve: "@nuxt-medusa/paystack/medusa", id: "paystack", options: { secretKey, callbackUrl } }
export default ModuleProvider(Modules.PAYMENT, {
  services: [PaystackProviderService],
})
