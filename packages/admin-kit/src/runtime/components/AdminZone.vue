<script setup lang="ts" generic="Z extends AdminZoneName">
import { computed } from "vue"
import type { AdminZoneName, AdminZones } from "../define"
import { useAdminExtensions } from "../composables"
import AdminWidgetBoundary from "./AdminWidgetBoundary.vue"

// A spot where extensions can add widgets. Renders nothing when no widget uses it.
const props = defineProps<{ name: Z, data?: AdminZones[Z] }>()

const registry = useAdminExtensions()
const widgets = computed(() => registry.widgetsFor(props.name))
</script>

<template>
  <template v-if="widgets.length">
    <AdminWidgetBoundary
      v-for="widget in widgets"
      :key="widget.key"
      :name="widget.extensionName"
      :zone="name"
    >
      <component :is="widget.component" :data="data ?? {}" />
    </AdminWidgetBoundary>
  </template>
</template>
