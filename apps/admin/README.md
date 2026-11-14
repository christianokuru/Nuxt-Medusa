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
| `app/pages/` | Pages (`login`, `products`) |
