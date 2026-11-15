// Talks to the email plugin's admin API (packages/medusa-resend/src/api/admin/emails).

export interface EmailTemplateInfo {
  name: string
  label: string
  description: string
  enabled: boolean
}

export interface EmailStatus {
  configured: boolean
  from: string | null
  templates: EmailTemplateInfo[]
}

export interface SentEmail {
  id: string
  to: string
  template: string | null
  status: "pending" | "success" | "failure"
  trigger_type: string | null
  created_at: string
  original_notification_id: string | null
}

export const useEmailStatus = () => {
  const medusa = useMedusa()
  return useAsyncData("emails:status", () => medusa.client.fetch<EmailStatus>("/admin/emails"))
}

export const useEmails = () => {
  const medusa = useMedusa()
  return {
    preview: (template: string, currency?: string) =>
      medusa.client.fetch<{ subject: string, html: string }>("/admin/emails/preview", { query: { template, currency } }),
    sendTest: (template: string, to: string, currency?: string) =>
      medusa.client.fetch("/admin/emails/send-test", { method: "POST", body: { template, to, currency } }),
    sent: (orderId: string) =>
      medusa.client.fetch<{ emails: SentEmail[] }>("/admin/emails/sent", { query: { order_id: orderId } }),
    resend: (notificationId: string) =>
      medusa.client.fetch("/admin/emails/resend", { method: "POST", body: { notification_id: notificationId } }),
  }
}

export const emailStatusDot = (status: SentEmail["status"]): { label: string, tone: "success" | "error" | "neutral" } =>
  status === "success"
    ? { label: "Sent", tone: "success" }
    : status === "failure"
      ? { label: "Failed", tone: "error" }
      : { label: "Sending", tone: "neutral" }
