<script setup lang="ts">
import { h, resolveComponent } from "vue"
import type { TableColumn } from "@nuxt/ui"
import type { HttpTypes } from "@medusajs/types"

useHead({ title: "Orders" })

const AppDot = resolveComponent("AppDot")
const PAGE_SIZE = 20

const medusa = useMedusa()
const route = useRoute()
const router = useRouter()

type StatusFilter = (typeof orderStatusFilters)[number]["value"]

const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const status = computed<StatusFilter>(() => {
  const value = route.query.status
  return orderStatusFilters.some(o => o.value === value) ? (value as StatusFilter) : "all"
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
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => setQuery({ q: value.trim(), page: undefined }), 300)
})

const { data, status: loadStatus, error, refresh } = await useAsyncData(
  "orders:list",
  () =>
    medusa.admin.order.list({
      q: q.value || undefined,
      status: status.value === "all" ? undefined : [status.value],
      limit: PAGE_SIZE,
      offset: (page.value - 1) * PAGE_SIZE,
      order: "-created_at",
      fields: "id,display_id,created_at,email,status,payment_status,fulfillment_status,total,currency_code,*customer,shipping_address.first_name,shipping_address.last_name,shipping_address.country_code",
    } as HttpTypes.AdminOrderFilters),
  { watch: [q, status, page] },
)

const orders = computed(() => data.value?.orders ?? [])
const total = computed(() => data.value?.count ?? 0)
const filtered = computed(() => !!q.value || status.value !== "all")

const columns: TableColumn<HttpTypes.AdminOrder>[] = [
  {
    id: "order",
    header: "Order",
    cell: ({ row }) =>
      h("div", [
        h("p", { class: "font-medium text-highlighted tabular-nums" }, `#${row.original.display_id}`),
        h("p", { class: "text-xs text-muted mt-0.5" }, formatDate(row.original.created_at)),
      ]),
  },
  {
    id: "customer",
    header: "Customer",
    cell: ({ row }) =>
      h("div", { class: "min-w-0" }, [
        h("p", { class: "text-highlighted truncate" }, orderCustomerName(row.original)),
        h("p", { class: "text-xs text-muted truncate mt-0.5" }, row.original.email ?? ""),
      ]),
  },
  {
    id: "payment",
    header: "Payment",
    cell: ({ row }) => h(AppDot, paymentStatus(row.original.payment_status)),
  },
  {
    id: "fulfillment",
    header: "Fulfilment",
    meta: { class: { th: "hidden lg:table-cell", td: "hidden lg:table-cell" } },
    cell: ({ row }) => h(AppDot, fulfillmentStatus(row.original.fulfillment_status)),
  },
  {
    id: "total",
    header: () => h("span", { class: "block text-right" }, "Total"),
    cell: ({ row }) => h("p", { class: "text-right tabular-nums text-highlighted" }, formatMoney(row.original.total, row.original.currency_code)),
  },
]
</script>

<template>
  <UDashboardPanel id="orders" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <UDashboardNavbar :ui="{ root: 'border-b-0 lg:hidden' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="w-full max-w-6xl mx-auto px-5 sm:px-10 pt-2 pb-10 sm:py-14">
        <AppPageHeader eyebrow="Sales" title="Orders">
          <template #description>
            <span v-if="loadStatus !== 'pending' || data">{{ plural(total, filtered ? "result" : "order") }}</span>
            <span v-else>&nbsp;</span>
          </template>
        </AppPageHeader>

        <AdminZone name="order.list.before" />

        <div class="flex flex-col-reverse gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between py-4 sm:py-5">
          <nav class="flex items-center gap-1 -mx-5 px-5 sm:mx-0 sm:px-0 sm:-ml-2.5 overflow-x-auto [scrollbar-width:none]" aria-label="Filter by status">
            <button
              v-for="option in orderStatusFilters"
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
            placeholder="Search by email or number"
            variant="none"
            class="sm:w-72 border-b border-default focus-within:border-inverted transition-colors"
            :ui="{ base: 'px-0 ps-7', leading: 'ps-0' }"
          />
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Could not load orders"
          :description="errorMessage(error)"
          :actions="[{ label: 'Try again', color: 'neutral', variant: 'outline', onClick: () => { refresh() } }]"
        />

        <template v-else-if="orders.length || loadStatus === 'pending'">
          <!-- Phones -->
          <ul class="md:hidden divide-y divide-(--ui-border-muted) border-t border-default">
            <li v-for="order in orders" :key="order.id">
              <NuxtLink :to="`/orders/${order.id}`" class="block py-4 active:opacity-70">
                <div class="flex items-baseline justify-between gap-3">
                  <p class="text-base font-medium text-highlighted tabular-nums">
                    #{{ order.display_id }}
                    <span class="font-normal text-muted text-sm ml-1">{{ formatDate(order.created_at) }}</span>
                  </p>
                  <p class="text-base text-highlighted tabular-nums">
                    {{ formatMoney(order.total, order.currency_code) }}
                  </p>
                </div>
                <p class="text-sm text-toned truncate mt-1">
                  {{ orderCustomerName(order) }}
                </p>
                <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  <AppDot v-bind="paymentStatus(order.payment_status)" class="text-[13px]" />
                  <AppDot v-bind="fulfillmentStatus(order.fulfillment_status)" class="text-[13px]" />
                </div>
              </NuxtLink>
            </li>
            <template v-if="loadStatus === 'pending' && !orders.length">
              <li v-for="n in 5" :key="n" class="py-4 space-y-2">
                <USkeleton class="h-4 w-1/2" />
                <USkeleton class="h-3 w-1/3" />
              </li>
            </template>
          </ul>

          <!-- Tablets and up -->
          <UTable
            :data="orders"
            :columns="columns"
            :loading="loadStatus === 'pending' && !orders.length"
            loading-color="neutral"
            class="-mt-1 max-md:hidden"
            @select="(_e: Event, row: { original: HttpTypes.AdminOrder }) => navigateTo(`/orders/${row.original.id}`)"
          />
        </template>

        <AppEmpty
          v-else-if="filtered"
          icon="i-lucide-search-x"
          title="Nothing found"
          description="No orders match these filters."
        >
          <UButton label="Clear filters" color="neutral" variant="outline" @click="search = ''; setQuery({ q: undefined, status: undefined, page: undefined })" />
        </AppEmpty>

        <AppEmpty
          v-else
          icon="i-lucide-shopping-bag"
          title="No orders yet"
          description="Orders from your store will appear here."
        />

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
