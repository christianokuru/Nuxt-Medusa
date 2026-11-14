<script setup lang="ts">
import { h, resolveComponent } from "vue"
import type { TableColumn } from "@nuxt/ui"
import type { HttpTypes } from "@medusajs/types"

useHead({ title: "Products" })

const UBadge = resolveComponent("UBadge")
const UAvatar = resolveComponent("UAvatar")

const PAGE_SIZE = 20

const medusa = useMedusa()
const route = useRoute()
const router = useRouter()

// Filters live in the URL, so a filtered list can be shared or reloaded.
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const status = computed<ProductStatusFilter>(() => {
  const value = route.query.status
  return productStatusOptions.some(o => o.value === value)
    ? (value as ProductStatusFilter)
    : "all"
})
const q = computed(() => (typeof route.query.q === "string" ? route.query.q : ""))

function setQuery(next: Record<string, string | number | undefined>) {
  const query = { ...route.query, ...next }
  for (const key of Object.keys(query)) {
    if (query[key] === undefined || query[key] === "" || query[key] === "all") {
      delete query[key]
    }
  }
  if (query.page === 1 || query.page === "1") {
    delete query.page
  }
  router.replace({ query })
}

// Search box: update the URL a moment after the user stops typing.
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
      fields: "id,title,handle,status,thumbnail,created_at,*collection,*sales_channels,variants.id",
    }),
  { watch: [q, status, page] },
)

const products = computed(() => data.value?.products ?? [])
const total = computed(() => data.value?.count ?? 0)

const columns: TableColumn<HttpTypes.AdminProduct>[] = [
  {
    accessorKey: "title",
    header: "Product",
    cell: ({ row }) =>
      h("div", { class: "flex items-center gap-3 min-w-0" }, [
        h(UAvatar, {
          src: row.original.thumbnail ?? undefined,
          alt: row.original.title,
          icon: "i-lucide-image",
          size: "lg",
          class: "rounded-md",
        }),
        h("div", { class: "min-w-0" }, [
          h("p", { class: "font-medium text-highlighted truncate" }, row.original.title),
          h("p", { class: "text-muted text-xs truncate" }, `/${row.original.handle}`),
        ]),
      ]),
  },
  {
    id: "collection",
    header: "Collection",
    cell: ({ row }) => row.original.collection?.title ?? "-",
  },
  {
    id: "sales_channels",
    header: "Sales channels",
    cell: ({ row }) => {
      const channels = row.original.sales_channels ?? []
      if (!channels.length) {
        return "-"
      }
      const [first, ...rest] = channels
      return rest.length ? `${first?.name} +${rest.length}` : first?.name
    },
  },
  {
    id: "variants",
    header: "Variants",
    cell: ({ row }) => {
      const count = row.original.variants?.length ?? 0
      return `${count} ${count === 1 ? "variant" : "variants"}`
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) =>
      h(
        UBadge,
        { color: productStatusColor(row.original.status), variant: "subtle" },
        () => capitalize(row.original.status),
      ),
  },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ row }) => formatDate(row.original.created_at),
  },
]
</script>

<template>
  <UDashboardPanel id="products">
    <template #header>
      <UDashboardNavbar title="Products">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton label="Create" icon="i-lucide-plus" disabled />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search products"
            class="w-full sm:w-72"
          />
        </template>
        <template #right>
          <USelect
            :model-value="status"
            :items="[...productStatusOptions]"
            class="w-40"
            @update:model-value="(value) => setQuery({ status: value as string, page: undefined })"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Could not load products"
        :description="errorMessage(error)"
        :actions="[{ label: 'Try again', onClick: () => { refresh() } }]"
      />

      <UTable
        v-else
        :data="products"
        :columns="columns"
        :loading="loadStatus === 'pending'"
        :empty="q || status !== 'all' ? 'No products match your filters.' : 'No products yet.'"
        sticky
        class="shrink-0"
      />

      <div v-if="total > PAGE_SIZE" class="flex items-center justify-between gap-3 pt-4 mt-auto border-t border-default">
        <p class="text-sm text-muted">
          {{ (page - 1) * PAGE_SIZE + 1 }}-{{ Math.min(page * PAGE_SIZE, total) }} of {{ total }}
        </p>
        <UPagination
          :page="page"
          :total="total"
          :items-per-page="PAGE_SIZE"
          @update:page="(p: number) => setQuery({ page: p })"
        />
      </div>
      <p v-else-if="total" class="text-sm text-muted pt-4 mt-auto">
        {{ total }} {{ total === 1 ? "product" : "products" }}
      </p>
    </template>
  </UDashboardPanel>
</template>
