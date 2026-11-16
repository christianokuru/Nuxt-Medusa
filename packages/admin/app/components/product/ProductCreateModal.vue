<script setup lang="ts">
import type { HttpTypes } from "@medusajs/types"

const emit = defineEmits<{ close: [product: HttpTypes.AdminProduct | null] }>()

const medusa = useMedusa()
const notify = useNotify()
const catalog = useCatalog()

const [
  { data: currencies },
  { data: collections },
  { data: types },
  { data: tags },
  { data: categories },
  { data: channels },
  { data: profiles },
  { data: store },
] = await Promise.all([
  catalog.currencies(),
  catalog.collections(),
  catalog.types(),
  catalog.tags(),
  catalog.categories(),
  catalog.salesChannels(),
  catalog.shippingProfiles(),
  catalog.store(),
])

const steps = [
  { key: "details", label: "Details" },
  { key: "variants", label: "Variants & pricing" },
  { key: "organise", label: "Organise" },
] as const
const step = ref(0)

type Prices = Record<string, number | undefined>
type OptionDraft = { title: string, values: string[] }
type VariantDraft = { enabled: boolean, sku: string, prices: Prices }

const form = reactive({
  title: "",
  subtitle: "",
  handle: "",
  description: "",
  images: [] as { url: string }[],
  hasOptions: false,
  options: [{ title: "", values: [] }] as OptionDraft[],
  single: { sku: "", prices: {} as Prices, manageInventory: true },
  variants: {} as Record<string, VariantDraft>,
  collectionId: undefined as string | undefined,
  typeId: undefined as string | undefined,
  tagIds: [] as string[],
  categoryIds: [] as string[],
  channelIds: (store.value?.default_sales_channel_id
    ? [store.value.default_sales_channel_id]
    : channels.value.slice(0, 1).map(c => c.id)) as string[],
})

// Handle follows the title until the user edits it.
const handleTouched = ref(false)
watch(() => form.title, (title) => {
  if (!handleTouched.value) {
    form.handle = slugify(title)
  }
})

const errors = ref<Record<string, string>>({})
const saving = ref<false | "draft" | "published">(false)

// ----- Options and generated variants -----
const cleanOptions = computed(() =>
  form.options
    .map(o => ({ title: o.title.trim(), values: [...new Set(o.values.map(v => v.trim()).filter(Boolean))] }))
    .filter(o => o.title && o.values.length),
)

const combos = computed(() =>
  cleanOptions.value.length ? combinations(cleanOptions.value.map(o => o.values)) : [],
)

const comboKey = (combo: string[]) => combo.join(" / ")

watch(combos, (list) => {
  for (const combo of list) {
    form.variants[comboKey(combo)] ??= { enabled: true, sku: "", prices: {} }
  }
}, { immediate: true })

const enabledCombos = computed(() => combos.value.filter(c => form.variants[comboKey(c)]?.enabled))

// "Same price for all" helper.
const bulkPrices = ref<Prices>({})
function applyBulkPrices() {
  for (const combo of combos.value) {
    const v = form.variants[comboKey(combo)]
    if (v) {
      v.prices = { ...v.prices, ...Object.fromEntries(Object.entries(bulkPrices.value).filter(([, a]) => a !== undefined)) }
    }
  }
}

function addOption() {
  form.options.push({ title: "", values: [] })
}
function removeOption(index: number) {
  form.options.splice(index, 1)
  if (!form.options.length) {
    form.hasOptions = false
    form.options.push({ title: "", values: [] })
  }
}

// ----- Validation per step -----
function validate(index: number) {
  const e: Record<string, string> = {}
  if (index === 0) {
    if (!form.title.trim()) {
      e.title = "Give the product a title"
    }
    if (form.handle && !/^[a-z0-9-]+$/.test(form.handle)) {
      e.handle = "Use lowercase letters, numbers and dashes"
    }
  }
  if (index === 1 && form.hasOptions) {
    const titles = cleanOptions.value.map(o => o.title.toLowerCase())
    if (!cleanOptions.value.length) {
      e.options = "Add at least one option with values, or turn options off"
    } else if (new Set(titles).size !== titles.length) {
      e.options = "Each option needs a different name"
    } else if (!enabledCombos.value.length) {
      e.options = "Keep at least one variant"
    }
  }
  errors.value = e
  return !Object.keys(e).length
}

function next() {
  if (validate(step.value)) {
    step.value = Math.min(step.value + 1, steps.length - 1)
  }
}
function back() {
  errors.value = {}
  step.value = Math.max(step.value - 1, 0)
}
function goTo(index: number) {
  if (index < step.value) {
    errors.value = {}
    step.value = index
    return
  }
  for (let i = step.value; i < index; i++) {
    if (!validate(i)) {
      step.value = i
      return
    }
  }
  step.value = index
}

// ----- Save -----
const toPrices = (prices: Prices) =>
  Object.entries(prices)
    .filter(([, amount]) => amount !== undefined && amount !== null)
    .map(([currency_code, amount]) => ({ currency_code, amount: Number(amount) }))

function buildPayload(status: "draft" | "published"): HttpTypes.AdminCreateProduct {
  const options = form.hasOptions
    ? cleanOptions.value
    : [{ title: DEFAULT_OPTION_TITLE, values: [DEFAULT_OPTION_VALUE] }]

  const variants: HttpTypes.AdminCreateProductVariant[] = form.hasOptions
    ? enabledCombos.value.map((combo) => {
        const v = form.variants[comboKey(combo)]!
        return {
          title: comboKey(combo),
          sku: v.sku.trim() || undefined,
          manage_inventory: true,
          options: Object.fromEntries(cleanOptions.value.map((o, i) => [o.title, combo[i]!])),
          prices: toPrices(v.prices),
        }
      })
    : [{
        title: "Default variant",
        sku: form.single.sku.trim() || undefined,
        manage_inventory: form.single.manageInventory,
        options: { [DEFAULT_OPTION_TITLE]: DEFAULT_OPTION_VALUE },
        prices: toPrices(form.single.prices),
      }]

  const defaultProfile = profiles.value.find(p => p.type === "default") ?? profiles.value[0]

  return {
    title: form.title.trim(),
    subtitle: form.subtitle.trim() || undefined,
    handle: form.handle || undefined,
    description: form.description.trim() || undefined,
    status,
    images: form.images.map(i => ({ url: i.url })),
    thumbnail: form.images[0]?.url,
    options,
    variants,
    collection_id: form.collectionId || undefined,
    type_id: form.typeId || undefined,
    tags: form.tagIds.map(id => ({ id })),
    categories: form.categoryIds.map(id => ({ id })),
    sales_channels: form.channelIds.map(id => ({ id })),
    shipping_profile_id: defaultProfile?.id,
  }
}

async function save(status: "draft" | "published") {
  for (let i = 0; i < steps.length; i++) {
    if (!validate(i)) {
      step.value = i
      return
    }
  }
  saving.value = status
  try {
    const { product } = await medusa.admin.product.create(buildPayload(status))
    notify.success(status === "published" ? "Product published" : "Draft saved", product.title)
    await refreshNuxtData("products:list")
    emit("close", product)
  } catch (e) {
    notify.error(e, "Could not create product")
  } finally {
    saving.value = false
  }
}

// ----- Tags: pick existing or create new -----
const creatingTag = ref(false)
async function createTag(value: string) {
  const name = value.trim()
  if (!name) {
    return
  }
  creatingTag.value = true
  try {
    const { product_tag } = await medusa.admin.productTag.create({ value: name })
    tags.value = [...tags.value, product_tag]
    form.tagIds = [...form.tagIds, product_tag.id]
  } catch (e) {
    notify.error(e, "Could not add tag")
  } finally {
    creatingTag.value = false
  }
}

const collectionItems = computed(() => collections.value.map(c => ({ label: c.title, value: c.id })))
const typeItems = computed(() => types.value.map(t => ({ label: t.value, value: t.id })))
const tagItems = computed(() => tags.value.map(t => ({ label: t.value, value: t.id })))
const categoryItems = computed(() => categories.value.map(c => ({ label: c.name, value: c.id })))
</script>

<template>
  <UModal
    fullscreen
    :dismissible="false"
    :close="false"
    :ui="{ content: 'bg-default', header: 'hidden', body: 'p-0 sm:p-0', footer: 'border-t border-default px-5 sm:px-10 py-3 sm:py-4 justify-between gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:[&>*]:flex-none' }"
  >
    <template #body>
      <div class="min-h-full flex flex-col">
        <!-- Top bar -->
        <div class="sticky top-0 z-10 bg-default/90 backdrop-blur border-b border-default pt-[env(safe-area-inset-top)]">
          <div class="flex items-center justify-between gap-4 px-5 sm:px-10 h-16">
            <div class="min-w-0">
              <p class="eyebrow">
                New product
              </p>
              <p class="md:hidden text-sm text-highlighted mt-0.5 truncate">
                {{ steps[step]?.label }}
                <span class="text-muted">· {{ step + 1 }} of {{ steps.length }}</span>
              </p>
            </div>
            <ol class="hidden md:flex items-center gap-8">
              <li v-for="(s, i) in steps" :key="s.key">
                <button
                  type="button"
                  class="flex items-center gap-2.5 text-[13px] transition-colors"
                  :class="i === step ? 'text-highlighted' : 'text-muted hover:text-highlighted'"
                  @click="goTo(i)"
                >
                  <span
                    class="size-5 rounded-full grid place-items-center text-[11px] tabular-nums border"
                    :class="i < step ? 'bg-inverted text-inverted border-inverted' : i === step ? 'border-inverted text-highlighted' : 'border-accented'"
                  >
                    <UIcon v-if="i < step" name="i-lucide-check" class="size-3" />
                    <template v-else>{{ i + 1 }}</template>
                  </span>
                  {{ s.label }}
                </button>
              </li>
            </ol>
            <UButton icon="i-lucide-x" color="neutral" variant="ghost" aria-label="Close" :disabled="!!saving" @click="emit('close', null)" />
          </div>
          <div class="h-px bg-transparent">
            <div class="h-px bg-inverted transition-[width] duration-500" :style="{ width: `${((step + 1) / steps.length) * 100}%` }" />
          </div>
        </div>

        <div class="flex-1 w-full max-w-3xl mx-auto px-5 sm:px-10 py-8 sm:py-16">
          <!-- Step 1: Details -->
          <div v-show="step === 0" class="space-y-10">
            <header>
              <p class="eyebrow mb-3 max-md:hidden">
                Step 1 of 3
              </p>
              <h2 class="display text-4xl sm:text-5xl">
                Tell its story
              </h2>
              <p class="text-sm text-muted mt-3">
                The essentials your customers will see first.
              </p>
            </header>

            <div class="space-y-6">
              <UFormField label="Title" required :error="errors.title">
                <UInput v-model="form.title" placeholder="Linen overshirt" size="xl" class="w-full" autofocus :ui="{ base: 'text-lg' }" />
              </UFormField>
              <div class="grid gap-6 sm:grid-cols-2">
                <UFormField label="Subtitle" hint="Optional">
                  <UInput v-model="form.subtitle" placeholder="Relaxed fit, washed linen" class="w-full" />
                </UFormField>
                <UFormField label="Handle" help="Used in the product's web address." :error="errors.handle">
                  <UInput v-model="form.handle" class="w-full" @input="handleTouched = true">
                    <template #leading>
                      <span class="text-sm text-dimmed">/</span>
                    </template>
                  </UInput>
                </UFormField>
              </div>
              <UFormField label="Description" hint="Optional">
                <UTextarea v-model="form.description" :rows="5" autoresize placeholder="Materials, fit, care, what makes it special…" class="w-full" />
              </UFormField>
            </div>

            <div>
              <p class="text-[13px] font-medium text-toned mb-2">
                Images
              </p>
              <ProductMediaUploader v-model="form.images" />
            </div>
          </div>

          <!-- Step 2: Variants & pricing -->
          <div v-show="step === 1" class="space-y-10">
            <header>
              <p class="eyebrow mb-3 max-md:hidden">
                Step 2 of 3
              </p>
              <h2 class="display text-4xl sm:text-5xl">
                Variants &amp; pricing
              </h2>
              <p class="text-sm text-muted mt-3">
                Does it come in different sizes, colours or materials?
              </p>
            </header>

            <div class="border-y border-default">
              <AppToggleRow
                v-model="form.hasOptions"
                label="This product has options"
                description="For example size or colour. Each combination becomes a variant."
              />
            </div>

            <!-- Single variant -->
            <div v-if="!form.hasOptions" class="space-y-6">
              <ProductPriceInputs v-model="form.single.prices" :currencies="currencies" />
              <div class="grid gap-6 sm:grid-cols-2 items-end">
                <UFormField label="SKU" hint="Optional">
                  <UInput v-model="form.single.sku" placeholder="LIN-OVR-01" class="w-full" />
                </UFormField>
                <UCheckbox v-model="form.single.manageInventory" label="Track stock for this product" class="pb-2" />
              </div>
            </div>

            <!-- Options -->
            <div v-else class="space-y-10">
              <div class="space-y-4">
                <div
                  v-for="(option, index) in form.options"
                  :key="index"
                  class="grid grid-cols-[1fr_auto] gap-x-2 gap-y-3 sm:grid-cols-[12rem_1fr_auto] sm:gap-x-3 items-start max-sm:pb-4 max-sm:border-b max-sm:border-muted"
                >
                  <UFormField :label="index === 0 ? 'Option' : undefined" :class="index === 0 ? '' : ''">
                    <UInput v-model="option.title" placeholder="Size" class="w-full" />
                  </UFormField>
                  <UFormField
                    :label="index === 0 ? 'Values' : undefined"
                    :help="index === form.options.length - 1 ? 'Press Enter after each value.' : undefined"
                    class="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto"
                  >
                    <UInputTags v-model="option.values" placeholder="S, M, L" class="w-full" add-on-paste add-on-blur />
                  </UFormField>
                  <UButton
                    icon="i-lucide-x"
                    color="neutral"
                    variant="ghost"
                    aria-label="Remove option"
                    class="col-start-2 row-start-1 sm:col-start-3"
                    :class="index === 0 ? 'mt-6' : ''"
                    @click="removeOption(index)"
                  />
                </div>
                <UButton label="Add another option" icon="i-lucide-plus" color="neutral" variant="link" class="px-0" @click="addOption" />
                <p v-if="errors.options" class="text-sm text-error">
                  {{ errors.options }}
                </p>
              </div>

              <div v-if="combos.length" class="space-y-4">
                <div class="flex items-end justify-between gap-4">
                  <div>
                    <h3 class="font-display text-2xl text-highlighted">
                      {{ plural(enabledCombos.length, "variant") }}
                    </h3>
                    <p class="text-sm text-muted mt-0.5">
                      Untick any combination you don't sell.
                    </p>
                  </div>
                </div>

                <div v-if="currencies.length" class="rounded-md bg-muted p-4 flex flex-col sm:flex-row sm:items-end gap-3">
                  <div class="flex-1">
                    <p class="text-[13px] font-medium text-toned mb-2">
                      Same price for all
                    </p>
                    <ProductPriceInputs v-model="bulkPrices" :currencies="currencies" compact size="sm" />
                  </div>
                  <UButton label="Apply" color="neutral" variant="outline" size="sm" @click="applyBulkPrices" />
                </div>

                <ul class="divide-y divide-(--ui-border-muted) border-y border-default">
                  <li
                    v-for="combo in combos"
                    :key="comboKey(combo)"
                    class="py-4 grid gap-3 sm:grid-cols-[minmax(0,12rem)_1fr] items-start transition-opacity"
                    :class="form.variants[comboKey(combo)]?.enabled ? '' : 'opacity-50'"
                  >
                    <UCheckbox
                      :model-value="form.variants[comboKey(combo)]?.enabled"
                      :label="comboKey(combo)"
                      :aria-label="`Include ${comboKey(combo)}`"
                      class="sm:pt-2 min-w-0 max-sm:min-h-11 max-sm:items-center"
                      :ui="{ label: 'font-medium text-highlighted truncate' }"
                      @update:model-value="(v) => { const d = form.variants[comboKey(combo)]; if (d) d.enabled = !!v }"
                    />
                    <div v-if="form.variants[comboKey(combo)]?.enabled" class="grid gap-3 sm:grid-cols-[9rem_1fr]">
                      <UInput v-model="form.variants[comboKey(combo)]!.sku" placeholder="SKU" size="sm" />
                      <ProductPriceInputs v-model="form.variants[comboKey(combo)]!.prices" :currencies="currencies" compact size="sm" />
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Step 3: Organise -->
          <div v-show="step === 2" class="space-y-10">
            <header>
              <p class="eyebrow mb-3 max-md:hidden">
                Step 3 of 3
              </p>
              <h2 class="display text-4xl sm:text-5xl">
                Where it belongs
              </h2>
              <p class="text-sm text-muted mt-3">
                Group the product and choose where it is sold. All optional.
              </p>
            </header>

            <div class="grid gap-6 sm:grid-cols-2">
              <UFormField label="Collection">
                <USelectMenu
                  v-model="form.collectionId"
                  :items="collectionItems"
                  value-key="value"
                  placeholder="None"
                  :search-input="{ placeholder: 'Search collections' }"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Type">
                <USelectMenu
                  v-model="form.typeId"
                  :items="typeItems"
                  value-key="value"
                  placeholder="None"
                  :search-input="{ placeholder: 'Search types' }"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Categories" class="sm:col-span-2">
                <USelectMenu
                  v-model="form.categoryIds"
                  :items="categoryItems"
                  value-key="value"
                  multiple
                  placeholder="None"
                  :search-input="{ placeholder: 'Search categories' }"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Tags" class="sm:col-span-2" help="Pick existing tags or type a new one.">
                <UInputMenu
                  v-model="form.tagIds"
                  :items="tagItems"
                  value-key="value"
                  multiple
                  create-item
                  :loading="creatingTag"
                  placeholder="Add tags"
                  class="w-full"
                  @create="createTag"
                />
              </UFormField>
            </div>

            <div>
              <p class="text-[13px] font-medium text-toned mb-3">
                Sales channels
              </p>
              <UCheckboxGroup
                v-model="form.channelIds"
                :items="channels.map(c => ({ label: c.name, description: c.description ?? undefined, value: c.id }))"
                variant="card"
                :ui="{ fieldset: 'grid sm:grid-cols-2 gap-2' }"
              />
              <p v-if="!channels.length" class="text-sm text-muted">
                No sales channels yet.
              </p>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <UButton
        v-if="step > 0"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        aria-label="Back"
        :disabled="!!saving"
        @click="back"
      >
        <span class="max-sm:hidden">Back</span>
      </UButton>
      <span v-else />
      <div class="flex items-center gap-2">
        <template v-if="step < steps.length - 1">
          <UButton label="Continue" trailing-icon="i-lucide-arrow-right" @click="next" />
        </template>
        <template v-else>
          <UButton
            color="neutral"
            variant="outline"
            :loading="saving === 'draft'"
            :disabled="!!saving"
            @click="save('draft')"
          >
            Save<span class="max-sm:hidden">&nbsp;as</span>&nbsp;draft
          </UButton>
          <UButton
            label="Publish"
            :loading="saving === 'published'"
            :disabled="!!saving"
            @click="save('published')"
          />
        </template>
      </div>
    </template>
  </UModal>
</template>
