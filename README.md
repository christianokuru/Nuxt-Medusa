# Nuxt-Medusa

A [Medusa](https://medusajs.com) commerce backend with a Vue/Nuxt admin and store instead of the official React ones.

## What's inside

```
apps/
  backend/            Medusa 2 server (React admin turned off)
  admin/              This store's admin: the admin package + add-ons
  storefront/         Nuxt store                          (coming later)
packages/             Reusable: install them in other projects too
  admin/              The Nuxt admin dashboard (Vue), as an installable Nuxt layer
  paystack/           Paystack payments (any Node.js app + Medusa provider)
  flutterwave/        Flutterwave payments (any Node.js app + Medusa provider)
  medusa-analytics/   Sales summary API + admin Home page
  medusa-resend/      Order emails with Resend + admin email settings
  admin-kit/          Extension system for the admin (widgets, pages, settings tabs)
docker-compose.yml    PostgreSQL + Redis for local development
```

This project uses its own packages exactly like another project would, so they're always tested together.

## Requirements

- Node.js 22.23+
- Docker (for PostgreSQL and Redis), or your own PostgreSQL 15+ and Redis

## Getting started

```bash
# 1. Install everything
npm install

# 2. Start PostgreSQL and Redis
npm run services:up

# 3. Create the backend settings file
cp apps/backend/.env.template apps/backend/.env

# 4. Create the database tables and starter data
npm run backend:migrate

# 5. Create an admin user
npm run backend:user -- -e admin@example.com -p supersecret

# 6. Start everything
npm run dev
```

- Backend: http://localhost:9000 (check http://localhost:9000/health)
- Admin: http://localhost:3001 (log in with the user from step 5)

Admin screens: Home (sales summary), Orders, Products, Inventory, Customers, Settings (store, currencies, regions, payments, emails).

The Home page shows sales, orders, average order and new customers for today, 7, 30 or 90 days (compared with the period before), a sales chart, best sellers, the latest orders, and what needs attention (payments to collect, orders to pack or ship, low stock). It comes from `packages/medusa-analytics`.

Optional: add demo products with `npm run backend:seed`.

## Settings (apps/backend/.env)

| Setting | What it does |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection. Any Postgres works, including Supabase. |
| `DATABASE_SSL` | Set to `true` for hosted databases that need SSL. |
| `REDIS_URL` | Redis for cache, events, workflows and locks. Leave empty to use in-memory versions (local dev only). |
| `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS` | Websites allowed to call the API. |
| `JWT_SECRET`, `COOKIE_SECRET` | Use long random values in production. |
| `MEDUSA_WORKER_MODE` | `shared` for dev. In production run one `server` and one `worker`. |

## Admin settings (apps/admin/.env)

| Setting | What it does |
| --- | --- |
| `NUXT_PUBLIC_MEDUSA_BACKEND_URL` | Where the backend runs. Default `http://localhost:9000`. |

The admin is a static site. Build it with `npm run generate --workspace=@nuxt-medusa/admin-app` and upload `apps/admin/.output/public` to any static host. Add the admin's address to `ADMIN_CORS` and `AUTH_CORS` in the backend settings.

## Payments: Paystack and Flutterwave

Both come from `packages/paystack` and `packages/flutterwave`. Each turns on only when its key is set.

1. Add the keys to `apps/backend/.env`:

   | Setting | Where to find it |
   | --- | --- |
   | `PAYSTACK_SECRET_KEY` | Paystack dashboard → Settings → API Keys & Webhooks (`sk_test_...` or `sk_live_...`) |
   | `PAYSTACK_CALLBACK_URL` | Your store page that finishes checkout after payment |
   | `FLUTTERWAVE_SECRET_KEY` | Flutterwave dashboard → Settings → API Keys |
   | `FLUTTERWAVE_WEBHOOK_HASH` | Any secret you choose; enter the same value in Flutterwave → Settings → Webhooks |
   | `FLUTTERWAVE_REDIRECT_URL` | Your store page that finishes checkout after payment |

2. Set the webhook URLs in each dashboard:
   - Paystack: `https://<your-backend>/hooks/payment/paystack_paystack`
   - Flutterwave: `https://<your-backend>/hooks/payment/flutterwave_flutterwave`
3. Restart the backend.
4. In the admin, go to **Settings → Store → Currencies** and add the currency (for example NGN).
5. In **Settings → Regions**, create or edit a region with that currency and tick Paystack and/or Flutterwave.

How payments are checked:
- Paystack webhooks are verified with an HMAC-SHA512 signature of the raw body (`x-paystack-signature`).
- Flutterwave webhooks are verified with the `verif-hash` header.
- In both cases the payment is then confirmed with the provider's API before the order is marked paid, and the amount and currency must match.
- Both providers charge immediately, so successful payments show as "Paid" (no separate collect step).

Run the tests with `npm run packages:test`.

## Order emails (Resend)

Customers get an email when they order, when you ship (with tracking links) and when it's delivered. From `packages/medusa-resend`.

1. Create a [Resend](https://resend.com) account, verify your domain and create an API key.
2. Add to `apps/backend/.env`:

   | Setting | What it does |
   | --- | --- |
   | `RESEND_API_KEY` | Your Resend key (`re_...`). Emails are off while this is empty. |
   | `RESEND_FROM` | Sender, e.g. `My Shop <orders@myshop.com>` (domain verified in Resend) |
   | `RESEND_REPLY_TO` | Optional. Where replies go. |
   | `STOREFRONT_URL`, `SUPPORT_EMAIL`, `EMAIL_LOGO_URL` | Optional. Shown in the emails. |
   | `ORDER_URL` | Optional. Link to an order on your store, e.g. `https://myshop.com/account/orders/{id}` |

3. Restart the backend. In the admin, **Settings → Emails** shows the status, previews every email and sends tests. Each order page shows which emails were sent, with "Send again".

The store name in emails is the one set in **Settings → Store**.

## Using Supabase as the database

1. Use the **Session pooler** connection string (port 5432), not the Transaction pooler.
2. Set `DATABASE_SSL=true`.
3. Turn off Supabase's Data API (or remove `public` from its exposed schemas). Otherwise Medusa's tables can be read with your public key.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start all apps |
| `npm run backend:dev` | Start only the backend |
| `npm run admin:dev` | Start only the admin |
| `npm run typecheck` | Type-check the admin |
| `npm run backend:migrate` | Run database migrations |
| `npm run backend:seed` | Add demo products |
| `npm run backend:user -- -e EMAIL -p PASSWORD` | Create an admin user |
| `npm run services:up` / `services:down` | Start or stop PostgreSQL and Redis |
| `npm run lint` | Lint all apps |
| `npm run packages:build` | Build the packages (runs on `npm install` too) |
| `npm run packages:test` | Test the packages |
| `npm run packages:pack` | Make installable `.tgz` files in `dist-packages/` |

## Admin extensions

Add widgets to admin pages, pages to the sidebar and tabs to Settings without touching the admin's core files. Drop a Nuxt layer with an `admin.extension.ts` into `apps/admin/layers/`, or ship it inside a plugin package (like `medusa-resend`). See `packages/admin-kit/README.md` and the example in `apps/admin/layers/notes/`.

## Using the packages in other projects

Each package has its own README with setup steps. The payment packages also work in projects without Medusa (any Node.js server, including Nuxt server routes).

A new store's admin is two small files: install `nuxt` and `@nuxt-medusa/admin`, then `extends: ["@nuxt-medusa/admin"]` in `nuxt.config.ts`. See `packages/admin/README.md`.

npm can't install one folder of a GitHub repo directly, so pick one of these:

**1. npm (simplest to install).** Publish once per version:

```bash
npm login
npm publish --workspace=packages/paystack --access public   # repeat for each package
```

The `@nuxt-medusa` scope must belong to you on npmjs.com (create a free organisation with that name, or rename the packages to your own scope). Then anywhere: `npm install @nuxt-medusa/paystack`.

**2. GitHub releases (no npm account).**

```bash
npm run packages:pack        # creates dist-packages/*.tgz
```

Attach the `.tgz` files to a GitHub release. Other projects install from the file's link:

```bash
npm install https://github.com/<owner>/<repo>/releases/download/v0.1.0/nuxt-medusa-paystack-0.1.0.tgz
```

This works when the repository is public. For a private repository, use option 1 with private packages, or copy the `.tgz` files into the other project and install them from there (`npm install ./vendor/nuxt-medusa-paystack-0.1.0.tgz`).

**3. While developing on the same computer:** `npm install /path/to/Nuxt-Medusa/packages/paystack`.

## License

MIT. The backend starts from Medusa's official starter, which is also MIT (see `LICENSE`).
