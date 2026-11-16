<script setup lang="ts">
// Image grid with drag-and-drop upload. The first image is the cover.
type Image = { id?: string, url: string }

const images = defineModel<Image[]>({ default: () => [] })

const medusa = useMedusa()
const notify = useNotify()
const input = ref<HTMLInputElement>()
const uploading = ref(0)
const dragging = ref(false)

async function upload(fileList: FileList | File[] | null | undefined) {
  const files = Array.from(fileList ?? []).filter(f => f.type.startsWith("image/"))
  if (!files.length) {
    return
  }
  uploading.value += files.length
  try {
    const { files: uploaded } = await medusa.admin.upload.create({ files })
    images.value = [...images.value, ...uploaded.map(f => ({ url: f.url }))]
  } catch (e) {
    notify.error(e, "Upload failed")
  } finally {
    uploading.value -= files.length
    if (input.value) {
      input.value.value = ""
    }
  }
}

function onDrop(e: DragEvent) {
  dragging.value = false
  upload(e.dataTransfer?.files)
}

function remove(index: number) {
  images.value = images.value.filter((_, i) => i !== index)
}

function makeCover(index: number) {
  const list = [...images.value]
  const [item] = list.splice(index, 1)
  if (item) {
    images.value = [item, ...list]
  }
}
</script>

<template>
  <div>
    <div
      v-if="images.length || uploading"
      class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3"
    >
      <figure
        v-for="(image, index) in images"
        :key="image.url"
        class="group relative aspect-[4/5] rounded-md overflow-hidden bg-elevated"
        :class="index === 0 ? 'sm:col-span-2 sm:row-span-2' : ''"
      >
        <img :src="image.url" alt="" class="size-full object-cover">
        <span v-if="index === 0" class="absolute left-2 top-2 eyebrow text-[10px] bg-default/90 text-highlighted rounded px-1.5 py-0.5">
          Cover
        </span>
        <div class="absolute inset-0 flex items-end justify-end gap-1 p-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100 transition-opacity bg-gradient-to-t from-black/40 pointer-coarse:from-black/15 to-transparent">
          <UTooltip v-if="index !== 0" text="Make cover">
            <UButton icon="i-lucide-star" size="xs" color="neutral" variant="solid" aria-label="Make cover" @click="makeCover(index)" />
          </UTooltip>
          <UTooltip text="Remove">
            <UButton icon="i-lucide-trash-2" size="xs" color="neutral" variant="solid" aria-label="Remove image" @click="remove(index)" />
          </UTooltip>
        </div>
      </figure>
      <div
        v-for="n in uploading"
        :key="`loading-${n}`"
        class="aspect-[4/5] rounded-md bg-elevated animate-pulse grid place-items-center"
      >
        <UIcon name="i-lucide-loader-circle" class="size-4 text-dimmed animate-spin" />
      </div>
    </div>

    <button
      type="button"
      class="w-full rounded-md border border-dashed px-6 py-8 text-center transition-colors active:bg-elevated"
      :class="dragging ? 'border-inverted bg-elevated' : 'border-accented hover:border-inverted hover:bg-muted'"
      @click="input?.click()"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <UIcon name="i-lucide-image-plus" class="size-5 text-muted mb-2" />
      <p class="text-sm text-highlighted">
        <span class="pointer-coarse:hidden">Drop images here or </span><span class="underline underline-offset-4 pointer-coarse:no-underline">browse<span class="hidden pointer-coarse:inline"> photos</span></span>
      </p>
      <p class="text-xs text-muted mt-1">
        PNG, JPG or WebP. The first image is the cover.
      </p>
    </button>
    <input
      ref="input"
      type="file"
      accept="image/*"
      multiple
      class="hidden"
      @change="upload(($event.target as HTMLInputElement).files)"
    >
  </div>
</template>
