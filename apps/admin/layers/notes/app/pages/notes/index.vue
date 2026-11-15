<script setup lang="ts">
useHead({ title: "Notes" })

const medusa = useMedusa()

const { data, status, error, refresh } = await useAsyncData("notes:list", async () => {
  const { products } = await medusa.admin.product.list({
    limit: 500,
    order: "-updated_at",
    fields: "id,title,thumbnail,metadata,updated_at",
  })
  return products
    .filter(p => productNote(p))
    .sort((a, b) => (productNoteUpdatedAt(b) ?? "").localeCompare(productNoteUpdatedAt(a) ?? ""))
})

const items = computed(() => data.value ?? [])
</script>

<template>
  <UDashboardPanel id="notes" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <UDashboardNavbar :ui="{ root: 'border-b-0 lg:hidden' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="w-full max-w-4xl mx-auto px-5 sm:px-10 pt-2 pb-10 sm:py-14">
        <AppPageHeader eyebrow="Extension" title="Notes">
          <template #description>
            {{ status === "pending" && !data ? " " : plural(items.length, "product") + " with notes" }}
          </template>
        </AppPageHeader>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Could not load notes"
          :description="errorMessage(error)"
          :actions="[{ label: 'Try again', color: 'neutral', variant: 'outline', onClick: () => { refresh() } }]"
          class="mt-6"
        />

        <ul v-else-if="items.length" class="divide-y divide-(--ui-border-muted)">
          <li v-for="product in items" :key="product.id">
            <NuxtLink :to="`/products/${product.id}`" class="flex gap-4 py-5 group active:opacity-70">
              <div class="size-14 shrink-0 rounded-md bg-elevated overflow-hidden grid place-items-center">
                <img v-if="product.thumbnail" :src="product.thumbnail" alt="" class="size-full object-cover" loading="lazy">
                <UIcon v-else name="i-lucide-image" class="size-4 text-dimmed" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline justify-between gap-4">
                  <p class="font-medium text-highlighted truncate group-hover:underline underline-offset-4">
                    {{ product.title }}
                  </p>
                  <span class="text-xs text-muted shrink-0">{{ formatDate(productNoteUpdatedAt(product)) }}</span>
                </div>
                <p class="text-sm text-toned mt-1 line-clamp-2 whitespace-pre-line">
                  {{ productNote(product) }}
                </p>
              </div>
            </NuxtLink>
          </li>
        </ul>

        <AppEmpty
          v-else-if="status !== 'pending'"
          icon="i-lucide-notebook-pen"
          title="No notes yet"
          description="Open any product and add a note in the Notes section. It will show up here."
        >
          <UButton label="Go to products" color="neutral" variant="outline" to="/products" />
        </AppEmpty>
      </div>
    </template>
  </UDashboardPanel>
</template>
