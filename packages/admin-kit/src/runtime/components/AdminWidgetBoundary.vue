<script setup lang="ts">
import { onErrorCaptured, ref } from "vue"

// Stops one broken widget from breaking the whole page.
const props = defineProps<{ name: string, zone: string }>()
const failed = ref<Error | null>(null)
const isDev = import.meta.dev

onErrorCaptured((error) => {
  failed.value = error instanceof Error ? error : new Error(String(error))
  console.error(`[admin-kit] Widget from "${props.name}" failed in zone "${props.zone}".`, error)
  return false
})
</script>

<template>
  <div v-if="failed && isDev" class="my-4 rounded-md border border-dashed border-error/50 px-4 py-3 text-sm text-error">
    Widget from "{{ name }}" failed: {{ failed.message }}
  </div>
  <slot v-else-if="!failed" />
</template>
