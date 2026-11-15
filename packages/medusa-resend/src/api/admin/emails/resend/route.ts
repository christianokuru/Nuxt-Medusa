import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"

// POST /admin/emails/resend { notification_id, to? } -> send the same email again.
export const POST = async (req: AuthenticatedMedusaRequest<{ notification_id?: string, to?: string }>, res: MedusaResponse) => {
  const { notification_id, to } = req.body ?? {}
  if (typeof notification_id !== "string" || !notification_id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "notification_id is required.")
  }
  if (to !== undefined && (typeof to !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Enter a valid email address.")
  }
  const service = req.scope.resolve(Modules.NOTIFICATION)
  const original = await service.retrieveNotification(notification_id)
  if (original.channel !== "email") {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Only emails can be sent again.")
  }
  const [notification] = await service.createNotifications([{
    to: to ?? original.to,
    channel: "email",
    template: original.template,
    data: original.data,
    trigger_type: "admin.resend",
    resource_id: original.resource_id,
    resource_type: original.resource_type,
    original_notification_id: original.id,
  }])
  res.json({ notification: { id: notification?.id, status: notification?.status } })
}
