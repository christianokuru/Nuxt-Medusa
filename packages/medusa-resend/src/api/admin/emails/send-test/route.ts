import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { isTemplateName, sampleOrderEmailData } from "../../../../templates"
import { pluginOptions } from "../../../../lib/options"
import { storeBrand } from "../../../../lib/order-email-data"

// POST /admin/emails/send-test { template, to } -> sends the email with a made-up order.
export const POST = async (req: AuthenticatedMedusaRequest<{ template?: string, to?: string, currency?: string }>, res: MedusaResponse) => {
  const { template, to, currency } = req.body ?? {}
  if (!isTemplateName(template)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Unknown email template.")
  }
  if (typeof to !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Enter a valid email address.")
  }
  const data = sampleOrderEmailData(await storeBrand(req.scope, pluginOptions(req.scope)), currency || "usd")
  const [notification] = await req.scope.resolve(Modules.NOTIFICATION).createNotifications([{
    to,
    channel: "email",
    template,
    data: data as unknown as Record<string, unknown>,
    trigger_type: "admin.test",
    resource_type: "test",
  }])
  res.json({ notification: { id: notification?.id, status: notification?.status } })
}
