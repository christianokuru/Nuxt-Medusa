<script setup lang="ts">
defineProps<{ status?: string | null }>()
</script>

<template>
  <span class="inline-flex items-center gap-2 text-sm text-toned whitespace-nowrap">
    <span class="size-1.5 rounded-full" :class="statusDotClass(status)" />
    {{ capitalize(status) }}
  </span>
</template>
