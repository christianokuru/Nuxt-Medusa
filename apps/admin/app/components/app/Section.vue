<script setup lang="ts">
// An editorial section: title on the left, content on the right (on wide screens),
// separated from the next section by a hairline rule.
defineProps<{
  title: string
  description?: string
  actionLabel?: string
  actionIcon?: string
}>()

defineEmits<{ action: [] }>()
</script>

<template>
  <section class="grid gap-6 py-10 border-b border-default last:border-b-0 lg:grid-cols-[14rem_1fr] lg:gap-12">
    <div class="flex items-start justify-between gap-4 lg:flex-col lg:justify-start">
      <div>
        <h2 class="font-display text-2xl text-highlighted leading-tight">
          {{ title }}
        </h2>
        <p v-if="description" class="mt-1.5 text-sm text-muted leading-relaxed">
          {{ description }}
        </p>
      </div>
      <UButton
        v-if="actionLabel"
        :label="actionLabel"
        :icon="actionIcon"
        color="neutral"
        variant="outline"
        size="sm"
        class="shrink-0"
        @click="$emit('action')"
      />
    </div>
    <div class="min-w-0">
      <slot />
    </div>
  </section>
</template>
