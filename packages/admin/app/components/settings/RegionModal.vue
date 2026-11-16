<script setup lang="ts">
import type { HttpTypes } from "@medusajs/types"

const props = defineProps<{
  region?: HttpTypes.AdminRegion
  // Countries already used by other regions: code -> region name.
  takenCountries: Record<string, string>
}>()
defineEmits<{ close: [saved: boolean] }>()

const medusa = useMedusa()
const { data: store } = await useStoreSettings()
const { data: providers } = await useAsyncData("settings:payment-providers", async () =>
  (await medusa.admin.payment.listPaymentProviders({ is_enabled: true, limit: 50 })).payment_providers,
{ default: () => [] as HttpTypes.AdminPaymentProvider[] })

const currencies = computed(() => (store.value?.supported_currencies ?? []).map(c => c.currency_code))

const form = reactive({
  name: props.region?.name ?? "",
  currency: props.region?.currency_code ?? currencies.value[0] ?? "",
  countries: (props.region?.countries ?? []).map(c => c.iso_2 ?? "").filter(Boolean) as string[],
  providers: (props.region?.payment_providers ?? []).map(p => p.id) as string[],
  automaticTaxes: props.region?.automatic_taxes ?? true,
})
if (!props.region && providers.value.some(p => p.id === "pp_system_default")) {
  form.providers = ["pp_system_default"]
}

const countryItems = computed(() =>
  countryOptions().map(c => ({
    label: `${countryFlag(c.value)}  ${c.label}`,
    value: c.value,
    disabled: !!props.takenCountries[c.value],
    suffix: props.takenCountries[c.value],
  })),
)

const providerItems = computed(() =>
  providers.value.map((p) => {
    const info = paymentProviderInfo(p.id)
    return { label: info.name, description: info.description, value: p.id }
  }),
)
const hasOnlinePayments = computed(() => providers.value.some(p => p.id !== "pp_system_default"))

const errors = ref<Record<string, string>>({})

async function submit() {
  const e: Record<string, string> = {}
  if (!form.name.trim()) {
    e.name = "Give the region a name"
  }
  if (!form.currency) {
    e.currency = "Choose a currency"
  }
  if (!form.providers.length) {
    e.providers = "Choose at least one way to pay"
  }
  errors.value = e
  if (Object.keys(e).length) {
    throw false
  }
  const body = {
    name: form.name.trim(),
    currency_code: form.currency,
    countries: form.countries,
    payment_providers: form.providers,
    automatic_taxes: form.automaticTaxes,
  }
  if (props.region) {
    await medusa.admin.region.update(props.region.id, body)
  } else {
    await medusa.admin.region.create(body)
  }
}
</script>

<template>
  <AppFormModal
    :title="region ? 'Edit region' : 'New region'"
    description="A region is a group of countries that share a currency and payment options."
    :submit="submit"
    wide
    @close="(v) => $emit('close', v)"
  >
    <div class="grid gap-6 sm:grid-cols-2">
      <UFormField label="Name" required :error="errors.name">
        <UInput v-model="form.name" placeholder="West Africa" class="w-full" />
      </UFormField>
      <UFormField label="Currency" required :error="errors.currency" help="Add more in Store → Currencies.">
        <USelect
          v-model="form.currency"
          :items="currencies.map(c => ({ label: c.toUpperCase(), value: c }))"
          class="w-full"
        />
      </UFormField>
    </div>

    <UFormField label="Countries" help="A country can only be in one region.">
      <USelectMenu
        v-model="form.countries"
        :items="countryItems"
        value-key="value"
        multiple
        :search-input="{ placeholder: 'Search countries' }"
        placeholder="Choose countries"
        class="w-full"
      >
        <template #item-trailing="{ item }">
          <span v-if="item.suffix" class="text-xs text-muted">in {{ item.suffix }}</span>
        </template>
      </USelectMenu>
    </UFormField>

    <div>
      <p class="text-[13px] font-medium text-toned mb-2">
        Payments <span class="text-error">*</span>
      </p>
      <UCheckboxGroup
        v-model="form.providers"
        :items="providerItems"
        variant="card"
        :ui="{ fieldset: 'grid gap-2' }"
      />
      <p v-if="errors.providers" class="text-sm text-error mt-2">
        {{ errors.providers }}
      </p>
      <p v-if="!hasOnlinePayments" class="text-xs text-muted mt-3 leading-relaxed">
        To offer Paystack or Flutterwave, add their secret keys to the backend settings
        (<code class="text-toned">PAYSTACK_SECRET_KEY</code>, <code class="text-toned">FLUTTERWAVE_SECRET_KEY</code>) and restart it.
      </p>
    </div>

    <div class="border-t border-default">
      <AppToggleRow v-model="form.automaticTaxes" label="Automatic taxes" description="Work out tax at checkout using the region's tax rules." />
    </div>
  </AppFormModal>
</template>
