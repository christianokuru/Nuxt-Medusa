import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { orderIdForFulfillment, sendFromEvent } from "../lib/send"

export default async function orderDeliveredEmail({ event, container }: SubscriberArgs<{ id: string }>) {
  const orderId = await orderIdForFulfillment(container, event.data.id)
  if (!orderId) {
    return
  }
  await sendFromEvent(container, "order-delivered", {
    orderId,
    fulfillmentId: event.data.id,
    idempotencyKey: `order-delivered:${event.data.id}`,
    trigger: event.name,
  })
}

export const config: SubscriberConfig = { event: "delivery.created" }
