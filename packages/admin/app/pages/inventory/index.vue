<script setup lang="ts">
import { h, resolveComponent } from "vue"
import type { TableColumn } from "@nuxt/ui"
import { LazyInventoryStockModal } from "#components"

useHead({ title: "Inventory" })

const AppDot = resolveComponent("AppDot")
const PAGE_SIZE = 25

const medusa = useMedusa()
const route = useRoute()
const router = useRouter()
const notify = useNotify()
const overlay = useOverlay()

const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const q = computed(() => (typeof route.query.q === "string" ? route.query.q : ""))

function setQuery(next: Record<string, string | number | undefined>) {
  const query: Record<string, unknown> = { ...route.query, ...next }
  for (const key of Object.keys(query)) {
    if (query[key] === undefined || query[key] === "" || (key === "page" && Number(query[key]) === 1)) {
      delete query[key]
    }
  }
  router.replace({ query: query as Record<string, string> })
}

const search = ref(q.value)
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => setQuery({ q: value.trim(), page: undefined }), 300)
})

const { data, status, error, refresh } = await useAsyncData(
  "inventory:list",
  () =>
    medusa.admin.inventoryItem.list({
      q: q.value || undefined,
      limit: PAGE_SIZE,
      offset: (page.value - 1) * PAGE_SIZE,
      order: "sku",
      fields: "id,sku,title,thumbnail,stocked_quantity,reserved_quantity,*location_levels,variants.id,variants.title,variants.product.id,variants.product.title,variants.product.thumbnail",
    }),
  { watch: [q, page] },
)

const items = computed(() => (data.value?.inventory_items ?? []) as InventoryItem[])
const total = computed(() => data.value?.count ?? 0)

async function adjust(item: InventoryItem) {
  const saved = await overlay.create(LazyInventoryStockModal).open({ item }).result
  if (saved) {
    notify.success("Stock updated")
    await refresh()
  }
}

const columns: TableColumn<InventoryItem>[] = [
  {
    id: "item",
    header: "Item",
    cell: ({ row }) => {
      const t = inventoryTitle(row.original)
      return h("div", { class: "flex items-center gap-4 min-w-0" }, [
        h("div", { class: "size-11 shrink-0 rounded-md bg-elevated overflow-hidden" }, t.thumbnail ? [h("img", { src: t.thumbnail, alt: "", class: "size-full object-cover", loading: "lazy" })] : []),
        h("div", { class: "min-w-0" }, [
          h("p", { class: "font-medium text-highlighted truncate" }, t.product),
          h("p", { class: "text-xs text-muted truncate mt-0.5" }, [t.variant, row.original.sku].filter(Boolean).join(" · ")),
        ]),
      ])
    },
  },
  { id: "stocked", header: () => h("span", { class: "block text-right" }, "In stock"), cell: ({ row }) => h("p", { class: "text-right tabular-nums" }, formatCount(Number(row.original.stocked_quantity ?? 0))) },
  { id: "reserved", header: () => h("span", { class: "block text-right" }, "Reserved"), meta: { class: { th: "hidden lg:table-cell", td: "hidden lg:table-cell" } }, cell: ({ row }) => h("p", { class: "text-right tabular-nums text-muted" }, formatCount(Number(row.original.reserved_quantity ?? 0))) },
  { id: "available", header: () => h("span", { class: "block text-right" }, "Available"), cell: ({ row }) => h("p", { class: "text-right tabular-nums text-highlighted font-medium" }, formatCount(available(row.original))) },
  { id: "state", header: "", cell: ({ row }) => h(AppDot, stockState(available(row.original))) },
]
</script>

<template>
  <UDashboardPanel id="inventory" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <UDashboardNavbar :ui="{ root: 'border-b-0 lg:hidden' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="w-full max-w-6xl mx-auto px-5 sm:px-10 pt-2 pb-10 sm:py-14">
        <AppPageHeader eyebrow="Stock" title="Inventory">
          <template #description>
            <span v-if="status !== 'pending' || data">{{ plural(total, q ? "result" : "item") }}. Tap an item to adjust its stock.</span>
            <span v-else>&nbsp;</span>
          </template>
        </AppPageHeader>

        <div class="py-4 sm:py-5 flex sm:justify-end">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search by name or SKU"
            variant="none"
            class="w-full sm:w-72 border-b border-default focus-within:border-inverted transition-colors"
            :ui="{ base: 'px-0 ps-7', leading: 'ps-0' }"
          />
        </div>

        <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" title="Could not load inventory" :description="errorMessage(error)" :actions="[{ label: 'Try again', color: 'neutral', variant: 'outline', onClick: () => { refresh() } }]" />

        <template v-else-if="items.length || status === 'pending'">
          <ul class="md:hidden divide-y divide-(--ui-border-muted) border-t border-default">
            <li v-for="item in items" :key="item.id">
              <button type="button" class="w-full flex items-center gap-4 py-4 text-left active:opacity-70" @click="adjust(item)">
                <div class="size-14 shrink-0 rounded-md bg-elevated overflow-hidden">
                  <img v-if="inventoryTitle(item).thumbnail" :src="inventoryTitle(item).thumbnail!" alt="" class="size-full object-cover" loading="lazy">
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-base font-medium text-highlighted truncate">
                    {{ inventoryTitle(item).product }}
                  </p>
                  <p class="text-sm text-muted truncate">
                    {{ [inventoryTitle(item).variant, item.sku].filter(Boolean).join(" · ") }}
                  </p>
                  <AppDot v-bind="stockState(available(item))" class="text-[13px] mt-1" />
                </div>
                <p class="text-base text-highlighted tabular-nums shrink-0">
                  {{ formatCount(available(item)) }}
                </p>
              </button>
            </li>
          </ul>
          <UTable
            :data="items"
            :columns="columns"
            :loading="status === 'pending' && !items.length"
            loading-color="neutral"
            class="-mt-1 max-md:hidden"
            @select="(_e: Event, row: { original: InventoryItem }) => adjust(row.original)"
          />
        </template>

        <AppEmpty v-else-if="q" icon="i-lucide-search-x" title="Nothing found" description="No items match that search.">
          <UButton label="Clear search" color="neutral" variant="outline" @click="search = ''" />
        </AppEmpty>
        <AppEmpty v-else icon="i-lucide-boxes" title="No stock tracked yet" description="Items appear here for variants with stock tracking turned on." />

        <div v-if="total > PAGE_SIZE" class="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between pt-6 mt-2 border-t border-default">
          <p class="text-sm text-muted tabular-nums">
            {{ (page - 1) * PAGE_SIZE + 1 }}–{{ Math.min(page * PAGE_SIZE, total) }} of {{ total }}
          </p>
          <UPagination :page="page" :total="total" :items-per-page="PAGE_SIZE" variant="ghost" active-variant="soft" @update:page="(p: number) => setQuery({ page: p })" />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
