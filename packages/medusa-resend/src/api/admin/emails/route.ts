import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { templateNames, templates } from "../../../templates"
import { emailEnabled, pluginOptions, resendProvider } from "../../../lib/options"

// GET /admin/emails -> is sending set up, and which emails exist.
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const options = pluginOptions(req.scope)
  const provider = resendProvider(req.scope)
  res.json({
    configured: !!provider,
    from: provider?.from ?? null,
    templates: templateNames.map(name => ({
      name,
      label: templates[name].label,
      description: templates[name].description,
      enabled: emailEnabled(options, name),
    })),
  })
}
