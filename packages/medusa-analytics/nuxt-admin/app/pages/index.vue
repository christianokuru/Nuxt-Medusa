<script setup lang="ts">
import type { HttpTypes } from "@medusajs/types"

useHead({ title: "Home" })

const medusa = useMedusa()
const route = useRoute()
const router = useRouter()
const { user } = useAuth()
const { data: store } = await useStoreSettings()

const range = computed<DashboardRangeKey>(() =>
  dashboardRanges.some(r => r.value === route.query.range) ? (route.query.range as DashboardRangeKey) : "30d",
)
const rangeInfo = computed(() => dashboardRanges.find(r => r.value === range.value)!)

function setRange(value: DashboardRangeKey) {
  router.replace({ query: { ...route.query, range: value === "30d" ? undefined : value } })
}

const { data, status, error, refresh } = await useAsyncData(
  "analytics:summary",
  () => medusa.client.fetch<DashboardSummary>("/admin/analytics", { query: dashboardQuery(range.value) }),
  { watch: [range] },
)

const { data: recent, refresh: refreshRecent } = await useAsyncData("analytics:recent", async () =>
  (await medusa.admin.order.list({
    limit: 5,
    order: "-created_at",
    fields: "id,display_id,created_at,email,total,currency_code,payment_status,*customer,shipping_address.first_name,shipping_address.last_name",
  } as HttpTypes.AdminOrderFilters)).orders,
)

async function reload() {
  await Promise.all([refresh(), refreshRecent()])
}

// Sales are counted per currency. Show the store's default currency first.
const defaultCurrency = computed(() => store.value?.supported_currencies?.find(c => c.is_default)?.currency_code ?? "")
const pickedCurrency = ref<string>()
const currencies = computed(() => {
  const codes = (data.value?.sales ?? []).map(s => s.currency_code)
  if (defaultCurrency.value && !codes.includes(defaultCurrency.value)) {
    codes.unshift(defaultCurrency.value)
  }
  return codes.length ? codes : [defaultCurrency.value || "usd"]
})
const currency = computed(() => {
  if (pickedCurrency.value && currencies.value.includes(pickedCurrency.value)) {
    return pickedCurrency.value
  }
  return currencies.value.includes(defaultCurrency.value) ? defaultCurrency.value : currencies.value[0]!
})
const currencyItems = computed(() => currencies.value.map(c => ({ label: c.toUpperCase(), value: c })))

const sales = computed(() => data.value?.sales.find(s => s.currency_code === currency.value) ?? {
  currency_code: currency.value,
  current: { sales: 0, orders: 0 },
  previous: { sales: 0, orders: 0 },
  buckets: [],
})
const bars = computed(() => chartBars(range.value, sales.value.buckets))
const average = (s: { sales: number, orders: number }) => (s.orders ? s.sales / s.orders : 0)

const stats = computed(() => {
  const d = data.value
  return [
    {
      label: "Orders",
      value: formatCount(d?.orders.current ?? 0),
      change: change(d?.orders.current ?? 0, d?.orders.previous ?? 0),
    },
    {
      label: "Average order",
      value: formatMoney(average(sales.value.current), currency.value),
      change: change(average(sales.value.current), average(sales.value.previous)),
    },
    {
      label: "New customers",
      value: formatCount(d?.customers.current ?? 0),
      change: change(d?.customers.current ?? 0, d?.customers.previous ?? 0),
    },
  ]
})
const salesChange = computed(() => change(sales.value.current.sales, sales.value.previous.sales))

function changeText(value: number | null) {
  if (value === null) {
    return ""
  }
  const rounded = Math.round(Math.abs(value))
  if (rounded === 0) {
    return "No change"
  }
  return `${value > 0 ? "Up" : "Down"} ${rounded}%`
}
const changeClass = (value: number | null) =>
  value === null || Math.round(value) === 0 ? "text-muted" : value > 0 ? "text-success" : "text-error"
const changeIcon = (value: number | null) =>
  value === null || Math.round(value) === 0 ? "i-lucide-minus" : value > 0 ? "i-lucide-arrow-up-right" : "i-lucide-arrow-down-right"

const attention = computed(() => {
  const a = data.value?.attention
  if (!a) {
    return []
  }
  return [
    { label: "Payments to collect", count: a.to_collect, to: "/orders?status=pending", icon: "i-lucide-credit-card" },
    { label: "Orders to pack", count: a.to_pack, to: "/orders?status=pending", icon: "i-lucide-package-open" },
    { label: "Packed, not shipped", count: a.to_ship, to: "/orders?status=pending", icon: "i-lucide-truck" },
    { label: "Out of stock", count: a.out_of_stock, to: "/inventory", icon: "i-lucide-circle-slash" },
    { label: "Low stock", count: a.low_stock, to: "/inventory", icon: "i-lucide-battery-low" },
  ].filter(item => item.count > 0)
})

const NuxtLink = resolveComponent("NuxtLink")
const showTable = ref(false)
const firstName = computed(() => user.value?.first_name?.trim() ?? "")
const today = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(new Date())
const refreshing = computed(() => status.value === "pending" && !!data.value)
</script>

<template>
  <UDashboardPanel id="home" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <UDashboardNavbar :ui="{ root: 'border-b-0 lg:hidden' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="w-full max-w-6xl mx-auto px-5 sm:px-10 pt-2 pb-10 sm:py-14">
        <AppPageHeader :eyebrow="today" :title="firstName ? `${greeting()}, ${firstName}` : greeting()">
          <template #description>
            Here's how {{ store?.name ?? "your store" }} is doing.
          </template>
        </AppPageHeader>

        <AdminZone name="dashboard.before" :data="{ range, refresh: reload }" />

        <!-- One row of filters that applies to everything below. -->
        <div class="flex items-center justify-between gap-3 py-4 sm:py-5">
          <nav class="flex items-center gap-1 -ml-2.5 sm:-ml-2.5 overflow-x-auto [scrollbar-width:none]" aria-label="Time period">
            <button
              v-for="option in dashboardRanges"
              :key="option.value"
              type="button"
              class="px-3 py-2.5 sm:px-2.5 sm:py-1.5 text-sm sm:text-[13px] rounded-md transition-colors whitespace-nowrap"
              :class="range === option.value ? 'text-highlighted bg-elevated' : 'text-muted hover:text-highlighted'"
              :aria-pressed="range === option.value"
              @click="setRange(option.value)"
            >
              {{ option.label }}
            </button>
          </nav>
          <USelect
            v-if="currencies.length > 1"
            :model-value="currency"
            :items="currencyItems"
            variant="ghost"
            size="sm"
            class="w-24 shrink-0"
            aria-label="Currency"
            @update:model-value="(v: string) => pickedCurrency = v"
          />
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Could not load the summary"
          :description="errorMessage(error)"
          :actions="[{ label: 'Try again', color: 'neutral', variant: 'outline', onClick: () => { reload() } }]"
          class="mb-6"
        />

        <div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-14 border-t border-default pt-8 sm:pt-10">
          <!-- Sales -->
          <section class="min-w-0 transition-opacity" :class="refreshing ? 'opacity-60' : ''" aria-labelledby="sales-title">
            <p id="sales-title" class="text-sm text-muted">
              Sales
            </p>
            <template v-if="data">
              <p class="mt-2 text-5xl sm:text-6xl font-semibold tracking-tight text-highlighted break-words">
                {{ formatMoney(sales.current.sales, currency) }}
              </p>
              <p class="mt-3 text-sm flex items-center gap-1.5">
                <template v-if="salesChange !== null">
                  <span class="inline-flex items-center gap-1 font-medium" :class="changeClass(salesChange)">
                    <UIcon :name="changeIcon(salesChange)" class="size-4" />
                    {{ changeText(salesChange) }}
                  </span>
                  <span class="text-muted">vs {{ rangeInfo.compareLabel }}</span>
                </template>
                <span v-else class="text-muted">Nothing to compare with in the {{ rangeInfo.compareLabel }}</span>
              </p>
            </template>
            <template v-else>
              <USkeleton class="mt-3 h-14 w-56" />
              <USkeleton class="mt-4 h-4 w-40" />
            </template>

            <dl class="grid grid-cols-3 mt-8 border-y border-default divide-x divide-(--ui-border)">
              <div v-for="stat in stats" :key="stat.label" class="py-4 px-3 sm:px-5 first:pl-0 min-w-0">
                <dt class="text-xs sm:text-sm text-muted truncate">
                  {{ stat.label }}
                </dt>
                <dd class="mt-1.5 text-lg sm:text-2xl font-semibold text-highlighted truncate">
                  <template v-if="data">
                    {{ stat.value }}
                  </template>
                  <USkeleton v-else class="h-7 w-16" />
                </dd>
                <dd v-if="data && stat.change !== null" class="mt-1 text-xs inline-flex items-center gap-0.5" :class="changeClass(stat.change)">
                  <UIcon :name="changeIcon(stat.change)" class="size-3.5" />
                  {{ Math.round(Math.abs(stat.change)) }}%
                </dd>
              </div>
            </dl>

            <div class="mt-12 sm:mt-14">
              <div class="flex items-center justify-between mb-4">
                <p class="text-sm text-muted">
                  {{ range === "today" ? "By hour" : range === "90d" ? "By week" : "By day" }}
                </p>
                <UButton
                  :label="showTable ? 'Show chart' : 'Show table'"
                  :icon="showTable ? 'i-lucide-chart-column' : 'i-lucide-table'"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  class="-mr-2"
                  @click="showTable = !showTable"
                />
              </div>
              <AnalyticsSalesChart v-if="data" :bars="bars" :currency="currency" :table="showTable" />
              <USkeleton v-else class="h-52 w-full" />
            </div>
          </section>

          <!-- Needs attention -->
          <aside class="min-w-0" aria-labelledby="attention-title">
            <h2 id="attention-title" class="font-display text-[1.75rem] sm:text-2xl text-highlighted leading-tight">
              Needs attention
            </h2>
            <ul v-if="attention.length" class="mt-4 divide-y divide-(--ui-border-muted) border-y border-default">
              <li v-for="item in attention" :key="item.label">
                <NuxtLink :to="item.to" class="flex items-center gap-3 py-3.5 min-h-11 group active:opacity-70">
                  <UIcon :name="item.icon" class="size-4 text-muted shrink-0" />
                  <span class="flex-1 text-sm text-toned group-hover:text-highlighted transition-colors">{{ item.label }}</span>
                  <span class="text-sm font-semibold text-highlighted tabular-nums">{{ formatCount(item.count) }}</span>
                  <UIcon name="i-lucide-chevron-right" class="size-4 text-dimmed" />
                </NuxtLink>
              </li>
            </ul>
            <div v-else-if="data" class="mt-4 py-6 border-y border-default">
              <p class="text-sm text-toned flex items-center gap-2">
                <UIcon name="i-lucide-check" class="size-4 text-success" />
                All caught up.
              </p>
              <p class="text-sm text-muted mt-1">
                No orders waiting and stock looks fine.
              </p>
            </div>
            <div v-else class="mt-4 space-y-3">
              <USkeleton v-for="n in 3" :key="n" class="h-8 w-full" />
            </div>

            <template v-if="data?.attention.stock_items.length">
              <p class="eyebrow mt-8 mb-3">
                Running low
              </p>
              <ul class="space-y-2.5">
                <li v-for="item in data.attention.stock_items" :key="item.id" class="flex items-baseline justify-between gap-3 text-sm">
                  <span class="text-toned truncate">{{ item.title }}</span>
                  <span class="tabular-nums shrink-0" :class="item.available <= 0 ? 'text-error' : 'text-highlighted'">
                    {{ item.available <= 0 ? "None left" : `${formatCount(item.available)} left` }}
                  </span>
                </li>
              </ul>
            </template>
          </aside>
        </div>

        <div class="grid gap-10 lg:grid-cols-2 lg:gap-14 mt-14 sm:mt-16 pt-8 sm:pt-10 border-t border-default">
          <!-- Best sellers -->
          <section class="min-w-0" aria-labelledby="best-title">
            <div class="flex items-baseline justify-between gap-4">
              <h2 id="best-title" class="font-display text-[1.75rem] sm:text-2xl text-highlighted leading-tight">
                Best sellers
              </h2>
              <p class="text-xs text-muted">
                Units sold
              </p>
            </div>
            <ol v-if="data?.top_products.length" class="mt-4 divide-y divide-(--ui-border-muted) border-y border-default">
              <li v-for="(product, i) in data.top_products" :key="product.product_id ?? product.title">
                <component
                  :is="product.product_id ? NuxtLink : 'div'"
                  :to="product.product_id ? `/products/${product.product_id}` : undefined"
                  class="flex items-center gap-4 py-3 min-h-11 group active:opacity-70"
                >
                  <span class="w-4 text-sm text-dimmed tabular-nums">{{ i + 1 }}</span>
                  <span class="size-10 rounded-md bg-elevated overflow-hidden shrink-0">
                    <img v-if="product.thumbnail" :src="product.thumbnail" alt="" class="size-full object-cover" loading="lazy">
                  </span>
                  <span class="flex-1 min-w-0 text-sm text-toned group-hover:text-highlighted truncate transition-colors">{{ product.title }}</span>
                  <span class="text-sm font-semibold text-highlighted tabular-nums">{{ formatCount(product.quantity) }}</span>
                </component>
              </li>
            </ol>
            <p v-else-if="data" class="mt-4 py-6 border-y border-default text-sm text-muted">
              No sales in this period yet.
            </p>
            <div v-else class="mt-4 space-y-3">
              <USkeleton v-for="n in 3" :key="n" class="h-10 w-full" />
            </div>
          </section>

          <!-- Recent orders -->
          <section class="min-w-0" aria-labelledby="recent-title">
            <div class="flex items-baseline justify-between gap-4">
              <h2 id="recent-title" class="font-display text-[1.75rem] sm:text-2xl text-highlighted leading-tight">
                Latest orders
              </h2>
              <NuxtLink to="/orders" class="text-sm text-muted hover:text-highlighted transition-colors py-2 -my-2">
                View all
              </NuxtLink>
            </div>
            <ul v-if="recent?.length" class="mt-4 divide-y divide-(--ui-border-muted) border-y border-default">
              <li v-for="order in recent" :key="order.id">
                <NuxtLink :to="`/orders/${order.id}`" class="flex items-center gap-4 py-3 min-h-11 group active:opacity-70">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm text-highlighted truncate">
                      <span class="font-medium tabular-nums">#{{ order.display_id }}</span>
                      <span class="text-toned ml-1.5">{{ orderCustomerName(order) }}</span>
                    </p>
                    <p class="text-xs text-muted mt-0.5">
                      {{ formatDateTime(order.created_at) }}
                    </p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="text-sm text-highlighted tabular-nums">
                      {{ formatMoney(order.total, order.currency_code) }}
                    </p>
                    <AppDot v-bind="paymentStatus(order.payment_status)" class="text-xs mt-0.5" />
                  </div>
                </NuxtLink>
              </li>
            </ul>
            <p v-else class="mt-4 py-6 border-y border-default text-sm text-muted">
              No orders yet. They'll show up here as they come in.
            </p>
          </section>
        </div>

        <p v-if="data?.truncated" class="mt-8 text-xs text-muted">
          This period has a lot of orders, so these figures only cover the latest 5,000 orders and stock items.
        </p>

        <AdminZone name="dashboard.after" :data="{ range, refresh: reload }" />
      </div>
    </template>
  </UDashboardPanel>
</template>
