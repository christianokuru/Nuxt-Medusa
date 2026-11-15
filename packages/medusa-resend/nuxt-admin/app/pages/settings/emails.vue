<script setup lang="ts">
import { LazyEmailsPreviewModal } from "#components"

useHead({ title: "Email settings" })

const overlay = useOverlay()
const { data, error } = await useEmailStatus()
const { data: store } = await useStoreSettings()
const currency = computed(() => store.value?.supported_currencies?.find(c => c.is_default)?.currency_code)

function preview(template: EmailTemplateInfo) {
  overlay.create(LazyEmailsPreviewModal).open({ template, configured: !!data.value?.configured, currency: currency.value })
}
</script>

<template>
  <div>
    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" title="Could not load email settings" :description="errorMessage(error)" class="mt-8" />

    <template v-else-if="data">
      <AppSection title="Sending" description="Emails go out through Resend, from your own address.">
        <div v-if="data.configured" class="border-y border-default py-4 flex items-start gap-3">
          <AppDot label="" tone="success" class="mt-1.5" />
          <div class="min-w-0">
            <p class="text-sm text-highlighted">
              Emails are on
            </p>
            <p class="text-sm text-muted mt-0.5 break-words">
              Sending from {{ data.from }}
            </p>
          </div>
        </div>
        <div v-else class="border-y border-default py-4 space-y-3">
          <p class="text-sm text-highlighted flex items-center gap-2">
            <AppDot label="" tone="warning" />
            Emails are off
          </p>
          <p class="text-sm text-muted leading-relaxed">
            Add your Resend key and sender address to the backend settings, then restart it:
          </p>
          <pre class="text-xs bg-muted rounded-md p-3 overflow-x-auto text-toned">RESEND_API_KEY=re_...
RESEND_FROM="Your Store &lt;orders@yourdomain.com&gt;"</pre>
          <p class="text-xs text-muted">
            You can still preview every email below.
          </p>
        </div>
      </AppSection>

      <AppSection title="Order emails" description="Sent automatically as each order moves along.">
        <ul class="divide-y divide-(--ui-border-muted) border-y border-default">
          <li v-for="template in data.templates" :key="template.name" class="flex items-center gap-4 py-4">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-highlighted">
                {{ template.label }}
              </p>
              <p class="text-sm text-muted mt-0.5">
                {{ template.description }}
              </p>
              <AppDot
                v-if="!template.enabled"
                label="Turned off in the plugin settings"
                tone="neutral"
                class="text-xs mt-1.5"
              />
            </div>
            <UButton label="Preview" icon="i-lucide-eye" color="neutral" variant="outline" size="sm" class="shrink-0" @click="preview(template)" />
          </li>
        </ul>
      </AppSection>
    </template>
  </div>
</template>
