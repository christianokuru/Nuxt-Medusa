<script setup lang="ts">
import type { HttpTypes } from "@medusajs/types"

const props = defineProps<{ product: HttpTypes.AdminProduct }>()
defineEmits<{ close: [saved: boolean] }>()

const medusa = useMedusa()
const notify = useNotify()
const catalog = useCatalog()
const [{ data: collections }, { data: types }, { data: tags }, { data: categories }] = await Promise.all([
  catalog.collections(),
  catalog.types(),
  catalog.tags(),
  catalog.categories(),
])

const form = reactive({
  collectionId: props.product.collection_id ?? undefined,
  typeId: props.product.type_id ?? undefined,
  tagIds: (props.product.tags ?? []).map(t => t.id),
  categoryIds: (props.product.categories ?? []).map(c => c.id),
})

const creatingTag = ref(false)
async function createTag(value: string) {
  const name = value.trim()
  if (!name) {
    return
  }
  creatingTag.value = true
  try {
    const { product_tag } = await medusa.admin.productTag.create({ value: name })
    tags.value = [...tags.value, product_tag]
    form.tagIds = [...form.tagIds, product_tag.id]
  } catch (e) {
    notify.error(e, "Could not add tag")
  } finally {
    creatingTag.value = false
  }
}

async function submit() {
  await medusa.admin.product.update(props.product.id, {
    collection_id: form.collectionId ?? null,
    type_id: form.typeId ?? null,
    tags: form.tagIds.map(id => ({ id })),
    categories: form.categoryIds.map(id => ({ id })),
  })
}
</script>

<template>
  <AppFormModal title="Organisation" description="How this product is grouped in your store." :submit="submit" @close="(v) => $emit('close', v)">
    <UFormField label="Collection">
      <USelectMenu
        v-model="form.collectionId"
        :items="[{ label: 'None', value: undefined }, ...collections.map(c => ({ label: c.title, value: c.id }))]"
        value-key="value"
        placeholder="None"
        class="w-full"
      />
    </UFormField>
    <UFormField label="Type">
      <USelectMenu
        v-model="form.typeId"
        :items="[{ label: 'None', value: undefined }, ...types.map(t => ({ label: t.value, value: t.id }))]"
        value-key="value"
        placeholder="None"
        class="w-full"
      />
    </UFormField>
    <UFormField label="Categories">
      <USelectMenu
        v-model="form.categoryIds"
        :items="categories.map(c => ({ label: c.name, value: c.id }))"
        value-key="value"
        multiple
        placeholder="None"
        class="w-full"
      />
    </UFormField>
    <UFormField label="Tags" help="Pick existing tags or type a new one.">
      <UInputMenu
        v-model="form.tagIds"
        :items="tags.map(t => ({ label: t.value, value: t.id }))"
        value-key="value"
        multiple
        create-item
        :loading="creatingTag"
        placeholder="Add tags"
        class="w-full"
        @create="createTag"
      />
    </UFormField>
  </AppFormModal>
</template>
