import { useNuxtApp } from "#app"
import type { AdminExtensionRegistry } from "./registry"

/** Registered extensions, their widgets per zone, and their sidebar links. */
export const useAdminExtensions = (): AdminExtensionRegistry => useNuxtApp().$adminExtensions as AdminExtensionRegistry
