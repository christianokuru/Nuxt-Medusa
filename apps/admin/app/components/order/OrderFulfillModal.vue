<script setup lang="ts">
import type { HttpTypes } from "@medusajs/types"

const props = defineProps<{ order: HttpTypes.AdminOrder }>()
defineEmits<{ close: [saved: boolean] }>()

const medusa = useMedusa()
const { data: locations } = await useAsyncData("orders:stock-locations", async () =>
  (await medusa.admin.stockLocation.list({ limit: 50, fields: "id,name" })).stock_locations,
{ default: () => [] as HttpTypes.AdminStockLocation[] })

const items = computed(() => (props.order.items ?? []).filter(i => remainingToFulfill(i) > 0))
const quantities = reactive<Record<string, number>>(Object.fromEntries(items.value.map(i => [i.id, remainingToFulfill(i)])))
const locationId = ref(locations.value[0]?.id ?? "")
const notify = ref(true)
const error = ref("")

async function submit() {
  const chosen = items.value
    .map(i => ({ id: i.id, quantity: Math.min(Number(quantities[i.id] ?? 0), remainingToFulfill(i)) }))
    .filter(i => i.quantity > 0)
  error.value = !chosen.length ? "Choose at least one item" : !locationId.value ? "Choose where it ships from" : ""
  if (error.value) {
    throw false
  }
  await medusa.admin.order.createFulfillment(props.order.id, {
    items: chosen,
    location_id: locationId.value,
    no_notification: !notify.value,
  })
}
</script>

<template>
  <AppFormModal
    title="Fulfil items"
    description="Pack these items for shipping. You can mark them as shipped next."
    submit-label="Fulfil"
    :submit="submit"
    wide
    @close="(v) => $emit('close', v)"
  >
    <ul class="divide-y divide-(--ui-border-muted) border-y border-default">
      <li v-for="item in items" :key="item.id" class="flex items-center gap-4 py-3">
        <div class="size-12 shrink-0 rounded-md bg-elevated overflow-hidden">
          <img v-if="item.thumbnail" :src="item.thumbnail" alt="" class="size-full object-cover">
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-highlighted truncate">
            {{ item.product_title ?? item.title }}
          </p>
          <p class="text-xs text-muted truncate">
            {{ [item.variant_title, item.variant_sku].filter(Boolean).join(" · ") }}
          </p>
        </div>
        <UInputNumber
          v-model="quantities[item.id]"
          :min="0"
          :max="remainingToFulfill(item)"
          class="w-28 shrink-0"
          :aria-label="`Quantity of ${item.title}`"
        />
        <span class="text-xs text-muted w-10 shrink-0 max-sm:hidden">of {{ remainingToFulfill(item) }}</span>
      </li>
    </ul>

    <UFormField label="Ships from" required>
      <USelect v-model="locationId" :items="locations.map(l => ({ label: l.name, value: l.id }))" class="w-full" />
    </UFormField>

    <div class="border-t border-default">
      <AppToggleRow v-model="notify" label="Notify customer" description="Send the customer an update about their order." />
    </div>
    <p v-if="error" class="text-sm text-error">
      {{ error }}
    </p>
  </AppFormModal>
</template>
