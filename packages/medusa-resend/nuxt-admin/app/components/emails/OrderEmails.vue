<script setup lang="ts">
import type { AdminWidgetProps } from "@nuxt-medusa/admin-kit/define"

// Order page box: which emails this customer got, and "Send again".
const props = defineProps<AdminWidgetProps<"order.details.after">>()

const emails = useEmails()
const notify = useNotify()
const confirm = useConfirm()
const { data: status } = await useEmailStatus()

const orderId = computed(() => props.data.order.id)
const { data, error, refresh } = await useAsyncData(
  () => `emails:sent:${orderId.value}`,
  () => emails.sent(orderId.value),
  { watch: [orderId] },
)

// Refresh when the order changes (e.g. after marking it shipped, the email follows shortly).
watch(() => props.data.order.updated_at, () => {
  setTimeout(() => refresh(), 1500)
})

const label = (template: string | null) =>
  status.value?.templates.find(t => t.name === template)?.label ?? template ?? "Email"

const sending = ref<string>()
async function sendAgain(email: SentEmail) {
  const ok = await confirm({
    title: `Send “${label(email.template)}” again?`,
    description: `It goes to ${email.to}, exactly as before.`,
    confirmLabel: "Send again",
  })
  if (!ok) {
    return
  }
  sending.value = email.id
  try {
    await emails.resend(email.id)
    notify.success("Email sent again")
    await refresh()
  }
  catch (e) {
    notify.error(e, "Could not send the email")
  }
  finally {
    sending.value = undefined
  }
}
</script>

<template>
  <AppSection title="Emails" description="What this customer has been sent.">
    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" title="Could not load emails" :description="errorMessage(error)" />

    <ul v-else-if="data?.emails.length" class="divide-y divide-(--ui-border-muted) border-y border-default">
      <li v-for="email in data.emails" :key="email.id" class="flex items-center gap-4 py-3.5">
        <div class="min-w-0 flex-1">
          <p class="text-sm text-highlighted">
            {{ label(email.template) }}
            <span v-if="email.original_notification_id" class="text-muted">· sent again</span>
          </p>
          <p class="text-xs text-muted mt-0.5 truncate">
            {{ email.to }} · {{ formatDateTime(email.created_at) }}
          </p>
        </div>
        <AppDot v-bind="emailStatusDot(email.status)" class="text-xs shrink-0" />
        <UButton
          icon="i-lucide-rotate-cw"
          :aria-label="`Send ${label(email.template)} again`"
          color="neutral"
          variant="ghost"
          size="sm"
          :loading="sending === email.id"
          :disabled="!status?.configured"
          @click="sendAgain(email)"
        />
      </li>
    </ul>

    <p v-else-if="status && !status.configured" class="border-y border-default py-4 text-sm text-muted">
      Emails are off. Turn them on in
      <NuxtLink to="/settings/emails" class="text-highlighted underline underline-offset-2">
        Settings → Emails
      </NuxtLink>.
    </p>
    <p v-else class="border-y border-default py-4 text-sm text-muted">
      No emails sent for this order yet.
    </p>
  </AppSection>
</template>
