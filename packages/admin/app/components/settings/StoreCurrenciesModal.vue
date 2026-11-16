<script setup lang="ts">
import type { HttpTypes } from "@medusajs/types"

const props = defineProps<{ store: HttpTypes.AdminStore }>()
defineEmits<{ close: [saved: boolean] }>()

const medusa = useMedusa()
const { data: all } = await useAllCurrencies()

const current = props.store.supported_currencies ?? []
const selected = ref<string[]>(current.map(c => c.currency_code))
const defaultCode = ref(current.find(c => c.is_default)?.currency_code ?? current[0]?.currency_code ?? "")
const error = ref("")

const items = computed(() =>
  all.value.map(c => ({ label: `${c.code.toUpperCase()} · ${c.name}`, value: c.code })),
)
const defaultItems = computed(() => selected.value.map(code => ({ label: code.toUpperCase(), value: code })))

watch(selected, (codes) => {
  if (!codes.includes(defaultCode.value)) {
    defaultCode.value = codes[0] ?? ""
  }
})

async function submit() {
  error.value = selected.value.length ? "" : "Choose at least one currency"
  if (error.value) {
    throw false
  }
  await medusa.admin.store.update(props.store.id, {
    supported_currencies: selected.value.map(code => ({ currency_code: code, is_default: code === defaultCode.value })),
  })
  await refreshNuxtData("catalog:currencies")
}
</script>

<template>
  <AppFormModal
    title="Currencies"
    description="Currencies you can set prices in. Each region uses one of them."
    :submit="submit"
    @close="(v) => $emit('close', v)"
  >
    <UFormField label="Currencies" required :error="error || undefined" help="For Paystack or Flutterwave, add NGN, GHS, KES or ZAR.">
      <USelectMenu
        v-model="selected"
        :items="items"
        value-key="value"
        multiple
        :search-input="{ placeholder: 'Search currencies' }"
        placeholder="Choose currencies"
        class="w-full"
      />
    </UFormField>
    <UFormField label="Default currency" help="Shown first in price forms.">
      <USelect v-model="defaultCode" :items="defaultItems" class="w-full" />
    </UFormField>
  </AppFormModal>
</template>
