<script setup lang="ts">
import { h, resolveComponent } from "vue"
import type { TableColumn } from "@nuxt/ui"
import type { HttpTypes } from "@medusajs/types"
import { LazyCustomerModal } from "#components"

useHead({ title: "Customers" })

const AppDot = resolveComponent("AppDot")
const PAGE_SIZE = 20

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
  "customers:list",
  () =>
    medusa.admin.customer.list({
      q: q.value || undefined,
      limit: PAGE_SIZE,
      offset: (page.value - 1) * PAGE_SIZE,
      order: "-created_at",
      fields: "id,email,first_name,last_name,phone,has_account,created_at",
    }),
  { watch: [q, page] },
)

const customers = computed(() => data.value?.customers ?? [])
const total = computed(() => data.value?.count ?? 0)

async function create() {
  const customer = await overlay.create(LazyCustomerModal).open({}).result
  if (customer) {
    notify.success("Customer added")
    await navigateTo(`/customers/${customer.id}`)
  }
}

const account = (c: HttpTypes.AdminCustomer) =>
  c.has_account ? { label: "Account", tone: "success" as const } : { label: "Guest", tone: "neutral" as const }

const columns: TableColumn<HttpTypes.AdminCustomer>[] = [
  {
    id: "name",
    header: "Customer",
    cell: ({ row }) =>
      h("div", { class: "flex items-center gap-3 min-w-0" }, [
        h("span", { class: "size-9 shrink-0 rounded-full bg-elevated grid place-items-center text-xs font-medium text-toned" }, customerInitials(row.original)),
        h("div", { class: "min-w-0" }, [
          h("p", { class: "font-medium text-highlighted truncate" }, customerName(row.original)),
          h("p", { class: "text-xs text-muted truncate mt-0.5" }, customerSubtitle(row.original)),
        ]),
      ]),
  },
  { id: "phone", header: "Phone", meta: { class: { th: "hidden lg:table-cell", td: "hidden lg:table-cell" } }, cell: ({ row }) => row.original.phone || "—" },
  { id: "account", header: "Type", cell: ({ row }) => h(AppDot, account(row.original)) },
  { id: "created", header: "Since", cell: ({ row }) => formatDate(row.original.created_at) },
]
</script>

<template>
  <UDashboardPanel id="customers" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <UDashboardNavbar :ui="{ root: 'border-b-0 lg:hidden' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="w-full max-w-6xl mx-auto px-5 sm:px-10 pt-2 pb-10 sm:py-14">
        <AppPageHeader eyebrow="People" title="Customers">
          <template #description>
            <span v-if="status !== 'pending' || data">{{ plural(total, q ? "result" : "customer") }}</span>
            <span v-else>&nbsp;</span>
          </template>
          <template #actions>
            <UButton label="New customer" icon="i-lucide-plus" @click="create" />
          </template>
        </AppPageHeader>

        <div class="py-4 sm:py-5 flex sm:justify-end">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search name, email or phone"
            variant="none"
            class="w-full sm:w-72 border-b border-default focus-within:border-inverted transition-colors"
            :ui="{ base: 'px-0 ps-7', leading: 'ps-0' }"
          />
        </div>

        <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" title="Could not load customers" :description="errorMessage(error)" :actions="[{ label: 'Try again', color: 'neutral', variant: 'outline', onClick: () => { refresh() } }]" />

        <template v-else-if="customers.length || status === 'pending'">
          <ul class="md:hidden divide-y divide-(--ui-border-muted) border-t border-default">
            <li v-for="c in customers" :key="c.id">
              <NuxtLink :to="`/customers/${c.id}`" class="flex items-center gap-4 py-4 active:opacity-70">
                <span class="size-11 shrink-0 rounded-full bg-elevated grid place-items-center text-sm font-medium text-toned">{{ customerInitials(c) }}</span>
                <div class="min-w-0 flex-1">
                  <p class="text-base font-medium text-highlighted truncate">
                    {{ customerName(c) }}
                  </p>
                  <p v-if="customerSubtitle(c)" class="text-sm text-muted truncate">
                    {{ customerSubtitle(c) }}
                  </p>
                </div>
                <AppDot v-bind="account(c)" class="text-[13px]" />
              </NuxtLink>
            </li>
          </ul>
          <UTable
            :data="customers"
            :columns="columns"
            :loading="status === 'pending' && !customers.length"
            loading-color="neutral"
            class="-mt-1 max-md:hidden"
            @select="(_e: Event, row: { original: HttpTypes.AdminCustomer }) => navigateTo(`/customers/${row.original.id}`)"
          />
        </template>

        <AppEmpty v-else-if="q" icon="i-lucide-search-x" title="Nothing found" description="No customers match that search.">
          <UButton label="Clear search" color="neutral" variant="outline" @click="search = ''" />
        </AppEmpty>
        <AppEmpty v-else icon="i-lucide-users" title="No customers yet" description="Customers appear here when they order or sign up.">
          <UButton label="New customer" icon="i-lucide-plus" @click="create" />
        </AppEmpty>

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
