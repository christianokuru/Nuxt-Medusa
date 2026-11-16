<script setup lang="ts">
import type { HttpTypes } from "@medusajs/types"

const props = defineProps<{ customer?: HttpTypes.AdminCustomer }>()
const emit = defineEmits<{ close: [result: HttpTypes.AdminCustomer | false] }>()

const medusa = useMedusa()
const c = props.customer
const form = reactive({
  first_name: c?.first_name ?? "",
  last_name: c?.last_name ?? "",
  email: c?.email ?? "",
  phone: c?.phone ?? "",
  company_name: c?.company_name ?? "",
})
const errors = ref<Record<string, string>>({})
let saved: HttpTypes.AdminCustomer | null = null

async function submit() {
  const e: Record<string, string> = {}
  if (!/.+@.+\..+/.test(form.email.trim())) {
    e.email = "Enter a valid email"
  }
  errors.value = e
  if (Object.keys(e).length) {
    throw false
  }
  const body = {
    first_name: form.first_name.trim() || null,
    last_name: form.last_name.trim() || null,
    phone: form.phone.trim() || null,
    company_name: form.company_name.trim() || null,
  }
  saved = c
    ? (await medusa.admin.customer.update(c.id, { ...body, email: form.email.trim() })).customer
    : (await medusa.admin.customer.create({ ...body, email: form.email.trim() })).customer
}
</script>

<template>
  <AppFormModal
    :title="customer ? 'Edit customer' : 'New customer'"
    :description="customer ? undefined : 'Add a customer by hand, for example for a phone order.'"
    :submit="submit"
    @close="(ok) => emit('close', ok && saved ? saved : false)"
  >
    <div class="grid gap-6 sm:grid-cols-2">
      <UFormField label="First name">
        <UInput v-model="form.first_name" autocomplete="off" class="w-full" />
      </UFormField>
      <UFormField label="Last name">
        <UInput v-model="form.last_name" autocomplete="off" class="w-full" />
      </UFormField>
    </div>
    <UFormField label="Email" required :error="errors.email">
      <UInput v-model="form.email" type="email" autocomplete="off" class="w-full" :disabled="!!customer?.has_account" />
    </UFormField>
    <p v-if="customer?.has_account" class="text-xs text-muted -mt-4">
      This customer has an account, so only they can change their email.
    </p>
    <div class="grid gap-6 sm:grid-cols-2">
      <UFormField label="Phone" hint="Optional">
        <UInput v-model="form.phone" type="tel" class="w-full" />
      </UFormField>
      <UFormField label="Company" hint="Optional">
        <UInput v-model="form.company_name" class="w-full" />
      </UFormField>
    </div>
  </AppFormModal>
</template>
