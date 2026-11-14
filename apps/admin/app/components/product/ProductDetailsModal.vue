<script setup lang="ts">
import type { HttpTypes } from "@medusajs/types"

const props = defineProps<{ product: HttpTypes.AdminProduct }>()
defineEmits<{ close: [saved: boolean] }>()

const medusa = useMedusa()
const form = reactive({
  title: props.product.title,
  subtitle: props.product.subtitle ?? "",
  handle: props.product.handle ?? "",
  description: props.product.description ?? "",
  discountable: props.product.discountable ?? true,
})
const errors = ref<Record<string, string>>({})

async function submit() {
  const e: Record<string, string> = {}
  if (!form.title.trim()) {
    e.title = "Give the product a title"
  }
  if (!/^[a-z0-9-]+$/.test(form.handle)) {
    e.handle = "Use lowercase letters, numbers and dashes"
  }
  errors.value = e
  if (Object.keys(e).length) {
    throw false
  }
  await medusa.admin.product.update(props.product.id, {
    title: form.title.trim(),
    subtitle: form.subtitle.trim() || null,
    handle: form.handle,
    description: form.description.trim() || null,
    discountable: form.discountable,
  })
}
</script>

<template>
  <AppFormModal title="Edit details" :submit="submit" wide @close="(v) => $emit('close', v)">
    <UFormField label="Title" required :error="errors.title">
      <UInput v-model="form.title" size="lg" class="w-full" />
    </UFormField>
    <div class="grid gap-6 sm:grid-cols-2">
      <UFormField label="Subtitle" hint="Optional">
        <UInput v-model="form.subtitle" class="w-full" />
      </UFormField>
      <UFormField label="Handle" :error="errors.handle">
        <UInput v-model="form.handle" class="w-full">
          <template #leading>
            <span class="text-sm text-dimmed">/</span>
          </template>
        </UInput>
      </UFormField>
    </div>
    <UFormField label="Description" hint="Optional">
      <UTextarea v-model="form.description" :rows="6" autoresize class="w-full" />
    </UFormField>
    <div class="flex items-start justify-between gap-6 pt-5 border-t border-default">
      <div>
        <p class="text-sm font-medium text-highlighted">
          Discountable
        </p>
        <p class="text-sm text-muted mt-0.5">
          Allow promotions to apply to this product.
        </p>
      </div>
      <USwitch v-model="form.discountable" />
    </div>
  </AppFormModal>
</template>
