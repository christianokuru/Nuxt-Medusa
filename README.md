# Nuxt-Medusa

A [Medusa](https://medusajs.com) commerce backend with a Vue/Nuxt admin and store instead of the official React ones.

## What's inside

```
apps/
  backend/      Medusa 2 server (React admin turned off)
  admin/        Nuxt admin dashboard (Vue)
  storefront/   Nuxt store                      (coming later)
packages/       Shared Nuxt modules             (coming later)
docker-compose.yml   PostgreSQL + Redis for local development
```

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

The admin is a static site. Build it with `npm run generate --workspace=@nuxt-medusa/admin` and upload `apps/admin/.output/public` to any static host. Add the admin's address to `ADMIN_CORS` and `AUTH_CORS` in the backend settings.

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

## License

MIT. The backend starts from Medusa's official starter, which is also MIT (see `LICENSE`).
