import { defineAsyncComponent, markRaw, type Component } from "vue"
import type { AdminExtension, AdminNavItem, AdminZoneName } from "./define"

export interface RegisteredWidget {
  key: string
  extensionId: string
  extensionName: string
  order: number
  component: Component
}

export interface AdminExtensionRegistry {
  extensions: AdminExtension[]
  widgetsFor: (zone: AdminZoneName) => RegisteredWidget[]
  nav: (AdminNavItem & { extensionId: string })[]
}

export function createRegistry(extensions: AdminExtension[]): AdminExtensionRegistry {
  const seen = new Set<string>()
  const valid: AdminExtension[] = []
  for (const ext of extensions) {
    if (!ext?.id) {
      console.warn("[admin-kit] Skipped an extension without an id.")
      continue
    }
    if (seen.has(ext.id)) {
      console.warn(`[admin-kit] Skipped duplicate extension "${ext.id}".`)
      continue
    }
    seen.add(ext.id)
    valid.push(ext)
  }

  const byZone = new Map<AdminZoneName, RegisteredWidget[]>()
  for (const ext of valid) {
    ext.widgets?.forEach((widget, index) => {
      const component = markRaw(defineAsyncComponent(async () => {
        const mod = await widget.component()
        return ("default" in (mod as object) ? (mod as { default: Component }).default : mod) as Component
      }))
      const zones = Array.isArray(widget.zone) ? widget.zone : [widget.zone]
      for (const zone of zones) {
        const list = byZone.get(zone) ?? []
        list.push({
          key: `${ext.id}:${index}:${zone}`,
          extensionId: ext.id,
          extensionName: ext.name ?? ext.id,
          order: widget.order ?? 100,
          component,
        })
        byZone.set(zone, list)
      }
    })
  }
  for (const list of byZone.values()) {
    list.sort((a, b) => a.order - b.order)
  }

  const nav = valid
    .flatMap(ext => (ext.nav ?? []).map(item => ({ ...item, extensionId: ext.id })))
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))

  return {
    extensions: valid,
    widgetsFor: zone => byZone.get(zone) ?? [],
    nav,
  }
}
