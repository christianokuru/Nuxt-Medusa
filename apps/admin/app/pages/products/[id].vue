<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui"
import type { HttpTypes } from "@medusajs/types"
import {
  LazyProductAttributesModal,
  LazyProductChannelsModal,
  LazyProductDetailsModal,
  LazyProductMediaModal,
  LazyProductOptionModal,
  LazyProductOrganiseModal,
  LazyProductVariantModal,
} from "#components"

const route = useRoute()
const medusa = useMedusa()
const notify = useNotify()
const confirm = useConfirm()
const overlay = useOverlay()

const id = computed(() => String(route.params.id))

const FIELDS = [
  "*variants",
  "*variants.prices",
  "*variants.options",
  "*options",
  "*options.values",
  "*images",
  "*collection",
  "*type",
  "*tags",
  "*categories",
  "*sales_channels",
].join(",")

const { data: product, error, refresh } = await useAsyncData(
  () => `product:${id.value}`,
  async () => (await medusa.admin.product.retrieve(id.value, { fields: FIELDS })).product,
)

const { data: currencies } = await useCatalog().currencies()
const defaultCurrency = computed(() => currencies.value[0]?.currency_code ?? "eur")

useHead({ title: () => product.value?.title ?? "Product" })

// ----- Gallery -----
const images = computed(() => {
  const list = [...(product.value?.images ?? [])]
  const cover = list.findIndex(i => i.url === product.value?.thumbnail)
  if (cover > 0) {
    list.unshift(...list.splice(cover, 1))
  }
  if (!list.length && product.value?.thumbnail) {
    list.push({ id: "thumbnail", url: product.value.thumbnail } as HttpTypes.AdminProductImage)
  }
  return list
})
const activeImage = ref(0)
watch(images, () => {
  activeImage.value = 0
})

// ----- Derived values -----
const options = computed(() => productOptionsInOrder(product.value))
const realOptions = computed(() => options.value.filter(o => !isDefaultOption(o)))
// Stable order: by rank, then by option values in the order they were defined (S, M, L...).
const variants = computed(() => {
  const sortKey = (v: HttpTypes.AdminProductVariant) =>
    options.value.map((o) => {
      const value = v.options?.find(x => x.option_id === o.id)?.value
      const index = (o.values ?? []).findIndex(x => x.value === value)
      return index < 0 ? 999 : index
    })
  return [...(product.value?.variants ?? [])].sort((a, b) => {
    const rank = (a.variant_rank ?? 0) - (b.variant_rank ?? 0)
    if (rank) {
      return rank
    }
    const ka = sortKey(a)
    const kb = sortKey(b)
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i]) {
        return ka[i]! - kb[i]!
      }
    }
    return (a.title ?? "").localeCompare(b.title ?? "")
  })
})
const price = computed(() => priceRange(product.value?.variants as never, defaultCurrency.value))

function variantPrice(variant: HttpTypes.AdminProductVariant) {
  const p = variant.prices?.find(x => x.currency_code === defaultCurrency.value)
  return p ? formatMoney(p.amount, p.currency_code) : null
}

// ----- Editing -----
async function openModal<T extends Parameters<typeof overlay.create>[0]>(component: T, props: Record<string, unknown> = {}, message = "Changes saved") {
  if (!product.value) {
    return
  }
  const saved = await overlay.create(component).open({ product: product.value, ...props } as never).result
  if (saved) {
    notify.success(message)
    await Promise.all([refresh(), refreshNuxtData("products:list")])
  }
}

const statusSaving = ref(false)
async function setStatus(status: ProductStatus) {
  if (!product.value || product.value.status === status) {
    return
  }
  statusSaving.value = true
  try {
    await medusa.admin.product.update(product.value.id, { status })
    notify.success(status === "published" ? "Product published" : `Status set to ${status}`)
    await refresh()
  } catch (e) {
    notify.error(e, "Could not change status")
  } finally {
    statusSaving.value = false
  }
}

const statusMenu = computed<DropdownMenuItem[]>(() =>
  productStatuses.map(s => ({
    label: s.label,
    description: s.description,
    type: "checkbox" as const,
    checked: product.value?.status === s.value,
    onSelect: () => setStatus(s.value),
  })),
)

async function deleteProduct() {
  const p = product.value
  if (!p) {
    return
  }
  const ok = await confirm({
    title: `Delete ${p.title}?`,
    description: "The product and all its variants will be removed. This cannot be undone.",
    confirmLabel: "Delete product",
    danger: true,
    onConfirm: () => medusa.admin.product.delete(p.id),
  })
  if (ok) {
    notify.success("Product deleted")
    await refreshNuxtData("products:list")
    await navigateTo("/products")
  }
}

async function deleteVariant(variant: HttpTypes.AdminProductVariant) {
  const p = product.value
  if (!p) {
    return
  }
  if (variants.value.length <= 1) {
    notify.error(new Error("A product needs at least one variant."), "Can't delete the last variant")
    return
  }
  const ok = await confirm({
    title: `Delete ${variant.title}?`,
    description: "This variant will be removed from the product.",
    confirmLabel: "Delete variant",
    danger: true,
    onConfirm: () => medusa.admin.product.deleteVariant(p.id, variant.id),
  })
  if (ok) {
    notify.success("Variant deleted")
    await refresh()
  }
}

async function deleteOption(option: HttpTypes.AdminProductOption) {
  const p = product.value
  if (!p) {
    return
  }
  const ok = await confirm({
    title: `Remove ${option.title}?`,
    description: "Options that are used by variants can't be removed. Delete or change those variants first.",
    confirmLabel: "Remove option",
    danger: true,
    onConfirm: () => medusa.admin.product.linkOptions(p.id, { remove: [option.id] }),
  })
  if (ok) {
    notify.success("Option removed")
    await refresh()
  }
}

const moreMenu: DropdownMenuItem[][] = [
  [{ label: "Edit details", icon: "i-lucide-pencil", onSelect: () => openModal(LazyProductDetailsModal) }],
  [{ label: "Delete product", icon: "i-lucide-trash-2", color: "error", onSelect: deleteProduct }],
]

function variantMenu(variant: HttpTypes.AdminProductVariant): DropdownMenuItem[][] {
  return [
    [{ label: "Edit", icon: "i-lucide-pencil", onSelect: () => openModal(LazyProductVariantModal, { variant }, "Variant saved") }],
    [{ label: "Delete", icon: "i-lucide-trash-2", color: "error", onSelect: () => deleteVariant(variant) }],
  ]
}

function optionMenu(option: HttpTypes.AdminProductOption): DropdownMenuItem[][] {
  return [
    [{ label: "Edit", icon: "i-lucide-pencil", onSelect: () => openModal(LazyProductOptionModal, { option }, "Option saved") }],
    [{ label: "Remove", icon: "i-lucide-trash-2", color: "error", onSelect: () => deleteOption(option) }],
  ]
}

// Data passed to extension widgets on this page.
const zoneData = computed(() => ({
  product: product.value!,
  refresh: async () => {
    await refresh()
  },
}))

// Description: show a short version first.
const showFullDescription = ref(false)
const longDescription = computed(() => (product.value?.description?.length ?? 0) > 420)
</script>

<template>
  <UDashboardPanel id="product" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <UDashboardNavbar :ui="{ root: 'border-b-0 lg:hidden' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="w-full max-w-6xl mx-auto px-5 sm:px-10 pt-0 pb-10 sm:py-10">
        <!-- Top bar -->
        <div class="flex items-center justify-between gap-3 mb-6 sm:mb-10">
          <NuxtLink to="/products" class="inline-flex items-center gap-2 min-h-11 -ml-1 pl-1 pr-3 text-sm sm:text-[13px] text-muted hover:text-highlighted transition-colors">
            <UIcon name="i-lucide-arrow-left" class="size-4" />
            Products
          </NuxtLink>
          <div v-if="product" class="flex items-center gap-2">
            <UDropdownMenu :items="statusMenu" :content="{ align: 'end' }" :ui="{ content: 'w-60' }">
              <UButton color="neutral" variant="outline" size="sm" :loading="statusSaving" trailing-icon="i-lucide-chevron-down" :ui="{ trailingIcon: 'size-3.5 text-dimmed' }">
                <AppStatus :status="product.status" />
              </UButton>
            </UDropdownMenu>
            <UDropdownMenu :items="moreMenu" :content="{ align: 'end' }">
              <UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" size="sm" aria-label="More actions" />
            </UDropdownMenu>
          </div>
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Could not load this product"
          :description="errorMessage(error)"
          :actions="[{ label: 'Back to products', color: 'neutral', variant: 'outline', to: '/products' }]"
        />

        <template v-else-if="product">
          <AdminZone name="product.details.before" :data="zoneData" />

          <!-- Hero -->
          <div class="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 pb-10 sm:pb-12 border-b border-default">
            <!-- Phones: name above the image -->
            <div class="lg:hidden">
              <p class="eyebrow mb-3">
                {{ [product.collection?.title, product.type?.value].filter(Boolean).join(" · ") || "Product" }}
              </p>
              <h1 class="display text-[2.75rem] break-words">
                {{ product.title }}
              </h1>
              <p v-if="product.subtitle" class="font-display italic text-xl text-muted mt-2">
                {{ product.subtitle }}
              </p>
            </div>

            <!-- Gallery -->
            <div>
              <div class="relative aspect-square sm:aspect-[4/5] rounded-lg overflow-hidden bg-elevated">
                <img
                  v-if="images[activeImage]"
                  :src="images[activeImage]!.url"
                  :alt="product.title"
                  class="size-full object-cover"
                >
                <button
                  v-else
                  type="button"
                  class="size-full flex flex-col items-center justify-center gap-3 text-muted hover:text-highlighted transition-colors"
                  @click="openModal(LazyProductMediaModal, {}, 'Media updated')"
                >
                  <UIcon name="i-lucide-image-plus" class="size-6" />
                  <span class="text-sm">Add images</span>
                </button>
              </div>
              <div v-if="images.length > 1" class="flex gap-2 mt-3 overflow-x-auto [scrollbar-width:none] -mx-5 px-5 sm:mx-0 sm:px-0">
                <button
                  v-for="(image, index) in images"
                  :key="image.id"
                  type="button"
                  class="size-16 shrink-0 rounded-md overflow-hidden bg-elevated ring-offset-2 ring-offset-(--ui-bg) transition"
                  :class="index === activeImage ? 'ring-1 ring-inverted' : 'opacity-60 hover:opacity-100'"
                  :aria-label="`Show image ${index + 1}`"
                  @click="activeImage = index"
                >
                  <img :src="image.url" alt="" class="size-full object-cover">
                </button>
              </div>
            </div>

            <!-- Summary -->
            <div class="flex flex-col lg:pt-6">
              <p class="eyebrow mb-4 max-lg:hidden">
                {{ [product.collection?.title, product.type?.value].filter(Boolean).join(" · ") || "Product" }}
              </p>
              <h2 class="display text-6xl break-words max-lg:hidden">
                {{ product.title }}
              </h2>
              <p v-if="product.subtitle" class="font-display italic text-2xl text-muted mt-3 max-lg:hidden">
                {{ product.subtitle }}
              </p>

              <div v-if="product.description" class="lg:mt-8 max-w-prose">
                <p
                  class="text-[15px] leading-7 text-toned whitespace-pre-line"
                  :class="longDescription && !showFullDescription ? 'line-clamp-6' : ''"
                >
                  {{ product.description }}
                </p>
                <button
                  v-if="longDescription"
                  type="button"
                  class="mt-1 min-h-11 text-sm sm:text-[13px] text-highlighted underline underline-offset-4"
                  @click="showFullDescription = !showFullDescription"
                >
                  {{ showFullDescription ? "Show less" : "Read more" }}
                </button>
              </div>
              <button
                v-else
                type="button"
                class="lg:mt-8 min-h-11 text-left text-[15px] text-dimmed italic hover:text-muted transition-colors"
                @click="openModal(LazyProductDetailsModal)"
              >
                Add a description…
              </button>

              <dl class="grid grid-cols-2 sm:grid-cols-3 mt-8 sm:mt-10 border-y border-default">
                <div class="py-5 pr-4 col-span-2 sm:col-span-1 max-sm:border-b border-default sm:border-r">
                  <dt class="eyebrow">
                    Price
                  </dt>
                  <dd class="font-display text-2xl text-highlighted mt-2 tabular-nums truncate">
                    {{ price ?? "—" }}
                  </dd>
                </div>
                <div class="py-5 pr-4 sm:px-4 border-r border-default">
                  <dt class="eyebrow">
                    Variants
                  </dt>
                  <dd class="font-display text-2xl text-highlighted mt-2 tabular-nums">
                    {{ variants.length }}
                  </dd>
                </div>
                <div class="py-5 pl-4">
                  <dt class="eyebrow">
                    Channels
                  </dt>
                  <dd class="font-display text-2xl text-highlighted mt-2 tabular-nums">
                    {{ product.sales_channels?.length ?? 0 }}
                  </dd>
                </div>
              </dl>

              <div class="flex flex-wrap items-center gap-x-6 gap-y-1 mt-5 text-[13px] text-muted">
                <span>/{{ product.handle }}</span>
                <span>Added {{ formatDate(product.created_at) }}</span>
              </div>

              <div class="mt-6 sm:mt-8">
                <UButton label="Edit details" icon="i-lucide-pencil" color="neutral" variant="outline" class="max-sm:w-full" @click="openModal(LazyProductDetailsModal)" />
              </div>
            </div>
          </div>

          <!-- Variants -->
          <AppSection
            title="Variants"
            description="The versions customers can buy."
            action-label="Add variant"
            action-icon="i-lucide-plus"
            @action="openModal(LazyProductVariantModal, {}, 'Variant added')"
          >
            <ul class="divide-y divide-(--ui-border-muted) border-y border-default">
              <li
                v-for="variant in variants"
                :key="variant.id"
                class="group flex items-center gap-3 sm:gap-4 py-3 sm:py-4 cursor-pointer active:bg-muted/60"
                @click="openModal(LazyProductVariantModal, { variant }, 'Variant saved')"
              >
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-highlighted truncate group-hover:underline underline-offset-4">
                    {{ variant.title }}
                  </p>
                  <p class="text-xs text-muted mt-0.5 truncate">
                    {{ [variant.sku ?? "No SKU", variantOptionLabel(variant, options)].filter(Boolean).join(" · ") }}
                  </p>
                </div>
                <span class="text-xs text-muted hidden sm:inline">
                  {{ variant.manage_inventory ? "Stock tracked" : "Not tracked" }}
                </span>
                <span class="text-sm text-highlighted tabular-nums sm:w-24 text-right">
                  {{ variantPrice(variant) ?? "—" }}
                </span>
                <UDropdownMenu :items="variantMenu(variant)" :content="{ align: 'end' }">
                  <UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" size="sm" aria-label="Variant actions" @click.stop />
                </UDropdownMenu>
              </li>
            </ul>
          </AppSection>

          <!-- Options -->
          <AppSection
            title="Options"
            description="What makes each variant different."
            action-label="Add option"
            action-icon="i-lucide-plus"
            @action="openModal(LazyProductOptionModal, {}, 'Option added')"
          >
            <ul v-if="realOptions.length" class="divide-y divide-(--ui-border-muted) border-y border-default">
              <li v-for="option in realOptions" :key="option.id" class="flex flex-wrap sm:flex-nowrap items-start gap-x-6 gap-y-2 py-4">
                <p class="text-sm font-medium text-highlighted sm:w-32 shrink-0 pt-1 max-sm:flex-1 max-sm:pt-3">
                  {{ option.title }}
                </p>
                <div class="flex flex-wrap gap-1.5 flex-1 max-sm:order-last max-sm:basis-full">
                  <span
                    v-for="value in option.values"
                    :key="value.id"
                    class="px-2.5 py-1 rounded-full border border-default text-xs text-toned"
                  >
                    {{ value.value }}
                  </span>
                </div>
                <UDropdownMenu :items="optionMenu(option)" :content="{ align: 'end' }">
                  <UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" size="sm" aria-label="Option actions" />
                </UDropdownMenu>
              </li>
            </ul>
            <p v-else class="text-sm text-muted py-2">
              No options. This product is sold as a single item.
            </p>
          </AppSection>

          <!-- Media -->
          <AppSection
            title="Media"
            description="The first image is the cover."
            action-label="Manage"
            action-icon="i-lucide-images"
            @action="openModal(LazyProductMediaModal, {}, 'Media updated')"
          >
            <div v-if="images.length" class="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
              <div v-for="image in images" :key="image.id" class="aspect-[4/5] rounded-md overflow-hidden bg-elevated">
                <img :src="image.url" alt="" class="size-full object-cover" loading="lazy">
              </div>
            </div>
            <p v-else class="text-sm text-muted py-2">
              No images yet.
            </p>
          </AppSection>

          <!-- Organisation -->
          <AppSection
            title="Organisation"
            description="How it's grouped in your store."
            action-label="Edit"
            action-icon="i-lucide-pencil"
            @action="openModal(LazyProductOrganiseModal)"
          >
            <dl class="border-y border-default">
              <AppField label="Collection" :value="product.collection?.title" />
              <AppField label="Type" :value="product.type?.value" />
              <AppField label="Categories" :value="(product.categories ?? []).map(c => c.name).join(', ')" />
              <AppField label="Tags">
                <div v-if="product.tags?.length" class="flex flex-wrap gap-1.5">
                  <span v-for="tag in product.tags" :key="tag.id" class="px-2.5 py-0.5 rounded-full bg-elevated text-xs text-toned">
                    {{ tag.value }}
                  </span>
                </div>
                <span v-else class="text-dimmed">—</span>
              </AppField>
            </dl>
          </AppSection>

          <!-- Availability -->
          <AppSection
            title="Availability"
            description="Sales channels that sell it."
            action-label="Edit"
            action-icon="i-lucide-pencil"
            @action="openModal(LazyProductChannelsModal)"
          >
            <ul v-if="product.sales_channels?.length" class="divide-y divide-(--ui-border-muted) border-y border-default">
              <li v-for="channel in product.sales_channels" :key="channel.id" class="flex items-center gap-3 py-3.5 text-sm">
                <span class="size-1.5 rounded-full bg-emerald-500" />
                <span class="text-highlighted">{{ channel.name }}</span>
              </li>
            </ul>
            <p v-else class="text-sm text-muted py-2">
              Not available in any sales channel, so customers can't buy it.
            </p>
          </AppSection>

          <!-- Attributes -->
          <AppSection
            title="Attributes"
            description="For shipping and customs."
            action-label="Edit"
            action-icon="i-lucide-pencil"
            @action="openModal(LazyProductAttributesModal)"
          >
            <dl class="border-y border-default">
              <AppField label="Weight" :value="product.weight ? `${product.weight} g` : null" />
              <AppField
                label="Dimensions"
                :value="product.length || product.width || product.height ? `${product.length ?? '–'} × ${product.width ?? '–'} × ${product.height ?? '–'} cm` : null"
              />
              <AppField label="Material" :value="product.material" />
              <AppField label="Origin" :value="product.origin_country?.toUpperCase()" />
              <AppField label="HS code" :value="product.hs_code" />
              <AppField label="MID code" :value="product.mid_code" />
            </dl>
          </AppSection>

          <AdminZone name="product.details.after" :data="zoneData" />
        </template>

        <!-- Loading -->
        <div v-else class="grid gap-8 lg:gap-16 lg:grid-cols-[5fr_6fr]">
          <USkeleton class="aspect-square sm:aspect-[4/5] rounded-lg" />
          <div class="space-y-4 pt-6">
            <USkeleton class="h-3 w-24" />
            <USkeleton class="h-14 w-3/4" />
            <USkeleton class="h-4 w-full mt-8" />
            <USkeleton class="h-4 w-5/6" />
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
