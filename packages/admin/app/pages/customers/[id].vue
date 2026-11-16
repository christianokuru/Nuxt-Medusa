<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui"
import type { HttpTypes } from "@medusajs/types"
import { LazyCustomerAddressModal, LazyCustomerModal } from "#components"

const route = useRoute()
const medusa = useMedusa()
const notify = useNotify()
const confirm = useConfirm()
const overlay = useOverlay()

const id = computed(() => String(route.params.id))

const { data: customer, error, refresh } = await useAsyncData(
  () => `customer:${id.value}`,
  async () => (await medusa.admin.customer.retrieve(id.value, {
    fields: "id,email,first_name,last_name,phone,company_name,has_account,created_at,*addresses,*groups",
  })).customer,
)

const { data: orders, status: ordersStatus } = await useAsyncData(
  () => `customer:${id.value}:orders`,
  async () => {
    const res = await medusa.admin.order.list({
      customer_id: id.value,
      limit: 50,
      order: "-created_at",
      fields: "id,display_id,created_at,status,payment_status,fulfillment_status,total,currency_code",
    } as HttpTypes.AdminOrderFilters)
    return res
  },
)

useHead({ title: () => (customer.value ? customerName(customer.value) : "Customer") })

const orderList = computed(() => orders.value?.orders ?? [])
const spent = computed(() => {
  const byCurrency = new Map<string, number>()
  for (const o of orderList.value) {
    if (o.status !== "canceled") {
      byCurrency.set(o.currency_code, (byCurrency.get(o.currency_code) ?? 0) + Number(o.total ?? 0))
    }
  }
  return [...byCurrency.entries()].map(([c, total]) => formatMoney(total, c)).join(" + ") || formatMoney(0, "eur")
})

async function edit() {
  if (!customer.value) {
    return
  }
  const saved = await overlay.create(LazyCustomerModal).open({ customer: customer.value }).result
  if (saved) {
    notify.success("Customer saved")
    await refresh()
  }
}

async function editAddress(address?: HttpTypes.AdminCustomerAddress) {
  if (!customer.value) {
    return
  }
  const saved = await overlay.create(LazyCustomerAddressModal).open({ customer: customer.value, address }).result
  if (saved) {
    notify.success(address ? "Address saved" : "Address added")
    await refresh()
  }
}

async function removeAddress(address: HttpTypes.AdminCustomerAddress) {
  const c = customer.value
  if (!c) {
    return
  }
  const ok = await confirm({
    title: "Delete this address?",
    confirmLabel: "Delete address",
    danger: true,
    onConfirm: () => medusa.admin.customer.deleteAddress(c.id, address.id),
  })
  if (ok) {
    notify.success("Address deleted")
    await refresh()
  }
}

async function removeCustomer() {
  const c = customer.value
  if (!c) {
    return
  }
  const ok = await confirm({
    title: `Delete ${customerName(c)}?`,
    description: "Their orders are kept. This cannot be undone.",
    confirmLabel: "Delete customer",
    danger: true,
    onConfirm: () => medusa.admin.customer.delete(c.id),
  })
  if (ok) {
    notify.success("Customer deleted")
    await refreshNuxtData("customers:list")
    await navigateTo("/customers")
  }
}

const moreMenu: DropdownMenuItem[][] = [
  [{ label: "Edit details", icon: "i-lucide-pencil", onSelect: edit }],
  [{ label: "Delete customer", icon: "i-lucide-trash-2", color: "error", onSelect: removeCustomer }],
]

function addressMenu(address: HttpTypes.AdminCustomerAddress): DropdownMenuItem[][] {
  return [
    [{ label: "Edit", icon: "i-lucide-pencil", onSelect: () => editAddress(address) }],
    [{ label: "Delete", icon: "i-lucide-trash-2", color: "error", onSelect: () => removeAddress(address) }],
  ]
}

const zoneData = computed(() => ({ customer: customer.value!, refresh: async () => { await refresh() } }))
</script>

<template>
  <UDashboardPanel id="customer" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <UDashboardNavbar :ui="{ root: 'border-b-0 lg:hidden' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="w-full max-w-5xl mx-auto px-5 sm:px-10 pt-0 pb-10 sm:py-10">
        <div class="flex items-center justify-between gap-3 mb-6 sm:mb-10">
          <NuxtLink to="/customers" class="inline-flex items-center gap-2 min-h-11 -ml-1 pl-1 pr-3 text-sm sm:text-[13px] text-muted hover:text-highlighted transition-colors">
            <UIcon name="i-lucide-arrow-left" class="size-4" />
            Customers
          </NuxtLink>
          <UDropdownMenu v-if="customer" :items="moreMenu" :content="{ align: 'end' }">
            <UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" aria-label="More actions" />
          </UDropdownMenu>
        </div>

        <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" title="Could not load this customer" :description="errorMessage(error)" :actions="[{ label: 'Back to customers', color: 'neutral', variant: 'outline', to: '/customers' }]" />

        <template v-else-if="customer">
          <header class="pb-8 sm:pb-10 border-b border-default">
            <div class="flex items-start gap-5">
              <span class="size-14 sm:size-16 shrink-0 rounded-full bg-inverted text-inverted grid place-items-center font-display text-2xl">{{ customerInitials(customer) }}</span>
              <div class="min-w-0">
                <p class="eyebrow mb-2">
                  {{ customer.has_account ? "Customer with account" : "Guest customer" }} · since {{ formatDate(customer.created_at) }}
                </p>
                <h1 class="display text-4xl sm:text-6xl break-words">
                  {{ customerName(customer) }}
                </h1>
                <p v-if="(customer.first_name || customer.last_name) || customer.phone" class="text-sm text-muted mt-2 break-all">
                  {{ [customer.first_name || customer.last_name ? customer.email : null, customer.phone].filter(Boolean).join(" · ") }}
                </p>
              </div>
            </div>

            <dl class="grid grid-cols-2 mt-8 border-y border-default">
              <div class="py-5 pr-4 border-r border-default">
                <dt class="eyebrow">
                  Orders
                </dt>
                <dd class="font-display text-2xl text-highlighted mt-2 tabular-nums">
                  {{ orders?.count ?? 0 }}
                </dd>
              </div>
              <div class="py-5 pl-4 min-w-0">
                <dt class="eyebrow">
                  Spent
                </dt>
                <dd class="font-display text-2xl text-highlighted mt-2 tabular-nums truncate">
                  {{ spent }}
                </dd>
              </div>
            </dl>
          </header>

          <AdminZone name="customer.details.before" :data="zoneData" />

          <AppSection title="Orders" description="Most recent first.">
            <ul v-if="orderList.length" class="divide-y divide-(--ui-border-muted) border-y border-default">
              <li v-for="o in orderList" :key="o.id">
                <NuxtLink :to="`/orders/${o.id}`" class="flex flex-wrap items-center gap-x-4 gap-y-1 py-4 group active:opacity-70">
                  <p class="text-sm font-medium text-highlighted tabular-nums group-hover:underline underline-offset-4 w-14">
                    #{{ o.display_id }}
                  </p>
                  <p class="text-sm text-muted flex-1">
                    {{ formatDate(o.created_at) }}
                  </p>
                  <p class="text-sm text-highlighted tabular-nums">
                    {{ formatMoney(o.total, o.currency_code) }}
                  </p>
                  <div class="basis-full sm:basis-auto flex gap-4 sm:ml-4">
                    <AppDot v-bind="o.status === 'canceled' ? orderStatus('canceled') : paymentStatus(o.payment_status)" class="text-[13px]" />
                    <AppDot v-if="o.status !== 'canceled'" v-bind="fulfillmentStatus(o.fulfillment_status)" class="text-[13px] max-md:hidden" />
                  </div>
                </NuxtLink>
              </li>
            </ul>
            <p v-else-if="ordersStatus !== 'pending'" class="text-sm text-muted py-2">
              No orders yet.
            </p>
          </AppSection>

          <AppSection title="Addresses" description="Saved for checkout." action-label="Add address" action-icon="i-lucide-plus" @action="editAddress()">
            <ul v-if="customer.addresses?.length" class="grid gap-3 sm:grid-cols-2">
              <li v-for="a in customer.addresses" :key="a.id" class="rounded-lg border border-default p-4 sm:p-5 flex gap-3">
                <address class="not-italic text-sm text-toned leading-6 flex-1 min-w-0">
                  <span v-if="a.is_default_shipping" class="eyebrow block mb-2">Default</span>
                  <span v-for="line in addressLines(a as never)" :key="line" class="block">{{ line }}</span>
                  <span v-if="a.phone" class="block text-muted mt-1">{{ a.phone }}</span>
                </address>
                <UDropdownMenu :items="addressMenu(a)" :content="{ align: 'end' }">
                  <UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" size="sm" aria-label="Address actions" />
                </UDropdownMenu>
              </li>
            </ul>
            <p v-else class="text-sm text-muted py-2">
              No saved addresses.
            </p>
          </AppSection>

          <AppSection title="Details" action-label="Edit" action-icon="i-lucide-pencil" @action="edit">
            <dl class="border-y border-default">
              <AppField label="First name" :value="customer.first_name" />
              <AppField label="Last name" :value="customer.last_name" />
              <AppField label="Email" :value="customer.email" />
              <AppField label="Phone" :value="customer.phone" />
              <AppField label="Company" :value="customer.company_name" />
            </dl>
          </AppSection>

          <AdminZone name="customer.details.after" :data="zoneData" />
        </template>

        <div v-else class="space-y-4">
          <USkeleton class="h-14 w-2/3" />
          <USkeleton class="h-32 w-full mt-10" />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
