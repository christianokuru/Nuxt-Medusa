<script setup lang="ts">
// Shows an email exactly as customers get it (with a made-up order) and sends a test copy.
const props = defineProps<{ template: EmailTemplateInfo, configured: boolean, currency?: string }>()
defineEmits<{ close: [] }>()

const emails = useEmails()
const notify = useNotify()
const { user } = useAuth()

const { data, error, status } = await useAsyncData(`emails:preview:${props.template.name}`, () =>
  emails.preview(props.template.name, props.currency),
)

const width = ref<"desktop" | "phone">("desktop")
const to = ref(user.value?.email ?? "")
const sending = ref(false)
const toError = ref("")

async function sendTest() {
  toError.value = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.value.trim()) ? "" : "Enter a valid email address"
  if (toError.value) {
    return
  }
  sending.value = true
  try {
    await emails.sendTest(props.template.name, to.value.trim(), props.currency)
    notify.success("Test email sent", `Check ${to.value.trim()}.`)
  }
  catch (e) {
    notify.error(e, "Could not send the test email")
  }
  finally {
    sending.value = false
  }
}
</script>

<template>
  <UModal
    :title="template.label"
    :description="data ? `Subject: ${data.subject}` : template.description"
    :ui="{ content: 'sm:max-w-3xl', body: 'p-0 sm:p-0 bg-muted', footer: 'flex-col items-stretch sm:flex-row sm:items-end gap-3' }"
  >
    <template #body>
      <div class="flex justify-center gap-1 pt-3 max-sm:hidden">
        <UButton
          v-for="w in (['desktop', 'phone'] as const)"
          :key="w"
          :label="w === 'desktop' ? 'Desktop' : 'Phone'"
          :icon="w === 'desktop' ? 'i-lucide-monitor' : 'i-lucide-smartphone'"
          size="xs"
          color="neutral"
          :variant="width === w ? 'soft' : 'ghost'"
          @click="width = w"
        />
      </div>
      <div class="p-3 sm:p-4">
        <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" title="Could not load the preview" :description="errorMessage(error)" />
        <USkeleton v-else-if="status === 'pending'" class="h-[60vh] w-full" />
        <iframe
          v-else-if="data"
          :srcdoc="data.html"
          :title="`Preview of ${template.label}`"
          sandbox=""
          class="block mx-auto h-[60vh] sm:h-[64vh] rounded-md bg-white ring ring-default transition-[width] w-full"
          :class="width === 'phone' ? 'sm:w-[390px]' : 'sm:w-full'"
        />
      </div>
    </template>

    <template #footer>
      <form class="flex flex-col gap-3 sm:flex-row sm:items-start w-full" @submit.prevent="sendTest">
        <UFormField label="Send a test to" :error="toError || undefined" class="flex-1" :hint="configured ? undefined : 'Set up Resend first'">
          <UInput v-model="to" type="email" class="w-full" :disabled="!configured" autocomplete="email" />
        </UFormField>
        <UButton
          type="submit"
          label="Send test"
          icon="i-lucide-send"
          :loading="sending"
          :disabled="!configured"
          class="sm:mt-6 justify-center"
        />
      </form>
    </template>
  </UModal>
</template>
