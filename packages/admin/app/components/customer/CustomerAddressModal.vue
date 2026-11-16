<script setup lang="ts">
import type { HttpTypes } from "@medusajs/types"

const props = defineProps<{ customer: HttpTypes.AdminCustomer, address?: HttpTypes.AdminCustomerAddress }>()
defineEmits<{ close: [saved: boolean] }>()

const medusa = useMedusa()
const a = props.address
const form = reactive({
  first_name: a?.first_name ?? props.customer.first_name ?? "",
  last_name: a?.last_name ?? props.customer.last_name ?? "",
  company: a?.company ?? "",
  address_1: a?.address_1 ?? "",
  address_2: a?.address_2 ?? "",
  postal_code: a?.postal_code ?? "",
  city: a?.city ?? "",
  province: a?.province ?? "",
  country_code: a?.country_code ?? "",
  phone: a?.phone ?? props.customer.phone ?? "",
  is_default_shipping: a?.is_default_shipping ?? !(props.customer.addresses?.length),
})
const errors = ref<Record<string, string>>({})
const countries = countryOptions().map(c => ({ label: `${countryFlag(c.value)}  ${c.label}`, value: c.value }))

async function submit() {
  const e: Record<string, string> = {}
  if (!form.address_1.trim()) {
    e.address_1 = "Enter the street address"
  }
  if (!form.city.trim()) {
    e.city = "Enter the city"
  }
  if (!form.country_code) {
    e.country_code = "Choose a country"
  }
  errors.value = e
  if (Object.keys(e).length) {
    throw false
  }
  const clean = (v: string) => v.trim() || null
  const body = {
    first_name: clean(form.first_name),
    last_name: clean(form.last_name),
    company: clean(form.company),
    address_1: clean(form.address_1),
    address_2: clean(form.address_2),
    postal_code: clean(form.postal_code),
    city: clean(form.city),
    province: clean(form.province),
    country_code: form.country_code,
    phone: clean(form.phone),
    is_default_shipping: form.is_default_shipping,
  }
  if (a) {
    await medusa.admin.customer.updateAddress(props.customer.id, a.id, body)
  } else {
    await medusa.admin.customer.createAddress(props.customer.id, body)
  }
}
</script>

<template>
  <AppFormModal :title="address ? 'Edit address' : 'Add address'" :submit="submit" wide @close="(v) => $emit('close', v)">
    <div class="grid gap-6 sm:grid-cols-2">
      <UFormField label="First name">
        <UInput v-model="form.first_name" class="w-full" />
      </UFormField>
      <UFormField label="Last name">
        <UInput v-model="form.last_name" class="w-full" />
      </UFormField>
    </div>
    <UFormField label="Street address" required :error="errors.address_1">
      <UInput v-model="form.address_1" autocomplete="off" class="w-full" />
    </UFormField>
    <UFormField label="Apartment, suite…" hint="Optional">
      <UInput v-model="form.address_2" class="w-full" />
    </UFormField>
    <div class="grid gap-6 grid-cols-2 sm:grid-cols-3">
      <UFormField label="Postcode">
        <UInput v-model="form.postal_code" class="w-full" />
      </UFormField>
      <UFormField label="City" required :error="errors.city">
        <UInput v-model="form.city" class="w-full" />
      </UFormField>
      <UFormField label="State / province" class="col-span-2 sm:col-span-1">
        <UInput v-model="form.province" class="w-full" />
      </UFormField>
    </div>
    <div class="grid gap-6 sm:grid-cols-2">
      <UFormField label="Country" required :error="errors.country_code">
        <USelectMenu
          v-model="form.country_code"
          :items="countries"
          value-key="value"
          :search-input="{ placeholder: 'Search countries' }"
          placeholder="Choose a country"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Phone" hint="Optional">
        <UInput v-model="form.phone" type="tel" class="w-full" />
      </UFormField>
    </div>
    <div class="border-t border-default">
      <AppToggleRow v-model="form.is_default_shipping" label="Default shipping address" />
    </div>
  </AppFormModal>
</template>
