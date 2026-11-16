<script setup lang="ts">
import { LazySettingsStoreCurrenciesModal, LazySettingsStoreDetailsModal } from "#components"

useHead({ title: "Store settings" })

const notify = useNotify()
const overlay = useOverlay()
const { data: store, error, refresh } = await useStoreSettings()
const { data: allCurrencies } = await useAllCurrencies()

const currencies = computed(() =>
  [...(store.value?.supported_currencies ?? [])].sort((a, b) => Number(b.is_default) - Number(a.is_default)),
)

function currencyName(code: string) {
  return allCurrencies.value.find(c => c.code === code)?.name ?? code.toUpperCase()
}

async function open(component: typeof LazySettingsStoreDetailsModal | typeof LazySettingsStoreCurrenciesModal) {
  if (!store.value) {
    return
  }
  const saved = await overlay.create(component).open({ store: store.value }).result
  if (saved) {
    notify.success("Store updated")
    await refresh()
  }
}
</script>

<template>
  <div>
    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" title="Could not load store settings" :description="errorMessage(error)" class="mt-8" />

    <template v-else-if="store">
      <AppSection title="Details" description="Your store's name, shown in the admin." action-label="Edit" action-icon="i-lucide-pencil" @action="open(LazySettingsStoreDetailsModal)">
        <dl class="border-y border-default">
          <AppField label="Name" :value="store.name" />
        </dl>
      </AppSection>

      <AppSection title="Currencies" description="Currencies you can set prices in." action-label="Edit" action-icon="i-lucide-pencil" @action="open(LazySettingsStoreCurrenciesModal)">
        <ul class="divide-y divide-(--ui-border-muted) border-y border-default">
          <li v-for="c in currencies" :key="c.currency_code" class="flex items-center gap-4 py-3.5">
            <span class="w-12 font-display text-xl text-highlighted">{{ currencySymbol(c.currency_code) }}</span>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-highlighted">
                {{ c.currency_code.toUpperCase() }}
              </p>
              <p class="text-xs text-muted truncate">
                {{ currencyName(c.currency_code) }}
              </p>
            </div>
            <span v-if="c.is_default" class="eyebrow text-[10px] border border-default rounded-full px-2 py-0.5">Default</span>
          </li>
        </ul>
      </AppSection>
    </template>
  </div>
</template>
