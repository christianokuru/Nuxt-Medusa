<script setup lang="ts">
import type { HttpTypes } from "@medusajs/types"

const props = defineProps<{ order: HttpTypes.AdminOrder, fulfillment: OrderFulfillment }>()
defineEmits<{ close: [saved: boolean] }>()

const medusa = useMedusa()
const trackingNumber = ref("")
const trackingUrl = ref("")
const notify = ref(true)

async function submit() {
  const labels = trackingNumber.value.trim()
    ? [{ tracking_number: trackingNumber.value.trim(), tracking_url: trackingUrl.value.trim() || "#", label_url: "#" }]
    : undefined
  await medusa.admin.order.createShipment(props.order.id, props.fulfillment.id, {
    items: (props.fulfillment.items ?? []).map(i => ({ id: i.line_item_id as string, quantity: Number(i.quantity) })),
    labels,
    no_notification: !notify.value,
  })
}
</script>

<template>
  <AppFormModal title="Mark as shipped" description="Add tracking so the customer can follow the parcel." submit-label="Mark shipped" :submit="submit" @close="(v) => $emit('close', v)">
    <UFormField label="Tracking number" hint="Optional">
      <UInput v-model="trackingNumber" placeholder="1Z999AA10123456784" class="w-full" />
    </UFormField>
    <UFormField label="Tracking link" hint="Optional">
      <UInput v-model="trackingUrl" type="url" placeholder="https://" class="w-full" />
    </UFormField>
    <div class="border-t border-default">
      <AppToggleRow v-model="notify" label="Notify customer" description="Let the customer know it's on its way." />
    </div>
  </AppFormModal>
</template>
