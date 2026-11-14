# AGENTS.md

## Project

Medusa 2 backend with Vue/Nuxt front ends instead of the official React admin and Next.js store.

- `apps/backend` - Medusa server. React admin is disabled; do not add `src/admin` or React packages.
- `apps/admin` - Nuxt 4 admin (SPA, `ssr: false`) with Nuxt UI. Calls the Admin API through `useMedusa()` (`@medusajs/js-sdk`, session auth). Pages need login unless `definePageMeta({ public: true })`.
  - Design: editorial (Instrument Serif headings, Inter body, warm neutrals, hairline rules). Reuse `app/components/app/*` (AppPageHeader, AppSection, AppField, AppStatus, AppEmpty, AppFormModal, AppConfirmModal) and `useConfirm()` / `useNotify()`. Edits open in modals via `useOverlay()`.
- `apps/storefront` - Nuxt store (planned). Talks to the Medusa Store API.
  - Mobile first: base styles for phones, `sm:`/`md:`/`lg:` for larger screens. 44px touch targets and 16px field text on phones (see `app/app.config.ts`).
  - Extensions: Nuxt layers in `apps/admin/layers/<name>/` with an `admin.extension.ts` (widgets in zones, sidebar links). Example: `layers/notes`. Guide: `packages/admin-kit/README.md`.
- `packages/admin-kit` - Nuxt module for the admin extension system: `defineAdminExtension`, `<AdminZone>`, `useAdminExtensions()`. Zones and their data types live in `src/runtime/define.ts`.

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
cd apps/backend && npm run test:unit
```
