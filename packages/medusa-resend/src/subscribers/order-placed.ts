import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendFromEvent } from "../lib/send"

export default async function orderPlacedEmail({ event, container }: SubscriberArgs<{ id: string }>) {
  await sendFromEvent(container, "order-placed", {
    orderId: event.data.id,
    idempotencyKey: `order-placed:${event.data.id}`,
    trigger: event.name,
  })
}

export const config: SubscriberConfig = { event: "order.placed" }
