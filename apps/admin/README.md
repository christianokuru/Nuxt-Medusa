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
| `app/pages/` | Pages (`login`, `products`, `products/[id]`) |
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
