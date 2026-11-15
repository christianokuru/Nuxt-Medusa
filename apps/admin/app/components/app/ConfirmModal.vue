<script setup lang="ts">
const props = defineProps<{
  title: string
  description?: string
  confirmLabel?: string
  danger?: boolean
  // Runs when confirmed. The modal stays open (and shows a spinner) until it finishes.
  onConfirm?: () => Promise<unknown> | unknown
}>()

const emit = defineEmits<{ close: [confirmed: boolean] }>()
const loading = ref(false)

async function confirm() {
  if (!props.onConfirm) {
    emit("close", true)
    return
  }
  loading.value = true
  try {
    await props.onConfirm()
    emit("close", true)
  } catch (e) {
    useNotify().error(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal
    :title="title"
    :description="description"
    :dismissible="!loading"
    :close="false"
    :ui="{ content: 'max-w-md', footer: 'border-t-0 pt-0' }"
  >
    <template #footer>
      <UButton label="Cancel" color="neutral" variant="ghost" :disabled="loading" @click="emit('close', false)" />
      <UButton
        :label="confirmLabel ?? 'Confirm'"
        :color="danger ? 'error' : 'primary'"
        :loading="loading"
        @click="confirm"
      />
    </template>
  </UModal>
</template>
