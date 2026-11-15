import { AbstractNotificationProviderService, MedusaError } from "@medusajs/framework/utils"
import type { Logger, ProviderSendNotificationDTO, ProviderSendNotificationResultsDTO } from "@medusajs/framework/types"
import { Resend } from "resend"
import { isTemplateName, renderEmail, type OrderEmailData } from "../../templates"

export type ResendProviderOptions = {
  /** Resend API key: re_... */
  apiKey: string
  /** Sender, e.g. "Acme <orders@acme.com>". The domain must be verified in Resend. */
  from: string
  /** Where customer replies go, e.g. "help@acme.com". */
  replyTo?: string
}

/**
 * Sends Medusa notifications on the "email" channel through Resend.
 *
 * - With `template` set to one of this plugin's templates (order-placed, order-shipped,
 *   order-delivered), the email is rendered from `data`.
 * - With `content` ({ subject, html, text }), that content is sent as is. Any other
 *   plugin or workflow can use this to send its own emails.
 */
class ResendNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "notification-resend"

  protected options_: ResendProviderOptions
  protected logger_: Logger
  protected client_: Resend

  static validateOptions(options: Record<string, unknown>) {
    if (!options?.apiKey) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Resend: the `apiKey` option is required.")
    }
    if (!options?.from) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Resend: the `from` option is required, e.g. \"Acme <orders@acme.com>\".")
    }
  }

  constructor(container: { logger: Logger }, options: ResendProviderOptions) {
    super()
    this.options_ = options
    this.logger_ = container.logger
    this.client_ = new Resend(options.apiKey)
  }

  async send(notification: ProviderSendNotificationDTO): Promise<ProviderSendNotificationResultsDTO> {
    let subject = notification.content?.subject
    let html = notification.content?.html
    let text = notification.content?.text

    if (!html && !text) {
      if (!isTemplateName(notification.template)) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, `Resend: unknown email template "${notification.template}". Pass \`content\` to send your own email.`)
      }
      const rendered = await renderEmail(notification.template, notification.data as unknown as OrderEmailData)
      subject = rendered.subject
      html = rendered.html
      text = rendered.text
    }

    const idempotencyKey = (notification as { idempotency_key?: string | null }).idempotency_key
    const { data, error } = await this.client_.emails.send(
      {
        from: notification.from?.trim() || this.options_.from,
        to: [notification.to],
        subject: subject ?? "",
        html: html ?? undefined,
        text: text ?? "",
        replyTo: this.options_.replyTo,
        attachments: notification.attachments?.map(a => ({ filename: a.filename, content: a.content, contentType: a.content_type })),
      } as Parameters<Resend["emails"]["send"]>[0],
      // Medusa already skips notifications sent with the same key; Resend's key is a
      // second guard for retries that happen mid-send.
      idempotencyKey ? { idempotencyKey } : undefined,
    )

    if (error) {
      this.logger_.error(`Resend: could not send "${subject}" to ${notification.to}: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Resend: ${error.message}`)
    }
    return { id: data?.id }
  }
}

export default ResendNotificationProviderService
