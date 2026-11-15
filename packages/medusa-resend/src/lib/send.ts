import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import type { TemplateName } from "../templates"
import { emailEnabled, pluginOptions, resendProvider } from "./options"
import { orderEmailData } from "./order-email-data"

/**
 * Build and send one order email. Used by the subscribers and the admin's "Send again".
 * `idempotencyKey` stops the same email going out twice (e.g. when an event is retried).
 */
export async function sendOrderEmail(
  container: MedusaContainer,
  template: TemplateName,
  input: { orderId: string, fulfillmentId?: string, to?: string, idempotencyKey?: string, trigger: string },
) {
  const options = pluginOptions(container)
  const data = await orderEmailData(container, input.orderId, options, input.fulfillmentId)
  const to = input.to ?? data.order.email
  if (!to) {
    throw new Error(`Order ${input.orderId} has no email address.`)
  }
  const notifications = container.resolve(Modules.NOTIFICATION)
  const [notification] = await notifications.createNotifications([{
    to,
    channel: "email",
    template,
    data: data as unknown as Record<string, unknown>,
    trigger_type: input.trigger,
    resource_id: input.orderId,
    resource_type: "order",
    idempotency_key: input.idempotencyKey,
  }])
  return notification
}

/** Subscriber helper: send unless turned off, and never break the order flow on failure. */
export async function sendFromEvent(
  container: MedusaContainer,
  template: TemplateName,
  input: { orderId: string, fulfillmentId?: string, idempotencyKey: string, trigger: string },
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  // Not set up yet (no Resend provider), or this email is turned off: skip quietly.
  if (!resendProvider(container) || !emailEnabled(pluginOptions(container), template)) {
    return
  }
  try {
    await sendOrderEmail(container, template, input)
  }
  catch (error) {
    logger.warn(`[medusa-resend] Could not send "${template}" for order ${input.orderId}: ${(error as Error).message}`)
  }
}

/** Find the order a fulfillment belongs to. */
export async function orderIdForFulfillment(container: MedusaContainer, fulfillmentId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order_fulfillment",
    fields: ["order_id"],
    filters: { fulfillment_id: fulfillmentId },
  })
  return (data[0] as { order_id?: string } | undefined)?.order_id ?? null
}
