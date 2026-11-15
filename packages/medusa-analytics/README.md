# @nuxt-medusa/medusa-analytics

Sales analytics for Medusa 2:

- **Backend:** `GET /admin/analytics`: sales per currency, orders, average order, new customers, best sellers, and what needs attention (payments to collect, orders to pack or ship, low stock), compared with the previous period. Admin login required.
- **Admin:** a Home page for the Nuxt Medusa admin, with a period filter (today, 7, 30, 90 days), a sales chart, best sellers and latest orders.

## Install

```bash
npm install @nuxt-medusa/medusa-analytics
```

Backend, `medusa-config.ts`:

```ts
plugins: [{ resolve: "@nuxt-medusa/medusa-analytics", options: {} }]
```

Admin, `nuxt.config.ts`:

```ts
extends: ["@nuxt-medusa/medusa-analytics/nuxt-admin"]
```

## API

```
GET /admin/analytics?from=<ISO>&to=<ISO>&tz=Africa/Lagos&interval=day|hour&compare_from=<ISO>
```

- `from` / `to`: the period (up to 400 days).
- `compare_from`: start of the period to compare with (same length). Default: right before `from`.
- `tz`: time zone for grouping by day or hour.

Cancelled and draft orders don't count as sales. Totals come from Medusa's own order workflow, so they match the Orders page. Very large periods are capped at 5,000 orders (`truncated: true` in the response).

## Admin zones

The Home page has two zones for other extensions: `dashboard.before` and `dashboard.after` (data: `{ range, refresh }`).

## Develop

```bash
npm run build   # compiles src/ into .medusa/server
```
