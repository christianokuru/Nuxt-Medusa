# admin-kit

The extension system for the Nuxt Medusa admin. It lets you add things to the admin without editing its core files:

- **Widgets**: components shown in named spots (zones) on admin pages.
- **Pages**: normal Nuxt pages, with an optional link in the sidebar.

This is the Vue/Nuxt version of Medusa's React admin widgets and UI routes.

## How it works

An extension is a **Nuxt layer** with an `admin.extension.ts` file at its root.

```
apps/admin/layers/reviews/
├── nuxt.config.ts            # can be empty: export default defineNuxtConfig({})
├── admin.extension.ts        # what the extension adds (widgets, sidebar links)
└── app/
    ├── components/
    │   └── ReviewsWidget.vue # a widget
    └── pages/
        └── reviews/index.vue # a page at /reviews
```

Folders in `apps/admin/layers/` are picked up automatically. **Restart the dev server after adding a new extension folder.**

See `apps/admin/layers/notes/` for a full working example.

## admin.extension.ts

```ts
export default defineAdminExtension({
  id: "reviews",          // unique
  name: "Reviews",        // shown in error messages
  widgets: [
    {
      zone: "product.details.after",
      component: () => import("./app/components/ReviewsWidget.vue"),
      order: 10,          // optional, lower shows first (default 100)
    },
  ],
  nav: [
    // Group can be an existing one ("Commerce", "Marketing") or a new one.
    { label: "Reviews", to: "/reviews", icon: "i-lucide-star", group: "Marketing" },
  ],
})
```

Widgets are loaded only when their zone is on screen.

## Writing a widget

A widget receives one prop, `data`, whose type depends on the zone:

```vue
<script setup lang="ts">
import type { AdminWidgetProps } from "@nuxt-medusa/admin-kit/define"

const props = defineProps<AdminWidgetProps<"product.details.after">>()
// props.data.product   -> the product
// props.data.refresh() -> reload the product after you change it
</script>

<template>
  <AppSection title="Reviews" description="What customers say.">
    ...
  </AppSection>
</template>
```

Inside the admin, a widget can use everything the admin offers:

- **Medusa API:** `useMedusa()` (the Medusa JS SDK, already logged in)
- **Messages:** `useNotify()` for success and error messages, `useConfirm()` for "Are you sure?" dialogs
- **Building blocks:** `AppSection`, `AppField`, `AppStatus`, `AppEmpty`, `AppPageHeader`, `AppFormModal`, `AppToggleRow`
- **Nuxt UI components** (`UButton`, `UInput`, ...)

Using these keeps extensions looking like the rest of the admin, on both desktop and phones.

If a widget throws an error, only that widget is hidden. The rest of the page keeps working. In development, a short note shows which extension failed.

## Zones

| Zone | Where | `data` |
| --- | --- | --- |
| `product.list.before` | Products list, under the header | `{}` |
| `product.list.after` | Products list, at the bottom | `{}` |
| `product.details.before` | Product page, above the main details | `{ product, refresh }` |
| `product.details.after` | Product page, after the last section | `{ product, refresh }` |

To add a zone: add it to `AdminZones` in `src/runtime/define.ts`, then place `<AdminZone name="..." :data="..." />` in the page.

## Extensions as npm packages

An extension can also be published as a package (for example next to a Medusa backend plugin). Same layout. Add it to the admin's `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  extends: ["@acme/medusa-reviews-admin"],
})
```

For packages, Nuxt does not auto-import inside `node_modules`, so import what you use:

```ts
import { defineAdminExtension } from "@nuxt-medusa/admin-kit/define"
```

Icons are bundled at build time from the admin's own files and `layers/`. If a packaged extension uses other icons, list them in the admin's `icon.clientBundle.icons`.

## Backend data

Widgets talk to the Medusa backend through `useMedusa()`. To store simple values, use the `metadata` field that most Medusa records have (the Notes example does this). For real data models, build a Medusa backend plugin with its own module and API routes, and call those routes with `useMedusa().client.fetch("/admin/your-route")`.
