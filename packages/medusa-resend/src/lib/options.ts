import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import type { EmailBrand, TemplateName } from "../templates"

export const PLUGIN_NAME = "@nuxt-medusa/medusa-resend"

/** Options for the plugin entry in medusa-config.ts (`plugins`). */
export interface ResendPluginOptions {
  /** Store details shown in the emails. `name` defaults to Medusa's store name. */
  brand?: Partial<EmailBrand>
  /**
   * Link to an order on your store. `{id}` and `{display_id}` are replaced,
   * e.g. "https://shop.example.com/account/orders/{id}". Leave out to hide the link.
   */
  orderUrl?: string
  /** Turn single emails off, e.g. { "order-delivered": false }. All are on by default. */
  emails?: Partial<Record<TemplateName, boolean>>
}

type ConfigModule = {
  plugins?: (string | { resolve: string, options?: Record<string, unknown> })[]
  modules?: Record<string, unknown> | unknown[]
}

export function pluginOptions(container: MedusaContainer): ResendPluginOptions {
  const config = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as ConfigModule
  const entry = config.plugins?.find(p => (typeof p === "string" ? p : p.resolve) === PLUGIN_NAME)
  return (typeof entry === "object" ? entry.options : undefined) ?? {}
}

/** The Resend provider's settings from the notification module, if it's set up. */
export function resendProvider(container: MedusaContainer): { from?: string } | null {
  const config = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as ConfigModule
  const modules = Array.isArray(config.modules)
    ? config.modules
    : Object.entries(config.modules ?? {}).map(([key, value]) => ({ key, ...(value as object) }))
  const notification = modules.find((m) => {
    const mod = m as { key?: string, resolve?: string }
    return mod.key === Modules.NOTIFICATION || mod.resolve === "@medusajs/medusa/notification"
  }) as { options?: { providers?: { resolve?: string, options?: { from?: string, channels?: string[] } }[] } } | undefined
  const provider = notification?.options?.providers?.find(p => p.resolve?.includes("medusa-resend"))
  return provider ? { from: provider.options?.from } : null
}

export function emailEnabled(options: ResendPluginOptions, template: TemplateName) {
  return options.emails?.[template] !== false
}
