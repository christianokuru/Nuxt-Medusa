<script setup lang="ts">
import type { AdminWidgetProps } from "@nuxt-medusa/admin-kit/define"

const props = defineProps<AdminWidgetProps<"product.details.after">>()

const notify = useNotify()
const { save } = useProductNotes()

const saved = computed(() => productNote(props.data.product))
const updatedAt = computed(() => productNoteUpdatedAt(props.data.product))
const draft = ref(saved.value)
const saving = ref(false)
const dirty = computed(() => draft.value.trim() !== saved.value)

// Pick up changes made elsewhere (e.g. after a refresh).
watch(saved, (value) => {
  if (!dirty.value) {
    draft.value = value
  }
})

async function submit() {
  saving.value = true
  try {
    await save(props.data.product, draft.value)
    await props.data.refresh()
    notify.success(draft.value.trim() ? "Note saved" : "Note removed")
  } catch (e) {
    notify.error(e, "Could not save note")
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppSection title="Notes" description="Private to your team. Customers never see these.">
    <form class="space-y-3" @submit.prevent="submit">
      <UTextarea
        v-model="draft"
        :rows="3"
        autoresize
        placeholder="Add a note for your team: supplier, restock plans, photo shoot…"
        class="w-full"
        :ui="{ base: 'leading-relaxed' }"
        aria-label="Product note"
      />
      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between min-h-11 sm:min-h-8">
        <p class="text-xs text-muted">
          <template v-if="updatedAt && !dirty">
            Last edited {{ formatDate(updatedAt) }}
          </template>
          <template v-else-if="dirty">
            Unsaved changes
          </template>
        </p>
        <div v-if="dirty" class="flex gap-2 max-sm:[&>*]:flex-1">
          <UButton label="Discard" color="neutral" variant="ghost" size="sm" :disabled="saving" @click="draft = saved" />
          <UButton type="submit" label="Save note" size="sm" :loading="saving" />
        </div>
      </div>
    </form>
  </AppSection>
</template>
