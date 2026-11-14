# Backend

Medusa 2 server, started from Medusa's official starter.

Changes from the starter:

- The React admin is turned off (`admin.disable` in `medusa-config.ts`), and its packages are removed.
- Redis is used for cache, events, workflows and locks when `REDIS_URL` is set. Without it, in-memory versions are used.
- `DATABASE_SSL=true` turns on SSL for hosted databases such as Supabase.

See the root `README.md` for setup.

## Where things go

| What | Folder |
| --- | --- |
| API routes | `src/api/store/...`, `src/api/admin/...` |
| Business logic | `src/workflows/` |
| Custom data models | `src/modules/` |
| Links between modules | `src/links/` |
| Event handlers | `src/subscribers/` |
| Scheduled jobs | `src/jobs/` |
| One-off scripts | `src/scripts/` |
| Product search index | `src/search/` |
| Starter data (runs on migrate) | `src/migration-scripts/` |
