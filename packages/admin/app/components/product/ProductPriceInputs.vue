<script setup lang="ts">
import type { HttpTypes } from "@medusajs/types"

// One amount input per store currency.
const prices = defineModel<Record<string, number | undefined>>({ default: () => ({}) })
defineProps<{ currencies: HttpTypes.AdminStoreCurrency[], compact?: boolean, size?: "sm" | "md" }>()

function set(code: string, value: number | null | undefined) {
  prices.value = { ...prices.value, [code]: value ?? undefined }
}
</script>

<template>
  <div class="grid gap-3" :class="compact ? 'grid-cols-[repeat(auto-fill,minmax(8rem,1fr))]' : 'sm:grid-cols-2'">
    <UFormField
      v-for="c in currencies"
      :key="c.currency_code"
      :label="compact ? undefined : `Price in ${c.currency_code.toUpperCase()}`"
    >
      <UInputNumber
        :model-value="prices[c.currency_code] ?? null"
        :min="0"
        :step="0.01"
        :format-options="{ style: 'currency', currency: c.currency_code.toUpperCase(), currencyDisplay: 'narrowSymbol', minimumFractionDigits: 0, maximumFractionDigits: 2 }"
        :increment="false"
        :decrement="false"
        :placeholder="`${currencySymbol(c.currency_code)} 0.00`"
        :aria-label="`Price in ${c.currency_code.toUpperCase()}`"
        :size="size ?? 'md'"
        class="w-full"
        :ui="{ base: 'tabular-nums' }"
        @update:model-value="(v) => set(c.currency_code, v)"
      />
    </UFormField>
  </div>
</template>
