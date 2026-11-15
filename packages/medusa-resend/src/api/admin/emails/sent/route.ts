import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"

// GET /admin/emails/sent?order_id=... -> emails sent for an order, newest first.
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const orderId = req.query.order_id
  if (typeof orderId !== "string" || !orderId) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "order_id is required.")
  }
  const notifications = await req.scope.resolve(Modules.NOTIFICATION).listNotifications(
    { resource_id: orderId, channel: "email" },
    { select: ["id", "to", "template", "status", "trigger_type", "created_at", "original_notification_id"], order: { created_at: "DESC" }, take: 50 },
  )
  res.json({ emails: notifications })
}
