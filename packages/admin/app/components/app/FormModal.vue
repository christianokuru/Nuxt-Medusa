<script setup lang="ts">
// Shared frame for edit forms: title, body, Cancel / Save.
// `submit` runs on save; the modal closes with `true` when it succeeds.
const props = defineProps<{
  title: string
  description?: string
  submitLabel?: string
  wide?: boolean
  submit: () => Promise<unknown>
}>()

const emit = defineEmits<{ close: [saved: boolean] }>()
const saving = ref(false)

async function onSubmit() {
  saving.value = true
  try {
    await props.submit()
    emit("close", true)
  } catch (e) {
    // A thrown `false` means the form showed its own validation message.
    if (e !== false) {
      useNotify().error(e, "Could not save")
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    :title="title"
    :description="description"
    :dismissible="!saving"
    :ui="{ content: wide ? 'sm:max-w-3xl' : 'sm:max-w-xl', body: 'space-y-6' }"
  >
    <template #body>
      <form id="app-form-modal" class="space-y-6" @submit.prevent="onSubmit">
        <slot />
        <button type="submit" class="hidden" />
      </form>
    </template>
    <template #footer>
      <UButton label="Cancel" color="neutral" variant="ghost" :disabled="saving" @click="emit('close', false)" />
      <UButton :label="submitLabel ?? 'Save'" :loading="saving" @click="onSubmit" />
    </template>
  </UModal>
</template>
