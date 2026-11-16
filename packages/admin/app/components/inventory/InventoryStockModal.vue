<script setup lang="ts">
import type { HttpTypes } from "@medusajs/types"

const props = defineProps<{ item: InventoryItem }>()
defineEmits<{ close: [saved: boolean] }>()

const medusa = useMedusa()
const { data: locations } = await useAsyncData("inventory:locations", async () =>
  (await medusa.admin.stockLocation.list({ limit: 100, fields: "id,name" })).stock_locations,
{ default: () => [] as HttpTypes.AdminStockLocation[] })

const levels = computed(() => props.item.location_levels ?? [])
const levelFor = (locationId: string) => levels.value.find(l => l.location_id === locationId)

// Quantity per location. null = not stocked there.
const quantities = reactive<Record<string, number | null>>(
  Object.fromEntries(locations.value.map(l => [l.id, levelFor(l.id) ? Number(levelFor(l.id)!.stocked_quantity) : null])),
)
const error = ref("")
const title = inventoryTitle(props.item)

async function submit() {
  error.value = ""
  const updates: Promise<unknown>[] = []
  const create: { location_id: string, stocked_quantity: number }[] = []
  for (const location of locations.value) {
    const value = quantities[location.id]
    if (value === null || value === undefined) {
      continue
    }
    const level = levelFor(location.id)
    const reserved = Number(level?.reserved_quantity ?? 0)
    if (value < reserved) {
      error.value = `${location.name}: ${reserved} are reserved for orders, so stock can't go below that.`
      throw false
    }
    if (!level) {
      create.push({ location_id: location.id, stocked_quantity: value })
    } else if (value !== Number(level.stocked_quantity)) {
      updates.push(medusa.admin.inventoryItem.updateLevel(props.item.id, location.id, { stocked_quantity: value }))
    }
  }
  if (create.length) {
    updates.push(medusa.admin.inventoryItem.batchInventoryItemLocationLevels(props.item.id, { create }))
  }
  await Promise.all(updates)
}
</script>

<template>
  <AppFormModal
    title="Adjust stock"
    :description="[title.product, title.variant, item.sku].filter(Boolean).join(' · ')"
    :submit="submit"
    @close="(v) => $emit('close', v)"
  >
    <ul class="divide-y divide-(--ui-border-muted) border-y border-default">
      <li v-for="location in locations" :key="location.id" class="flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-3 py-4">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-highlighted truncate">
            {{ location.name }}
          </p>
          <p class="text-xs text-muted mt-0.5 tabular-nums">
            <template v-if="levelFor(location.id)">
              {{ formatCount(Number(levelFor(location.id)!.reserved_quantity ?? 0)) }} reserved for orders
            </template>
            <template v-else>
              Not stocked here
            </template>
          </p>
        </div>
        <UInputNumber
          v-if="quantities[location.id] !== null"
          v-model="quantities[location.id]"
          :min="0"
          class="w-full sm:w-44 shrink-0"
          :ui="{ base: 'tabular-nums' }"
          :aria-label="`Stock at ${location.name}`"
        />
        <UButton v-else label="Stock here" color="neutral" variant="outline" size="sm" class="max-sm:w-full" @click="quantities[location.id] = 0" />
      </li>
    </ul>
    <p v-if="!locations.length" class="text-sm text-muted">
      No stock locations yet.
    </p>
    <p v-if="error" class="text-sm text-error">
      {{ error }}
    </p>
  </AppFormModal>
</template>
