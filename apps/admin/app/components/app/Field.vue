<script setup lang="ts">
// One label / value pair in a definition list.
defineProps<{ label: string, value?: string | number | null }>()
</script>

<template>
  <div class="grid grid-cols-[7rem_1fr] sm:grid-cols-[9rem_1fr] gap-4 py-3.5 sm:py-3 border-b border-muted last:border-b-0 text-[15px] sm:text-sm">
    <dt class="text-muted">
      {{ label }}
    </dt>
    <dd class="text-highlighted min-w-0 break-words">
      <slot>
        <span v-if="value !== null && value !== undefined && value !== ''">{{ value }}</span>
        <span v-else class="text-dimmed">—</span>
      </slot>
    </dd>
  </div>
</template>
