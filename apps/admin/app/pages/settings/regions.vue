<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui"
import type { HttpTypes } from "@medusajs/types"
import { LazySettingsRegionModal } from "#components"

useHead({ title: "Regions" })

const medusa = useMedusa()
const notify = useNotify()
const confirm = useConfirm()
const overlay = useOverlay()

const { data: regions, status, error, refresh } = await useAsyncData("settings:regions", async () =>
  (await medusa.admin.region.list({
    limit: 200,
    order: "name",
    fields: "id,name,currency_code,automatic_taxes,*countries,*payment_providers",
  })).regions,
{ default: () => [] as HttpTypes.AdminRegion[] })

function takenCountries(except?: string) {
  const map: Record<string, string> = {}
  for (const r of regions.value) {
    if (r.id === except) {
      continue
    }
    for (const c of r.countries ?? []) {
      if (c.iso_2) {
        map[c.iso_2] = r.name
      }
    }
  }
  return map
}

async function openRegion(region?: HttpTypes.AdminRegion) {
  const saved = await overlay.create(LazySettingsRegionModal).open({ region, takenCountries: takenCountries(region?.id) }).result
  if (saved) {
    notify.success(region ? "Region saved" : "Region created")
    await refresh()
  }
}

async function remove(region: HttpTypes.AdminRegion) {
  const ok = await confirm({
    title: `Delete ${region.name}?`,
    description: "Customers in these countries won't be able to check out until you add them to another region.",
    confirmLabel: "Delete region",
    danger: true,
    onConfirm: () => medusa.admin.region.delete(region.id),
  })
  if (ok) {
    notify.success("Region deleted")
    await refresh()
  }
}

function menu(region: HttpTypes.AdminRegion): DropdownMenuItem[][] {
  return [
    [{ label: "Edit", icon: "i-lucide-pencil", onSelect: () => openRegion(region) }],
    [{ label: "Delete", icon: "i-lucide-trash-2", color: "error", onSelect: () => remove(region) }],
  ]
}
</script>

<template>
  <div>
    <AppSection
      title="Regions"
      description="Where you sell, in which currency, and how customers pay."
      action-label="New region"
      action-icon="i-lucide-plus"
      @action="openRegion()"
    >
      <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" title="Could not load regions" :description="errorMessage(error)" />

      <ul v-else-if="regions.length" class="divide-y divide-(--ui-border-muted) border-y border-default">
        <li v-for="region in regions" :key="region.id" class="flex items-start gap-3 py-5">
          <button type="button" class="min-w-0 flex-1 text-left group" @click="openRegion(region)">
            <div class="flex items-baseline gap-3">
              <p class="font-display text-2xl text-highlighted leading-tight group-hover:underline underline-offset-4 decoration-1">
                {{ region.name }}
              </p>
              <span class="text-xs text-muted tabular-nums">{{ region.currency_code.toUpperCase() }}</span>
            </div>
            <p class="text-sm text-muted mt-1.5 leading-relaxed">
              <template v-if="region.countries?.length">
                <span class="mr-1">{{ region.countries.slice(0, 8).map(c => countryFlag(c.iso_2 ?? "")).join(" ") }}</span>
                {{ region.countries.length > 8 ? `+${region.countries.length - 8} · ` : "· " }}{{ plural(region.countries.length, "country", "countries") }}
              </template>
              <template v-else>
                No countries yet
              </template>
            </p>
            <div class="flex flex-wrap gap-1.5 mt-3">
              <span
                v-for="p in region.payment_providers ?? []"
                :key="p.id"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-default text-xs text-toned"
              >
                <UIcon :name="paymentProviderInfo(p.id).icon" class="size-3.5" />
                {{ paymentProviderInfo(p.id).name }}
              </span>
              <span v-if="!region.payment_providers?.length" class="text-xs text-warning">No payment options</span>
            </div>
          </button>
          <UDropdownMenu :items="menu(region)" :content="{ align: 'end' }">
            <UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" aria-label="Region actions" />
          </UDropdownMenu>
        </li>
      </ul>

      <AppEmpty
        v-else-if="status !== 'pending'"
        icon="i-lucide-globe"
        title="No regions yet"
        description="Add a region to start selling in a country."
      >
        <UButton label="New region" icon="i-lucide-plus" @click="openRegion()" />
      </AppEmpty>
    </AppSection>
  </div>
</template>
