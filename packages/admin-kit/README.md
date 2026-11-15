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
    // Group can be an existing one ("Commerce", "Marketing"), a new one,
    // or "" for the very top of the sidebar (no heading).
    { label: "Reviews", to: "/reviews", icon: "i-lucide-star", group: "Marketing" },
  ],
  settings: [
    // A tab on the Settings page. Add the page as app/pages/settings/reviews.vue
    { label: "Reviews", to: "/settings/reviews", icon: "i-lucide-star" },
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
| `dashboard.before` | Home page, under the greeting | `{ range, refresh }` (range: `today`, `7d`, `30d`, `90d`) |
| `dashboard.after` | Home page, at the bottom | `{ range, refresh }` |
| `product.list.before` | Products list, under the header | `{}` |
| `product.list.after` | Products list, at the bottom | `{}` |
| `product.details.before` | Product page, above the main details | `{ product, refresh }` |
| `product.details.after` | Product page, after the last section | `{ product, refresh }` |
| `order.list.before` | Orders list, under the header | `{}` |
| `order.details.before` | Order page, under the header | `{ order, refresh }` |
| `order.details.after` | Order page, at the bottom | `{ order, refresh }` |
| `customer.details.before` | Customer page, under the header | `{ customer, refresh }` |
| `customer.details.after` | Customer page, at the bottom | `{ customer, refresh }` |

To add a zone: add it to `AdminZones` in `src/runtime/define.ts`, then place `<AdminZone name="..." :data="..." />` in the page.

## Extensions inside a package

The best way to share an extension between projects is to ship it **inside the Medusa plugin it belongs to**, in a `nuxt-admin/` folder. Then one package holds both the backend and the admin part. See `packages/medusa-resend` and `packages/medusa-analytics`:

```
my-plugin/
├── src/                     # Medusa plugin (API routes, subscribers...)
└── nuxt-admin/
    ├── package.json         # { "type": "module" }
    ├── nuxt.config.ts       # export default defineNuxtConfig({})
    ├── admin.extension.ts
    └── app/...
```

In the plugin's `package.json`: `"exports": { "./nuxt-admin": "./nuxt-admin/nuxt.config.ts", ... }` and add `nuxt-admin` to `files`.

The admin then uses it with:

```ts
export default defineNuxtConfig({
  extends: ["my-plugin/nuxt-admin"],
})
```

In `admin.extension.ts` of a package, import the helper instead of relying on auto-imports:

```ts
import { defineAdminExtension } from "@nuxt-medusa/admin-kit/define"
```

Inside `app/`, auto-imports work as usual, including the admin's own components and composables.

Icons used in extension layers (including `admin.extension.ts`) are found and bundled automatically.

## Backend data

Widgets talk to the Medusa backend through `useMedusa()`. To store simple values, use the `metadata` field that most Medusa records have (the Notes example does this). For real data models, build a Medusa backend plugin with its own module and API routes, and call those routes with `useMedusa().client.fetch("/admin/your-route")`.
