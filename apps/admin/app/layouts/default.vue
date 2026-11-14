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
  const full = [u.first_name, u.last_name].filter(Boolean).join(" ")
  return full || u.email
})

const userMenu = computed<DropdownMenuItem[][]>(() => [
  [{ label: user.value?.email ?? "", type: "label" }],
  [
    {
      label: colorMode.value === "dark" ? "Light mode" : "Dark mode",
      icon: colorMode.value === "dark" ? "i-lucide-sun" : "i-lucide-moon",
      onSelect: () => {
        colorMode.preference = colorMode.value === "dark" ? "light" : "dark"
      },
    },
  ],
  [{ label: "Log out", icon: "i-lucide-log-out", onSelect: () => logout() }],
])
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      collapsible
      resizable
      :min-size="12"
      :default-size="15"
      :max-size="20"
      :ui="{ footer: 'border-t border-default' }"
    >
      <template #header="{ collapsed }">
        <div class="flex items-center gap-2 min-w-0">
          <UAvatar :text="storeName?.charAt(0)" size="sm" class="rounded-md" />
          <span v-if="!collapsed" class="font-semibold truncate">{{ storeName }}</span>
        </div>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="mainNavigation"
          orientation="vertical"
          tooltip
        />
        <UNavigationMenu
          :collapsed="collapsed"
          :items="footerNavigation"
          orientation="vertical"
          tooltip
          class="mt-auto"
        />
      </template>

      <template #footer="{ collapsed }">
        <UDropdownMenu
          :items="userMenu"
          :content="{ align: 'center', collisionPadding: 12 }"
          :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }"
        >
          <UButton
            :avatar="{ text: displayName.charAt(0).toUpperCase() }"
            :label="collapsed ? undefined : displayName"
            :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
            color="neutral"
            variant="ghost"
            block
            :square="collapsed"
            class="data-[state=open]:bg-elevated"
          />
        </UDropdownMenu>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
