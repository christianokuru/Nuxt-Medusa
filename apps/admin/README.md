# Admin app

This store's admin dashboard. The admin itself comes from `packages/admin` (`@nuxt-medusa/admin`); this app only puts it together with the add-ons:

- `nuxt.config.ts`: the admin package plus the Home page and email add-ons
- `layers/`: this store's own extensions (`layers/notes` is an example)
- `.env`: where the backend runs

## Run

```bash
cp .env.template .env
npm run dev          # http://localhost:3001
```

The backend must be running, and `ADMIN_CORS` / `AUTH_CORS` in the backend settings must include this admin's address.

To change the admin's screens, edit `packages/admin`. See its README.
