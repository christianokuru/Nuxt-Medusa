# Admin

Vue/Nuxt admin dashboard for Medusa. It replaces Medusa's React admin.

- Nuxt 4, single-page app (runs only in the browser)
- Nuxt UI for components and the dashboard layout
- Medusa's official JS SDK (`@medusajs/js-sdk`) to call the Admin API
- Login uses a session cookie (no tokens in browser storage)

## Run

```bash
cp .env.template .env
npm run dev          # http://localhost:3001
```

The backend must be running, and `ADMIN_CORS` / `AUTH_CORS` in the backend settings must include this admin's address.

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
| `layers/` | Admin extensions (each folder is one). `layers/notes` is an example. |

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
