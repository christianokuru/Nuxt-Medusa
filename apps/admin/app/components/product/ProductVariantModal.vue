<script setup lang="ts">
import type { HttpTypes } from "@medusajs/types"

const props = defineProps<{
  product: HttpTypes.AdminProduct
  variant?: HttpTypes.AdminProductVariant
}>()
defineEmits<{ close: [saved: boolean] }>()

const medusa = useMedusa()
const { data: currencies } = await useCatalog().currencies()

const productOptions = computed(() => props.product.options ?? [])
const visibleOptions = computed(() => productOptions.value.filter(o => !isDefaultOption(o)))

// Current value for each option, keyed by option title.
function initialOptions() {
  const result: Record<string, string> = {}
  for (const option of productOptions.value) {
    const match = props.variant?.options?.find(v => v.option_id === option.id || v.option?.id === option.id)
    result[option.title] = match?.value ?? (isDefaultOption(option) ? option.values?.[0]?.value ?? "" : "")
  }
  return result
}

const v = props.variant
const form = reactive({
  title: v?.title ?? "",
  sku: v?.sku ?? "",
  options: initialOptions(),
  prices: Object.fromEntries((v?.prices ?? []).map(p => [p.currency_code, p.amount])) as Record<string, number | undefined>,
  manageInventory: v?.manage_inventory ?? true,
  allowBackorder: v?.allow_backorder ?? false,
})
const titleTouched = ref(!!v)

// Suggest a title from the chosen option values.
watch(() => ({ ...form.options }), (opts) => {
  if (titleTouched.value) {
    return
  }
  form.title = visibleOptions.value.map(o => opts[o.title]).filter(Boolean).join(" / ")
}, { deep: true })

const errors = ref<Record<string, string>>({})

async function submit() {
  const e: Record<string, string> = {}
  if (!form.title.trim()) {
    e.title = "Give the variant a name"
  }
  for (const option of visibleOptions.value) {
    if (!form.options[option.title]) {
      e[`option:${option.title}`] = `Choose a ${option.title.toLowerCase()}`
    }
  }
  errors.value = e
  if (Object.keys(e).length) {
    throw false
  }

  const prices = Object.entries(form.prices)
    .filter(([, amount]) => amount !== undefined && amount !== null)
    .map(([currency_code, amount]) => {
      const existing = v?.prices?.find(p => p.currency_code === currency_code)
      return { ...(existing ? { id: existing.id } : {}), currency_code, amount: Number(amount) }
    })

  const body = {
    title: form.title.trim(),
    sku: form.sku.trim() || null,
    options: form.options,
    prices,
    manage_inventory: form.manageInventory,
    allow_backorder: form.allowBackorder,
  }

  if (v) {
    await medusa.admin.product.updateVariant(props.product.id, v.id, body)
  } else {
    await medusa.admin.product.createVariant(props.product.id, { ...body, sku: body.sku ?? undefined })
  }
}
</script>

<template>
  <AppFormModal
    :title="variant ? 'Edit variant' : 'Add variant'"
    :submit="submit"
    wide
    @close="(val) => $emit('close', val)"
  >
    <div v-if="visibleOptions.length" class="grid gap-6 sm:grid-cols-2">
      <UFormField
        v-for="option in visibleOptions"
        :key="option.id"
        :label="option.title"
        required
        :error="errors[`option:${option.title}`]"
      >
        <USelect
          v-model="form.options[option.title]"
          :items="(option.values ?? []).map(val => val.value)"
          :placeholder="`Choose ${option.title.toLowerCase()}`"
          class="w-full"
        />
      </UFormField>
    </div>

    <div class="grid gap-6 sm:grid-cols-2">
      <UFormField label="Name" required :error="errors.title">
        <UInput v-model="form.title" class="w-full" @input="titleTouched = true" />
      </UFormField>
      <UFormField label="SKU" hint="Optional">
        <UInput v-model="form.sku" class="w-full" />
      </UFormField>
    </div>

    <ProductPriceInputs v-model="form.prices" :currencies="currencies" />

    <div class="divide-y divide-(--ui-border-muted) border-t border-default">
      <div class="flex items-start justify-between gap-6 py-4">
        <div>
          <p class="text-sm font-medium text-highlighted">
            Track stock
          </p>
          <p class="text-sm text-muted mt-0.5">
            Keep count of how many are available.
          </p>
        </div>
        <USwitch v-model="form.manageInventory" />
      </div>
      <div class="flex items-start justify-between gap-6 py-4">
        <div>
          <p class="text-sm font-medium text-highlighted">
            Allow backorders
          </p>
          <p class="text-sm text-muted mt-0.5">
            Keep selling when it's out of stock.
          </p>
        </div>
        <USwitch v-model="form.allowBackorder" :disabled="!form.manageInventory" />
      </div>
    </div>
  </AppFormModal>
</template>
