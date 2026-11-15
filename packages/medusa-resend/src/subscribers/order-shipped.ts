import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { orderIdForFulfillment, sendFromEvent } from "../lib/send"

// `no_notification` is true when the admin chose not to notify the customer.
export default async function orderShippedEmail({ event, container }: SubscriberArgs<{ id: string, no_notification?: boolean }>) {
  if (event.data.no_notification) {
    return
  }
  const orderId = await orderIdForFulfillment(container, event.data.id)
  if (!orderId) {
    return
  }
  await sendFromEvent(container, "order-shipped", {
    orderId,
    fulfillmentId: event.data.id,
    idempotencyKey: `order-shipped:${event.data.id}`,
    trigger: event.name,
  })
}

export const config: SubscriberConfig = { event: "shipment.created" }
