<script setup lang="ts">
defineProps<{
  eyebrow?: string
  title: string
  description?: string
}>()
</script>

<template>
  <header class="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between pb-8 border-b border-default">
    <div class="min-w-0">
      <p v-if="eyebrow" class="eyebrow mb-3">
        {{ eyebrow }}
      </p>
      <h1 class="display text-5xl sm:text-6xl">
        {{ title }}
      </h1>
      <p v-if="description || $slots.description" class="mt-3 text-sm text-muted">
        <slot name="description">
          {{ description }}
        </slot>
      </p>
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2 shrink-0">
      <slot name="actions" />
    </div>
  </header>
</template>
