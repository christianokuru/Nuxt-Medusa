# AGENTS.md

## Project

Medusa 2 backend with Vue/Nuxt front ends instead of the official React admin and Next.js store.

- `apps/backend` - Medusa server. React admin is disabled; do not add `src/admin` or React packages.
  - Uses the reusable packages below (payments, analytics, emails), wired up in `medusa-config.ts`. Payment and email providers are turned on only when their keys are set.
- `apps/admin` - this store's admin app: only `nuxt.config.ts` (extends `@nuxt-medusa/admin` + plugin admin layers), `layers/` (local extensions, e.g. `layers/notes`) and `.env`. Admin screens live in `packages/admin`.
- `packages/admin` - the admin itself, a Nuxt layer: Nuxt 4 admin (SPA, `ssr: false`) with Nuxt UI. Calls the Admin API through `useMedusa()` (`@medusajs/js-sdk`, session auth). Pages need login unless `definePageMeta({ public: true })`.
  - Design: editorial (Instrument Serif headings, Inter body, warm neutrals, hairline rules). Reuse `app/components/app/*` (AppPageHeader, AppSection, AppField, AppStatus, AppEmpty, AppFormModal, AppConfirmModal) and `useConfirm()` / `useNotify()`. Edits open in modals via `useOverlay()`.
- `apps/storefront` - Nuxt store (planned). Talks to the Medusa Store API.
  - Screens: orders, products, inventory, customers, settings (store, regions). List pages: table from `md`, simple list on phones; filters live in the URL.
  - Mobile first: base styles for phones, `sm:`/`md:`/`lg:` for larger screens. 44px touch targets and 16px field text on phones (see `app/app.config.ts`).
  - It is a layer: no `~/` imports (they point into the app using it; use relative imports), and paths in its `nuxt.config.ts` must be absolute.
  - Extensions: Nuxt layers in `apps/admin/layers/<name>/` with an `admin.extension.ts` (widgets in zones, sidebar links). Example: `layers/notes`. Guide: `packages/admin-kit/README.md`.
- `packages/*` - reusable packages, meant to be installed in other projects too. Keep them self-contained: no imports from `apps/*`.
  - `admin-kit` - Nuxt module for the admin extension system: `defineAdminExtension`, `<AdminZone>`, `useAdminExtensions()`, settings tabs. Zones and their data types live in `src/runtime/define.ts`.
  - `paystack`, `flutterwave` - plain Node client (`.`) plus a Medusa payment provider (`./medusa`). The client must not import Medusa. Webhooks verify the signature, then re-verify the transaction with the provider's API. Tests: Jest with a mocked `fetch`.
  - `medusa-analytics` - Medusa plugin (`GET /admin/analytics`) + Nuxt admin layer in `nuxt-admin/` (Home page).
  - `medusa-resend` - Medusa plugin: Resend notification provider, order email subscribers, Vue email templates (`src/templates`, render functions, table layout, inline styles), admin API (`/admin/emails/*`) + Nuxt admin layer (Settings → Emails, order widget).
  - Medusa plugins build with `node scripts/build.js` (backend only; `medusa plugin:build` would try to build React admin screens). Don't name route folders `test`/`__tests__`: Medusa skips them.
  - Plugin admin layers use the host admin's auto-imports (AppSection, useMedusa...). Import admin-kit helpers explicitly in `admin.extension.ts`: `@nuxt-medusa/admin-kit/define`.

## Rules

- Package manager is **npm** (workspaces + Turborepo). Never add another lockfile.
- Install a dependency in the app that needs it: `npm install <pkg> --workspace=<name>`.
- Backend code follows `@medusajs/eslint-plugin` (`npm run lint`). Fix code instead of disabling rules.
- Backend: business logic goes in workflows; change commerce data through `@medusajs/medusa/core-flows`.
- Import backend helpers from `@medusajs/framework/*`, not `@medusajs/utils` etc.
- Installed Medusa packages ship docs for the exact version: `node_modules/@medusajs/<pkg>/AGENTS.md`. Read them before guessing an API.
- Never commit `.env` files. Document new settings in `apps/backend/.env.template`.
- Do not hand-edit existing migrations or the lockfile.

## Commands

```bash
npm install
npm run services:up        # Postgres + Redis (docker)
npm run backend:migrate
npm run dev
npm run lint
npm run typecheck          # admin
npm run packages:test      # package tests
npm run packages:pack      # build .tgz files into dist-packages/
npm run packages:publish   # publish new package versions to npm (-- --dry-run)
```
