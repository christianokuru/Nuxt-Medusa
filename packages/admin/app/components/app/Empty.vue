<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center text-center py-20 px-6">
    <div class="size-12 rounded-full border border-default grid place-items-center mb-5">
      <UIcon :name="icon ?? 'i-lucide-package'" class="size-5 text-muted" />
    </div>
    <h3 class="font-display text-2xl text-highlighted">
      {{ title }}
    </h3>
    <p v-if="description" class="mt-2 text-sm text-muted max-w-sm">
      {{ description }}
    </p>
    <div v-if="$slots.default" class="mt-6">
      <slot />
    </div>
  </div>
</template>
