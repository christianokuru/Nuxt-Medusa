<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui"
import type { HttpTypes } from "@medusajs/types"
import { LazyOrderFulfillModal, LazyOrderRefundModal, LazyOrderShipModal } from "#components"

const route = useRoute()
const medusa = useMedusa()
const notify = useNotify()
const confirm = useConfirm()
const overlay = useOverlay()

const id = computed(() => String(route.params.id))

const FIELDS = [
  "id", "display_id", "status", "payment_status", "fulfillment_status", "email", "currency_code",
  "created_at", "canceled_at", "total", "item_subtotal", "shipping_total", "tax_total", "discount_total", "summary",
  "*items", "*shipping_address", "*billing_address", "*customer", "*shipping_methods",
  "*payment_collections", "*payment_collections.payments", "*payment_collections.payments.refunds",
  "*fulfillments", "*fulfillments.items", "*fulfillments.labels",
].join(",")

const { data: order, error, refresh } = await useAsyncData(
  () => `order:${id.value}`,
  async () => (await medusa.admin.order.retrieve(id.value, { fields: FIELDS })).order,
)

useHead({ title: () => (order.value ? `Order #${order.value.display_id}` : "Order") })

const currency = computed(() => order.value?.currency_code ?? "eur")
const money = (amount?: number | null) => formatMoney(amount ?? 0, currency.value)

const payments = computed(() =>
  (order.value?.payment_collections ?? []).flatMap(pc => pc.payments ?? []),
)
const paidTotal = computed(() => Number(order.value?.summary?.paid_total ?? 0))
const refundedTotal = computed(() => Number(order.value?.summary?.refunded_total ?? 0))
const outstanding = computed(() => Number(order.value?.summary?.pending_difference ?? 0))

const unfulfilledCount = computed(() => (order.value?.items ?? []).reduce((n, i) => n + remainingToFulfill(i), 0))
const fulfillments = computed(() =>
  [...((order.value?.fulfillments ?? []) as OrderFulfillment[])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))),
)
const isCanceled = computed(() => order.value?.status === "canceled")

function refundedFor(payment: HttpTypes.AdminPayment) {
  return (payment.refunds ?? []).reduce((n, r) => n + Number(r.amount ?? 0), 0)
}

function fulfillmentState(f: OrderFulfillment) {
  if (f.canceled_at) {
    return { label: "Cancelled", tone: "neutral" as const }
  }
  if (f.delivered_at) {
    return { label: "Delivered", tone: "success" as const }
  }
  if (f.shipped_at) {
    return { label: "Shipped", tone: "success" as const }
  }
  return { label: "Packed, not shipped", tone: "info" as const }
}

function itemTitle(lineItemId?: string | null) {
  const item = order.value?.items?.find(i => i.id === lineItemId)
  return item ? [item.product_title ?? item.title, item.variant_title].filter(Boolean).join(" · ") : "Item"
}

// ----- Actions -----
async function after(message: string) {
  notify.success(message)
  await Promise.all([refresh(), refreshNuxtData("orders:list")])
}

async function capture(payment: HttpTypes.AdminPayment) {
  const ok = await confirm({
    title: `Collect ${money(payment.amount)}?`,
    description: `Take the authorised payment from ${paymentProviderInfo(payment.provider_id).name}.`,
    confirmLabel: "Collect payment",
    onConfirm: () => medusa.admin.payment.capture(payment.id, {}),
  })
  if (ok) {
    await after("Payment collected")
  }
}

async function refund(payment: HttpTypes.AdminPayment) {
  const refundable = Number(payment.amount) - refundedFor(payment)
  const saved = await overlay.create(LazyOrderRefundModal).open({ payment, currency: currency.value, refundable }).result
  if (saved) {
    await after("Refund sent")
  }
}

async function fulfil() {
  if (!order.value) {
    return
  }
  const saved = await overlay.create(LazyOrderFulfillModal).open({ order: order.value }).result
  if (saved) {
    await after("Items fulfilled")
  }
}

async function ship(fulfillment: OrderFulfillment) {
  if (!order.value) {
    return
  }
  const saved = await overlay.create(LazyOrderShipModal).open({ order: order.value, fulfillment }).result
  if (saved) {
    await after("Marked as shipped")
  }
}

async function deliver(fulfillment: OrderFulfillment) {
  const o = order.value
  if (!o) {
    return
  }
  const ok = await confirm({
    title: "Mark as delivered?",
    description: "Confirm the customer has received this parcel.",
    confirmLabel: "Mark delivered",
    onConfirm: () => medusa.admin.order.markAsDelivered(o.id, fulfillment.id),
  })
  if (ok) {
    await after("Marked as delivered")
  }
}

async function cancelFulfillment(fulfillment: OrderFulfillment) {
  const o = order.value
  if (!o) {
    return
  }
  const ok = await confirm({
    title: "Cancel this fulfilment?",
    description: "The items go back to unfulfilled. Shipped parcels can't be cancelled.",
    confirmLabel: "Cancel fulfilment",
    danger: true,
    onConfirm: () => medusa.admin.order.cancelFulfillment(o.id, fulfillment.id, {}),
  })
  if (ok) {
    await after("Fulfilment cancelled")
  }
}

async function cancelOrder() {
  const o = order.value
  if (!o) {
    return
  }
  const ok = await confirm({
    title: `Cancel order #${o.display_id}?`,
    description: "Uncollected payments are released. Collected payments must be refunded separately. This cannot be undone.",
    confirmLabel: "Cancel order",
    danger: true,
    onConfirm: () => medusa.admin.order.cancel(o.id),
  })
  if (ok) {
    await after("Order cancelled")
  }
}

const moreMenu = computed<DropdownMenuItem[][]>(() => [
  [{ label: "Copy order number", icon: "i-lucide-copy", onSelect: () => navigator.clipboard?.writeText(String(order.value?.display_id ?? "")) }],
  [{ label: "Cancel order", icon: "i-lucide-ban", color: "error", disabled: isCanceled.value, onSelect: cancelOrder }],
])

function fulfillmentMenu(f: OrderFulfillment): DropdownMenuItem[][] {
  return [[{ label: "Cancel fulfilment", icon: "i-lucide-undo-2", color: "error", disabled: !!f.shipped_at || !!f.canceled_at, onSelect: () => cancelFulfillment(f) }]]
}
</script>

<template>
  <UDashboardPanel id="order" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <UDashboardNavbar :ui="{ root: 'border-b-0 lg:hidden' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="w-full max-w-6xl mx-auto px-5 sm:px-10 pt-0 pb-10 sm:py-10">
        <div class="flex items-center justify-between gap-3 mb-6 sm:mb-10">
          <NuxtLink to="/orders" class="inline-flex items-center gap-2 min-h-11 -ml-1 pl-1 pr-3 text-sm sm:text-[13px] text-muted hover:text-highlighted transition-colors">
            <UIcon name="i-lucide-arrow-left" class="size-4" />
            Orders
          </NuxtLink>
          <UDropdownMenu v-if="order" :items="moreMenu" :content="{ align: 'end' }">
            <UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" aria-label="More actions" />
          </UDropdownMenu>
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Could not load this order"
          :description="errorMessage(error)"
          :actions="[{ label: 'Back to orders', color: 'neutral', variant: 'outline', to: '/orders' }]"
        />

        <template v-else-if="order">
          <!-- Header -->
          <header class="pb-8 sm:pb-10 border-b border-default">
            <p class="eyebrow mb-3">
              {{ formatDateTime(order.created_at) }}
            </p>
            <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <h1 class="display text-[2.75rem] sm:text-6xl tabular-nums">
                Order #{{ order.display_id }}
              </h1>
              <p class="font-display text-3xl sm:text-4xl text-highlighted tabular-nums">
                {{ money(order.total) }}
              </p>
            </div>
            <div class="flex flex-wrap gap-x-5 gap-y-2 mt-4">
              <AppDot v-if="isCanceled" label="Order cancelled" tone="error" />
              <AppDot v-if="!(isCanceled && order.payment_status === 'canceled')" v-bind="paymentStatus(order.payment_status)" />
              <AppDot v-if="!(isCanceled && order.fulfillment_status === 'canceled')" v-bind="fulfillmentStatus(order.fulfillment_status)" />
            </div>
          </header>

          <AdminZone name="order.details.before" :data="{ order, refresh: async () => { await refresh() } }" />

          <div class="grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
            <!-- Main column -->
            <div class="min-w-0">
              <!-- Items -->
              <section class="py-8 sm:py-10 border-b border-default">
                <h2 class="font-display text-[1.75rem] sm:text-2xl text-highlighted mb-5">
                  Items
                </h2>
                <ul class="divide-y divide-(--ui-border-muted) border-y border-default">
                  <li v-for="item in order.items" :key="item.id" class="flex gap-4 py-4">
                    <div class="size-16 shrink-0 rounded-md bg-elevated overflow-hidden">
                      <img v-if="item.thumbnail" :src="item.thumbnail" alt="" class="size-full object-cover" loading="lazy">
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium text-highlighted">
                        {{ item.product_title ?? item.title }}
                      </p>
                      <p class="text-xs text-muted mt-0.5">
                        {{ [item.variant_title, item.variant_sku].filter(Boolean).join(" · ") }}
                      </p>
                      <p class="text-xs text-muted mt-1.5 tabular-nums">
                        {{ item.quantity }} × {{ money(item.unit_price) }}
                        <span v-if="remainingToFulfill(item) === 0" class="ml-2 text-success">Fulfilled</span>
                      </p>
                    </div>
                    <p class="text-sm text-highlighted tabular-nums shrink-0">
                      {{ money(item.total) }}
                    </p>
                  </li>
                </ul>

                <dl class="mt-5 space-y-2 text-sm sm:max-w-xs sm:ml-auto tabular-nums">
                  <div class="flex justify-between gap-4">
                    <dt class="text-muted">
                      Subtotal
                    </dt><dd class="text-toned">
                      {{ money(order.item_subtotal) }}
                    </dd>
                  </div>
                  <div class="flex justify-between gap-4">
                    <dt class="text-muted">
                      Shipping
                    </dt><dd class="text-toned">
                      {{ money(order.shipping_total) }}
                    </dd>
                  </div>
                  <div v-if="Number(order.discount_total)" class="flex justify-between gap-4">
                    <dt class="text-muted">
                      Discount
                    </dt><dd class="text-toned">
                      −{{ money(order.discount_total) }}
                    </dd>
                  </div>
                  <div class="flex justify-between gap-4">
                    <dt class="text-muted">
                      Tax
                    </dt><dd class="text-toned">
                      {{ money(order.tax_total) }}
                    </dd>
                  </div>
                  <div class="flex justify-between gap-4 pt-3 mt-1 border-t border-default text-base">
                    <dt class="text-highlighted font-medium">
                      Total
                    </dt><dd class="text-highlighted font-medium">
                      {{ money(order.total) }}
                    </dd>
                  </div>
                </dl>
              </section>

              <!-- Payment -->
              <section class="py-8 sm:py-10 border-b border-default">
                <div class="flex items-baseline justify-between gap-4 mb-5">
                  <h2 class="font-display text-[1.75rem] sm:text-2xl text-highlighted">
                    Payment
                  </h2>
                  <p class="text-sm text-muted tabular-nums">
                    Paid {{ money(paidTotal) }}<template v-if="refundedTotal">
                      · Refunded {{ money(refundedTotal) }}
                    </template>
                  </p>
                </div>

                <ul class="divide-y divide-(--ui-border-muted) border-y border-default">
                  <li v-for="payment in payments" :key="payment.id" class="py-4">
                    <div class="flex flex-wrap items-center gap-x-4 gap-y-3">
                      <div class="size-10 shrink-0 rounded-full border border-default grid place-items-center">
                        <UIcon :name="paymentProviderInfo(payment.provider_id).icon" class="size-4 text-muted" />
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium text-highlighted">
                          {{ paymentProviderInfo(payment.provider_id).name }}
                        </p>
                        <p class="text-xs text-muted mt-0.5">
                          <template v-if="payment.canceled_at">
                            Cancelled
                          </template>
                          <template v-else-if="payment.captured_at">
                            Collected {{ formatDate(payment.captured_at) }}
                          </template>
                          <template v-else>
                            Authorised, not collected yet
                          </template>
                        </p>
                      </div>
                      <p class="text-sm text-highlighted tabular-nums">
                        {{ money(payment.amount) }}
                      </p>
                      <div class="flex gap-2 max-sm:basis-full max-sm:[&>*]:flex-1">
                        <UButton
                          v-if="!payment.captured_at && !payment.canceled_at && !isCanceled"
                          label="Collect payment"
                          size="sm"
                          @click="capture(payment)"
                        />
                        <UButton
                          v-if="payment.captured_at && refundedFor(payment) < Number(payment.amount)"
                          label="Refund"
                          color="neutral"
                          variant="outline"
                          size="sm"
                          @click="refund(payment)"
                        />
                      </div>
                    </div>
                    <ul v-if="payment.refunds?.length" class="mt-3 ml-14 space-y-1.5">
                      <li v-for="r in payment.refunds" :key="r.id" class="flex justify-between gap-4 text-xs text-muted tabular-nums">
                        <span>Refund · {{ formatDate(r.created_at) }}<template v-if="r.note"> · {{ r.note }}</template></span>
                        <span>−{{ money(r.amount) }}</span>
                      </li>
                    </ul>
                  </li>
                  <li v-if="!payments.length" class="py-4 text-sm text-muted">
                    No payment yet.
                  </li>
                </ul>
                <p v-if="outstanding > 0 && !isCanceled" class="text-sm text-warning mt-3 tabular-nums">
                  {{ money(outstanding) }} still to collect.
                </p>
              </section>

              <!-- Fulfilment -->
              <section class="py-8 sm:py-10">
                <div class="flex items-center justify-between gap-4 mb-5">
                  <h2 class="font-display text-[1.75rem] sm:text-2xl text-highlighted">
                    Fulfilment
                  </h2>
                  <UButton
                    v-if="unfulfilledCount && !isCanceled"
                    :label="`Fulfil ${plural(unfulfilledCount, 'item')}`"
                    icon="i-lucide-package-check"
                    size="sm"
                    @click="fulfil"
                  />
                </div>

                <ul v-if="fulfillments.length" class="space-y-3">
                  <li v-for="(f, index) in fulfillments" :key="f.id" class="rounded-lg border border-default p-4 sm:p-5">
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <p class="eyebrow">
                          Parcel {{ index + 1 }}
                        </p>
                        <AppDot v-bind="fulfillmentState(f)" class="mt-2" />
                      </div>
                      <UDropdownMenu :items="fulfillmentMenu(f)" :content="{ align: 'end' }">
                        <UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" size="sm" aria-label="Fulfilment actions" />
                      </UDropdownMenu>
                    </div>
                    <ul class="mt-4 space-y-1 text-sm text-toned">
                      <li v-for="fi in f.items" :key="fi.id" class="flex justify-between gap-4">
                        <span class="truncate">{{ itemTitle(fi.line_item_id) }}</span>
                        <span class="tabular-nums text-muted">× {{ fi.quantity }}</span>
                      </li>
                    </ul>
                    <p v-for="label in (f.labels ?? []).filter(l => l.tracking_number)" :key="label.id" class="text-xs text-muted mt-3">
                      Tracking:
                      <a v-if="label.tracking_url && label.tracking_url !== '#'" :href="label.tracking_url" target="_blank" rel="noopener" class="text-highlighted underline underline-offset-4">{{ label.tracking_number }}</a>
                      <span v-else class="text-highlighted">{{ label.tracking_number }}</span>
                    </p>
                    <div v-if="!f.canceled_at && !f.delivered_at" class="flex gap-2 mt-4 max-sm:[&>*]:flex-1">
                      <UButton v-if="!f.shipped_at" label="Mark shipped" icon="i-lucide-truck" size="sm" @click="ship(f)" />
                      <UButton v-else label="Mark delivered" icon="i-lucide-check" size="sm" color="neutral" variant="outline" @click="deliver(f)" />
                    </div>
                  </li>
                </ul>
                <p v-else-if="!unfulfilledCount" class="text-sm text-muted">
                  Nothing to fulfil.
                </p>
                <p v-else class="text-sm text-muted">
                  Nothing packed yet. Fulfil items when they're ready to ship.
                </p>
              </section>
            </div>

            <!-- Side column -->
            <aside class="border-t border-default lg:border-t-0 lg:pt-10 space-y-8 py-8">
              <div>
                <p class="eyebrow mb-3">
                  Customer
                </p>
                <NuxtLink v-if="order.customer?.id" :to="`/customers/${order.customer.id}`" class="group block">
                  <p class="text-base text-highlighted group-hover:underline underline-offset-4">
                    {{ orderCustomerName(order) }}
                  </p>
                </NuxtLink>
                <p v-else class="text-base text-highlighted">
                  {{ orderCustomerName(order) }}
                </p>
                <a v-if="order.email" :href="`mailto:${order.email}`" class="block text-sm text-muted mt-1 break-all hover:text-highlighted">{{ order.email }}</a>
                <p v-if="order.shipping_address?.phone" class="text-sm text-muted mt-1">
                  {{ order.shipping_address.phone }}
                </p>
              </div>

              <div>
                <p class="eyebrow mb-3">
                  Ship to
                </p>
                <address class="not-italic text-sm text-toned leading-6">
                  <span v-for="line in addressLines(order.shipping_address)" :key="line" class="block">{{ line }}</span>
                </address>
                <p v-for="m in order.shipping_methods" :key="m.id" class="text-sm text-muted mt-3">
                  {{ m.name }} · {{ money(m.amount) }}
                </p>
              </div>

              <div v-if="order.billing_address">
                <p class="eyebrow mb-3">
                  Billing address
                </p>
                <address class="not-italic text-sm text-toned leading-6">
                  <span v-for="line in addressLines(order.billing_address)" :key="line" class="block">{{ line }}</span>
                </address>
              </div>
            </aside>
          </div>

          <AdminZone name="order.details.after" :data="{ order, refresh: async () => { await refresh() } }" />
        </template>

        <div v-else class="space-y-4">
          <USkeleton class="h-3 w-32" />
          <USkeleton class="h-14 w-2/3" />
          <USkeleton class="h-40 w-full mt-10" />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
