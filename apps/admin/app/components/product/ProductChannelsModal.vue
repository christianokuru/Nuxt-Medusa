<script setup lang="ts">
import type { HttpTypes } from "@medusajs/types"

const props = defineProps<{ product: HttpTypes.AdminProduct }>()
defineEmits<{ close: [saved: boolean] }>()

const medusa = useMedusa()
const { data: channels } = await useCatalog().salesChannels()
const selected = ref((props.product.sales_channels ?? []).map(c => c.id))

async function submit() {
  await medusa.admin.product.update(props.product.id, {
    sales_channels: selected.value.map(id => ({ id })),
  })
}
</script>

<template>
  <AppFormModal title="Availability" description="Choose the sales channels that sell this product." :submit="submit" @close="(v) => $emit('close', v)">
    <UCheckboxGroup
      v-model="selected"
      :items="channels.map(c => ({ label: c.name, description: c.description ?? undefined, value: c.id }))"
      variant="card"
      :ui="{ fieldset: 'grid gap-2' }"
    />
    <p v-if="!channels.length" class="text-sm text-muted">
      No sales channels yet.
    </p>
  </AppFormModal>
</template>
