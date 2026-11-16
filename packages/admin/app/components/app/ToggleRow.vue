<script setup lang="ts">
// A setting with a switch. The whole row is tappable, which matters on phones.
defineProps<{ label: string, description?: string, disabled?: boolean }>()
const model = defineModel<boolean>({ default: false })
</script>

<template>
  <label
    class="flex items-center justify-between gap-6 py-4 min-h-14"
    :class="disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'"
  >
    <span class="min-w-0">
      <span class="block text-sm font-medium text-highlighted">{{ label }}</span>
      <span v-if="description" class="block text-sm text-muted mt-0.5">{{ description }}</span>
    </span>
    <USwitch v-model="model" :disabled="disabled" size="lg" class="shrink-0" />
  </label>
</template>
