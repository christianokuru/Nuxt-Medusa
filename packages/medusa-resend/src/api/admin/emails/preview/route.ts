import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { isTemplateName, renderEmail, sampleOrderEmailData } from "../../../../templates"
import { pluginOptions } from "../../../../lib/options"
import { orderEmailData, storeBrand } from "../../../../lib/order-email-data"

// GET /admin/emails/preview?template=order-placed[&order_id=...]
// Renders an email with a made-up order, or with a real one when order_id is given.
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { template, order_id, currency } = req.query as Record<string, string | undefined>
  if (!isTemplateName(template)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Unknown email template.")
  }
  const options = pluginOptions(req.scope)
  const data = order_id
    ? await orderEmailData(req.scope, order_id, options)
    : sampleOrderEmailData(await storeBrand(req.scope, options), currency || "usd")
  res.json(await renderEmail(template, data))
}
