<script setup lang="ts">
// A small coloured dot with a label. Tone picks the colour.
export type DotTone = "success" | "warning" | "error" | "info" | "neutral"
defineProps<{ label: string, tone?: DotTone }>()

const toneClass: Record<DotTone, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-rose-500",
  info: "bg-sky-500",
  neutral: "bg-stone-400 dark:bg-stone-500",
}
</script>

<template>
  <span class="inline-flex items-center gap-2 text-sm text-toned whitespace-nowrap">
    <span class="size-1.5 rounded-full shrink-0" :class="toneClass[tone ?? 'neutral']" />
    {{ label }}
  </span>
</template>
