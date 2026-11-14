<script setup lang="ts">
import type { HttpTypes } from "@medusajs/types"

const props = defineProps<{ product: HttpTypes.AdminProduct }>()
defineEmits<{ close: [saved: boolean] }>()

const medusa = useMedusa()

// Show the cover first.
const initial = (props.product.images ?? []).map(i => ({ id: i.id, url: i.url }))
const coverIndex = initial.findIndex(i => i.url === props.product.thumbnail)
if (coverIndex > 0) {
  initial.unshift(...initial.splice(coverIndex, 1))
}
const images = ref(initial)

async function submit() {
  await medusa.admin.product.update(props.product.id, {
    images: images.value.map(i => (i.id ? { id: i.id, url: i.url } : { url: i.url })),
    thumbnail: images.value[0]?.url ?? null,
  })
}
</script>

<template>
  <AppFormModal title="Media" description="Upload, remove or choose the cover image." :submit="submit" wide @close="(v) => $emit('close', v)">
    <ProductMediaUploader v-model="images" />
  </AppFormModal>
</template>
