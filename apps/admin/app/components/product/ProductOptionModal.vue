<script setup lang="ts">
import type { HttpTypes } from "@medusajs/types"

const props = defineProps<{
  product: HttpTypes.AdminProduct
  option?: HttpTypes.AdminProductOption
}>()
defineEmits<{ close: [saved: boolean] }>()

const medusa = useMedusa()
const currentValues = (props.option?.values ?? []).map(v => ({ id: v.id, value: v.value }))
const form = reactive({
  title: props.option?.title ?? "",
  values: currentValues.map(v => v.value),
})
const error = ref("")

async function submit() {
  const title = form.title.trim()
  const values = [...new Set(form.values.map(v => v.trim()).filter(Boolean))]
  const taken = (props.product.options ?? [])
    .filter(o => o.id !== props.option?.id)
    .some(o => o.title.toLowerCase() === title.toLowerCase())

  error.value = !title
    ? "Give the option a name"
    : !values.length
        ? "Add at least one value"
        : taken
          ? "This product already has an option with that name"
          : ""
  if (error.value) {
    throw false
  }

  if (!props.option) {
    await medusa.admin.product.linkOptions(props.product.id, { add: [{ title, values }] })
    return
  }

  if (title !== props.option.title) {
    await medusa.admin.productOption.update(props.option.id, { title })
  }
  const add = values.filter(v => !currentValues.some(c => c.value === v)).map(value => ({ value }))
  const remove = currentValues.filter(c => !values.includes(c.value)).map(c => c.id)
  if (add.length || remove.length) {
    await medusa.admin.product.linkOptions(props.product.id, {
      update: [{ product_option_id: props.option.id, add, remove }],
    })
  }
}
</script>

<template>
  <AppFormModal
    :title="option ? 'Edit option' : 'Add option'"
    description="Options describe how variants differ, like size or colour."
    :submit="submit"
    @close="(v) => $emit('close', v)"
  >
    <UFormField label="Name" required>
      <UInput v-model="form.title" placeholder="Size" class="w-full" autofocus />
    </UFormField>
    <UFormField label="Values" required help="Press Enter after each value. Values used by a variant can't be removed.">
      <UInputTags v-model="form.values" placeholder="S, M, L" class="w-full" add-on-paste add-on-blur />
    </UFormField>
    <p v-if="error" class="text-sm text-error">
      {{ error }}
    </p>
  </AppFormModal>
</template>
