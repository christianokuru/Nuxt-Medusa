<script setup lang="ts">
import type { HttpTypes } from "@medusajs/types"

const props = defineProps<{ store: HttpTypes.AdminStore }>()
defineEmits<{ close: [saved: boolean] }>()

const medusa = useMedusa()
const name = ref(props.store.name)
const error = ref("")

async function submit() {
  error.value = name.value.trim() ? "" : "Give your store a name"
  if (error.value) {
    throw false
  }
  await medusa.admin.store.update(props.store.id, { name: name.value.trim() })
  await refreshNuxtData("store:name")
}
</script>

<template>
  <AppFormModal title="Store details" :submit="submit" @close="(v) => $emit('close', v)">
    <UFormField label="Store name" required :error="error || undefined">
      <UInput v-model="name" class="w-full" autofocus />
    </UFormField>
  </AppFormModal>
</template>
