<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui"

const { user, logout } = useAuth()
const medusa = useMedusa()
const colorMode = useColorMode()

const { data: storeName } = await useAsyncData("store:name", async () => {
  const { stores } = await medusa.admin.store.list({ fields: "name" })
  return stores[0]?.name ?? "Store"
})

const displayName = computed(() => {
  const u = user.value
  if (!u) {
    return ""
  }
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email
})

const userMenu = computed<DropdownMenuItem[][]>(() => [
  [{ label: user.value?.email ?? "", type: "label" }],
  [
    {
      label: colorMode.value === "dark" ? "Light appearance" : "Dark appearance",
      icon: colorMode.value === "dark" ? "i-lucide-sun" : "i-lucide-moon",
      onSelect: () => {
        colorMode.preference = colorMode.value === "dark" ? "light" : "dark"
      },
    },
  ],
  [{ label: "Log out", icon: "i-lucide-log-out", onSelect: () => logout() }],
])

// Built-in groups plus links added by extensions.
const extensions = useAdminExtensions()
const groups = computed(() => {
  const result = navigationGroups.map(g => ({ label: g.label, items: [...g.items] }))
  for (const item of extensions.nav) {
    const label = item.group ?? "Extensions"
    let group = result.find(g => g.label === label)
    if (!group) {
      group = { label, items: [] }
      // An empty group name means "top of the sidebar, no heading".
      if (label === "") {
        result.unshift(group)
      }
      else {
        result.push(group)
      }
    }
    group.items.push({ label: item.label, icon: item.icon ?? "i-lucide-puzzle", to: item.to, exact: item.to === "/" })
  }
  return result.filter(g => g.items.length)
})

const navUi = {
  link: "text-base sm:text-[13px] py-2.5 sm:py-1.5 text-toned data-[disabled]:opacity-40 data-[disabled]:cursor-default",
  linkLeadingIcon: "size-4",
}
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      collapsible
      :default-size="15"
      :ui="{
        root: 'bg-muted/50 border-r border-default',
        header: 'h-auto px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-4',
        body: 'px-3 gap-6',
        footer: 'px-3 py-3 border-t border-default pb-[max(0.75rem,env(safe-area-inset-bottom))]',
      }"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/" class="flex items-center gap-3 min-w-0 min-h-11">
          <span class="size-8 shrink-0 rounded-full bg-inverted text-inverted grid place-items-center font-display text-lg leading-none">
            {{ storeName?.charAt(0) }}
          </span>
          <span v-if="!collapsed" class="font-display text-xl text-highlighted truncate">{{ storeName }}</span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <div v-for="group in groups" :key="group.label">
          <p v-if="!collapsed && group.label" class="eyebrow px-2.5 mb-2">
            {{ group.label }}
          </p>
          <UNavigationMenu
            :collapsed="collapsed"
            :items="group.items"
            orientation="vertical"
            tooltip
            :ui="navUi"
          />
        </div>
        <UNavigationMenu
          :collapsed="collapsed"
          :items="footerNavigation"
          orientation="vertical"
          tooltip
          :ui="navUi"
          class="mt-auto"
        />
      </template>

      <template #footer="{ collapsed }">
        <UDropdownMenu
          :items="userMenu"
          :content="{ align: 'start', side: 'top', collisionPadding: 12 }"
          :ui="{ content: 'w-56' }"
        >
          <UButton
            :avatar="{ text: displayName.charAt(0).toUpperCase(), size: 'xs' }"
            :label="collapsed ? undefined : displayName"
            :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
            color="neutral"
            variant="ghost"
            block
            :square="collapsed"
            class="data-[state=open]:bg-elevated text-[13px] justify-start"
            :ui="{ trailingIcon: 'ms-auto size-3.5 text-dimmed' }"
          />
        </UDropdownMenu>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
