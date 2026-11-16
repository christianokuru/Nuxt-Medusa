<script setup lang="ts">
import type { HttpTypes } from "@medusajs/types"

const props = defineProps<{ payment: HttpTypes.AdminPayment, currency: string, refundable: number }>()
defineEmits<{ close: [saved: boolean] }>()

const medusa = useMedusa()
const amount = ref<number | null>(props.refundable)
const note = ref("")
const error = ref("")

async function submit() {
  const value = Number(amount.value)
  error.value = !value || value <= 0
    ? "Enter an amount"
    : value > props.refundable + 1e-9
      ? `You can refund up to ${formatMoney(props.refundable, props.currency)}`
      : ""
  if (error.value) {
    throw false
  }
  await medusa.admin.payment.refund(props.payment.id, { amount: value, note: note.value.trim() || undefined })
}
</script>

<template>
  <AppFormModal
    title="Refund payment"
    :description="`Paid with ${paymentProviderInfo(payment.provider_id).name}. Up to ${formatMoney(refundable, currency)} can be refunded.`"
    submit-label="Refund"
    :submit="submit"
    @close="(v) => $emit('close', v)"
  >
    <UFormField label="Amount" required :error="error || undefined">
      <UInputNumber
        v-model="amount"
        :min="0"
        :max="refundable"
        :step="0.01"
        :format-options="{ style: 'currency', currency: currency.toUpperCase(), currencyDisplay: 'narrowSymbol' }"
        :increment="false"
        :decrement="false"
        class="w-full"
      />
    </UFormField>
    <UFormField label="Note" hint="Optional, only visible to your team">
      <UTextarea v-model="note" :rows="2" autoresize placeholder="Reason for the refund" class="w-full" />
    </UFormField>
  </AppFormModal>
</template>
