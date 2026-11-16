# @nuxt-medusa/admin

A Vue/Nuxt admin dashboard for Medusa 2. It replaces Medusa's React admin.

Screens: Orders, Products, Inventory, Customers and Settings (store, currencies, regions). Add-ons bring more, like the Home page (`@nuxt-medusa/medusa-analytics`) and order emails (`@nuxt-medusa/medusa-resend`).

- Nuxt 4 single-page app (runs only in the browser) with Nuxt UI
- Calls the Admin API with Medusa's JS SDK
- Login uses a session cookie (no tokens in browser storage)
- Mobile first, editorial design

## Start a new admin

It's a Nuxt layer, so your admin app is just two small files.

```bash
mkdir my-admin && cd my-admin
npm init -y
npm install nuxt @nuxt-medusa/admin
```

`nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  extends: ["@nuxt-medusa/admin"],
})
```

`.env`:

```
NUXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000
```

Then:

```bash
npx nuxt dev --port 3001        # develop
npx nuxt generate               # build; upload .output/public to any static host
```

In the backend settings, add the admin's address to `ADMIN_CORS` and `AUTH_CORS`.

## Add-ons

Install the add-on and add its admin part to `extends`. Each one also needs its backend part in `medusa-config.ts` (see its README).

```ts
export default defineNuxtConfig({
  extends: [
    "@nuxt-medusa/admin",
    "@nuxt-medusa/medusa-analytics/nuxt-admin", // Home page
    "@nuxt-medusa/medusa-resend/nuxt-admin",    // Settings → Emails
  ],
})
```

Without the analytics add-on, the admin opens on Orders.

## Your own changes

- **Extensions:** put a Nuxt layer with an `admin.extension.ts` in `layers/<name>/` of your admin app. It can add widgets to pages, sidebar links and Settings tabs. See `@nuxt-medusa/admin-kit`.
- **Replace a file:** a file in your app with the same path as one in this package wins. For example, your own `app/pages/orders/index.vue` replaces the Orders page.
- **Colours:** override the CSS variables (`--ui-bg`, `--ui-primary`...) under `:root` (and `.dark` for dark mode) in your own CSS file, added with `css: ["~/assets/css/theme.css"]`. The full list is in `app/assets/css/main.css`.

## Updating

```bash
npm update @nuxt-medusa/admin
```

## Folders

| Folder | What's in it |
| --- | --- |
| `app/plugins/medusa.ts` | The shared Medusa SDK client |
| `app/composables/useAuth.ts` | Login, logout, current user |
| `app/middleware/auth.global.ts` | Sends logged-out users to `/login` |
| `app/layouts/default.vue` | Sidebar and user menu |
| `app/utils/navigation.ts` | Sidebar links |
| `app/pages/` | Pages: `orders`, `products`, `inventory`, `customers`, `settings/store`, `settings/regions`, `login` |
| `app/components/order/`, `customer/`, `inventory/`, `settings/` | Modals for each area |
| `app/utils/orders.ts`, `payments.ts`, `countries.ts` | Status labels, payment provider names, country names and flags |
| `app/components/app/` | Shared pieces: page header, section, field, status, empty state, confirm and form modals |
| `app/components/product/` | Product modals (create, edit details, media, variants, options...) |
| `app/composables/useCatalog.ts` | Shared lists: collections, tags, channels, currencies... |
| `app/assets/css/main.css` | Design tokens: colours, fonts |

## Design

- Editorial and calm: warm paper background, ink-black buttons, thin rules instead of boxes.
- Headings use Instrument Serif (`display` and `font-display` classes); text uses Inter.
- Small uppercase labels use the `eyebrow` class.
- Edits happen in modals over the page. Use `AppFormModal` for new edit forms so they all look and behave the same.
- Fonts are downloaded at build time and served with the app.

## Mobile first

- Base styles are for phones; `sm:` / `md:` / `lg:` add the larger layouts.
- On phones every control is at least 44px tall and form fields use 16px text (no iOS zoom). These rules live in `app/app.config.ts` under `max-sm:`.
- Modals become bottom sheets on phones. The create flow is full screen.
- Lists switch from a table (tablet and up) to a simple list (phones).
- Use `AppToggleRow` for switches so the whole row is tappable.
- Hover-only controls must also show on touch screens (`pointer-coarse:`).
