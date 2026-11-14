<script setup lang="ts">
// Settings shell: header and tabs. Each tab is a child page.
const route = useRoute()

const tabs = [
  { label: "Store", to: "/settings/store", icon: "i-lucide-store" },
  { label: "Regions", to: "/settings/regions", icon: "i-lucide-globe" },
]
</script>

<template>
  <UDashboardPanel id="settings" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <UDashboardNavbar :ui="{ root: 'border-b-0 lg:hidden' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="w-full max-w-5xl mx-auto px-5 sm:px-10 pt-2 pb-10 sm:py-14">
        <AppPageHeader eyebrow="Settings" title="Your store" description="How your store sells: currencies, regions and payments." />

        <nav class="flex gap-1 -mx-5 px-5 sm:mx-0 sm:px-0 border-b border-default overflow-x-auto [scrollbar-width:none]" aria-label="Settings sections">
          <NuxtLink
            v-for="tab in tabs"
            :key="tab.to"
            :to="tab.to"
            class="relative inline-flex items-center gap-2 px-3 min-h-12 text-sm whitespace-nowrap transition-colors"
            :class="route.path.startsWith(tab.to) ? 'text-highlighted' : 'text-muted hover:text-highlighted'"
          >
            <UIcon :name="tab.icon" class="size-4" />
            {{ tab.label }}
            <span v-if="route.path.startsWith(tab.to)" class="absolute inset-x-3 -bottom-px h-px bg-inverted" />
          </NuxtLink>
        </nav>

        <NuxtPage />
      </div>
    </template>
  </UDashboardPanel>
</template>
