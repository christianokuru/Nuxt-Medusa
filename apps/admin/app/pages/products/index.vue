<script setup lang="ts">
import { h, resolveComponent } from "vue"
import type { DropdownMenuItem, TableColumn } from "@nuxt/ui"
import type { HttpTypes } from "@medusajs/types"
import { LazyProductCreateModal } from "#components"

useHead({ title: "Products" })

const UButton = resolveComponent("UButton")
const UDropdownMenu = resolveComponent("UDropdownMenu")
const AppStatus = resolveComponent("AppStatus")

const PAGE_SIZE = 20

const medusa = useMedusa()
const route = useRoute()
const router = useRouter()
const notify = useNotify()
const confirm = useConfirm()
const overlay = useOverlay()
const createModal = overlay.create(LazyProductCreateModal)

const { currencies } = useCatalog()
const { data: storeCurrencies } = await currencies()
const defaultCurrency = computed(() => storeCurrencies.value[0]?.currency_code ?? "eur")

// Filters live in the URL, so a filtered list can be shared or reloaded.
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const status = computed<ProductStatusFilter>(() => {
  const value = route.query.status
  return productStatusFilters.some(o => o.value === value) ? (value as ProductStatusFilter) : "all"
})
const q = computed(() => (typeof route.query.q === "string" ? route.query.q : ""))

function setQuery(next: Record<string, string | number | undefined>) {
  const query: Record<string, unknown> = { ...route.query, ...next }
  for (const key of Object.keys(query)) {
    if (query[key] === undefined || query[key] === "" || query[key] === "all" || (key === "page" && Number(query[key]) === 1)) {
      delete query[key]
    }
  }
  router.replace({ query: query as Record<string, string> })
}

const search = ref(q.value)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => setQuery({ q: value.trim(), page: undefined }), 300)
})
watch(q, (value) => {
  if (value !== search.value.trim()) {
    search.value = value
  }
})

const { data, status: loadStatus, error, refresh } = await useAsyncData(
  "products:list",
  () =>
    medusa.admin.product.list({
      q: q.value || undefined,
      status: status.value === "all" ? undefined : [status.value as HttpTypes.AdminProductStatus],
      limit: PAGE_SIZE,
      offset: (page.value - 1) * PAGE_SIZE,
      order: "-created_at",
      fields: "id,title,handle,status,thumbnail,created_at,collection.title,variants.id,variants.prices.amount,variants.prices.currency_code",
    }),
  { watch: [q, status, page] },
)

const products = computed(() => data.value?.products ?? [])
const total = computed(() => data.value?.count ?? 0)
const filtered = computed(() => !!q.value || status.value !== "all")

async function openCreate() {
  const product = await createModal.open().result
  if (product) {
    await navigateTo(`/products/${product.id}`)
  }
}

async function remove(product: HttpTypes.AdminProduct) {
  const ok = await confirm({
    title: `Delete ${product.title}?`,
    description: "The product and all its variants will be removed. This cannot be undone.",
    confirmLabel: "Delete product",
    danger: true,
    onConfirm: () => medusa.admin.product.delete(product.id),
  })
  if (ok) {
    notify.success("Product deleted")
    await refresh()
  }
}

function rowMenu(product: HttpTypes.AdminProduct): DropdownMenuItem[][] {
  return [
    [{ label: "Open", icon: "i-lucide-arrow-up-right", to: `/products/${product.id}` }],
    [{ label: "Delete", icon: "i-lucide-trash-2", color: "error", onSelect: () => remove(product) }],
  ]
}

const columns: TableColumn<HttpTypes.AdminProduct>[] = [
  {
    accessorKey: "title",
    header: "Product",
    cell: ({ row }) =>
      h("div", { class: "flex items-center gap-4 min-w-0" }, [
        h("div", { class: "size-12 shrink-0 rounded-md bg-elevated overflow-hidden grid place-items-center" }, [
          row.original.thumbnail
            ? h("img", { src: row.original.thumbnail, alt: "", class: "size-full object-cover", loading: "lazy" })
            : h(resolveComponent("UIcon"), { name: "i-lucide-image", class: "size-4 text-dimmed" }),
        ]),
        h("div", { class: "min-w-0" }, [
          h("p", { class: "font-medium text-highlighted truncate" }, row.original.title),
          h("p", { class: "text-muted text-xs truncate mt-0.5" }, row.original.collection?.title ?? `/${row.original.handle}`),
        ]),
      ]),
  },
  {
    id: "variants",
    header: "Variants",
    meta: { class: { th: "hidden md:table-cell", td: "hidden md:table-cell" } },
    cell: ({ row }) => h("span", { class: "tabular-nums" }, String(row.original.variants?.length ?? 0)),
  },
  {
    id: "price",
    header: "Price",
    meta: { class: { th: "hidden md:table-cell", td: "hidden md:table-cell" } },
    cell: ({ row }) =>
      h("span", { class: "tabular-nums" }, priceRange(row.original.variants as never, defaultCurrency.value) ?? "—"),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => h(AppStatus, { status: row.original.status }),
  },
  {
    accessorKey: "created_at",
    header: "Added",
    meta: { class: { th: "hidden lg:table-cell", td: "hidden lg:table-cell" } },
    cell: ({ row }) => formatDate(row.original.created_at),
  },
  {
    id: "actions",
    header: "",
    meta: { class: { td: "w-10 text-right" } },
    cell: ({ row }) =>
      h(
        UDropdownMenu,
        { items: rowMenu(row.original), content: { align: "end" } },
        () =>
          h(UButton, {
            icon: "i-lucide-ellipsis",
            color: "neutral",
            variant: "ghost",
            size: "sm",
            "aria-label": "Actions",
            onClick: (e: Event) => e.stopPropagation(),
          }),
      ),
  },
]

function onSelect(e: Event, row: { original: HttpTypes.AdminProduct }) {
  // Ignore clicks on the action menu.
  if ((e.target as HTMLElement)?.closest("button,[role=menu]")) {
    return
  }
  navigateTo(`/products/${row.original.id}`)
}
</script>

<template>
  <UDashboardPanel id="products" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <UDashboardNavbar :ui="{ root: 'border-b-0 lg:hidden' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="w-full max-w-6xl mx-auto px-5 sm:px-10 pt-2 pb-10 sm:py-14">
        <AppPageHeader eyebrow="Catalogue" title="Products">
          <template #description>
            <span v-if="loadStatus !== 'pending' || data">{{ plural(total, filtered ? "result" : "product") }}</span>
            <span v-else>&nbsp;</span>
          </template>
          <template #actions>
            <UButton label="New product" icon="i-lucide-plus" @click="openCreate" />
          </template>
        </AppPageHeader>

        <div class="flex flex-col-reverse gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between py-4 sm:py-5">
          <nav class="flex items-center gap-1 -mx-5 px-5 sm:mx-0 sm:px-0 sm:-ml-2.5 overflow-x-auto [scrollbar-width:none]" aria-label="Filter by status">
            <button
              v-for="option in productStatusFilters"
              :key="option.value"
              type="button"
              class="px-3 py-2.5 sm:px-2.5 sm:py-1.5 text-sm sm:text-[13px] rounded-md transition-colors whitespace-nowrap"
              :class="status === option.value ? 'text-highlighted bg-elevated' : 'text-muted hover:text-highlighted'"
              @click="setQuery({ status: option.value, page: undefined })"
            >
              {{ option.label }}
            </button>
          </nav>
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search"
            variant="none"
            class="sm:w-64 border-b border-default focus-within:border-inverted transition-colors"
            :ui="{ base: 'px-0 ps-7', leading: 'ps-0' }"
          />
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Could not load products"
          :description="errorMessage(error)"
          :actions="[{ label: 'Try again', color: 'neutral', variant: 'outline', onClick: () => { refresh() } }]"
          class="mt-4"
        />

        <template v-else>
          <template v-if="products.length || loadStatus === 'pending'">
            <!-- Phones: a simple list -->
            <ul class="md:hidden divide-y divide-(--ui-border-muted) border-t border-default">
              <li v-for="product in products" :key="product.id" class="flex items-center">
                <NuxtLink :to="`/products/${product.id}`" class="flex flex-1 items-center gap-4 py-4 min-w-0 active:opacity-70">
                  <div class="size-16 shrink-0 rounded-md bg-elevated overflow-hidden grid place-items-center">
                    <img v-if="product.thumbnail" :src="product.thumbnail" alt="" class="size-full object-cover" loading="lazy">
                    <UIcon v-else name="i-lucide-image" class="size-5 text-dimmed" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-base font-medium text-highlighted truncate">
                      {{ product.title }}
                    </p>
                    <p class="text-sm text-muted truncate mt-0.5 tabular-nums">
                      {{ priceRange(product.variants as never, defaultCurrency) ?? "No price" }}
                      · {{ plural(product.variants?.length ?? 0, "variant") }}
                    </p>
                    <AppStatus :status="product.status" class="mt-1.5 text-[13px]" />
                  </div>
                </NuxtLink>
                <UDropdownMenu :items="rowMenu(product)" :content="{ align: 'end' }">
                  <UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" aria-label="Actions" class="-mr-2" />
                </UDropdownMenu>
              </li>
              <template v-if="loadStatus === 'pending' && !products.length">
                <li v-for="n in 4" :key="n" class="flex items-center gap-4 py-4">
                  <USkeleton class="size-16 rounded-md" />
                  <div class="flex-1 space-y-2">
                    <USkeleton class="h-4 w-2/3" />
                    <USkeleton class="h-3 w-1/3" />
                  </div>
                </li>
              </template>
            </ul>

            <!-- Tablets and up: a table -->
            <UTable
              :data="products"
              :columns="columns"
              :loading="loadStatus === 'pending' && !products.length"
              loading-color="neutral"
              class="-mt-1 max-md:hidden"
              @select="onSelect"
            />
          </template>

          <AppEmpty
            v-else-if="filtered"
            icon="i-lucide-search-x"
            title="Nothing found"
            description="No products match these filters. Try another search or status."
          >
            <UButton label="Clear filters" color="neutral" variant="outline" @click="search = ''; setQuery({ q: undefined, status: undefined, page: undefined })" />
          </AppEmpty>

          <AppEmpty
            v-else
            icon="i-lucide-package"
            title="Your catalogue is empty"
            description="Add your first product to start selling."
          >
            <UButton label="New product" icon="i-lucide-plus" @click="openCreate" />
          </AppEmpty>
        </template>

        <div v-if="total > PAGE_SIZE" class="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between pt-6 mt-2 border-t border-default">
          <p class="text-sm text-muted tabular-nums">
            {{ (page - 1) * PAGE_SIZE + 1 }}–{{ Math.min(page * PAGE_SIZE, total) }} of {{ total }}
          </p>
          <UPagination
            :page="page"
            :total="total"
            :items-per-page="PAGE_SIZE"
            variant="ghost"
            active-variant="soft"
            @update:page="(p: number) => setQuery({ page: p })"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
