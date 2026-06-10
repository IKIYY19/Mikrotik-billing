# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Repository shape
- Monorepo with two Node projects:
  - `server/`: Express API + DB/migrations + cron/services.
  - `client/`: React + Vite SPA.
- Root `package.json` orchestrates both apps (dev, lint, test, build).

## Core development commands
- Install deps:
  - `npm ci`
  - `npm ci --prefix server`
  - `npm ci --prefix client`
- Run full local dev stack (server + client concurrently):
  - `npm run dev`
- Run each side independently:
  - `npm run dev:server`
  - `npm run dev:client`
  - or: `npm run dev --prefix server` / `npm run dev --prefix client`
- Lint:
  - `npm run lint` (runs server + client lint)
  - `npm run lint --prefix server`
  - `npm run lint --prefix client`
- Tests:
  - `npm run test` (server Jest suite with coverage)
  - Single backend test file: `npm --prefix server test -- auth.test.js`
  - Watch mode: `npm run test:watch --prefix server`
- Build:
  - `npm run build:client` (Vite production build)
  - `npm run build` (server production install + client install/build)
  - `npm run check` (test + client build)
- DB tasks:
  - `npm run db:migrate`
  - `npm run db:seed`

## Architecture (high-level)
### Backend composition root
- `server/src/index.js` is the wiring hub:
  - Loads env + security checks, initializes Sentry, and sets security middleware (CORS, Helmet, rate limiting).
  - Initializes DB, runs migrations, and exposes `global.db`, `global.dbAvailable`, `global.billingRepo` for route/service access.
  - Registers all API route modules under `/api/*`, sets up static serving for `client/dist`, and starts cron/services (metrics, reminders, WebSocket, router connectivity, TR-069).

### Data access model and DB fallback
- `server/src/db/index.js` builds a PostgreSQL pool from `DATABASE_URL` or discrete `DB_*`/`PG*` env vars.
- In non-production, startup falls back to `server/src/db/memory.js` if PostgreSQL is unavailable.
- Billing data access is switched at startup between:
  - `server/src/db/billingRepository.js` (PostgreSQL)
  - `server/src/db/billingStore.js` (in-memory)
- Migrations are centrally triggered from server startup (`runMigrations()` plus feature-specific migrations).

### Auth, permissions, and tenant resolution flow
- Request context is layered in this order (important when debugging auth/tenant issues):
  1. `domainResolver` middleware (maps custom domains).
  2. Route-level authentication/authorization (`authenticate`, `requirePermission`, `requireRole`).
  3. `tenantContext` middleware for `/api` routes.
- Many routes enforce method-sensitive permissions (example: read on `GET`, write on mutating methods), so 403s often depend on HTTP verb as well as route.

### Frontend runtime structure
- `client/src/main.jsx` bootstraps global concerns (Axios setup, i18n, Sentry, theme, router, error boundary).
- `client/src/App.jsx` is a large route hub:
  - Public auth/portal routes.
  - Protected app shell with sidebar + nested feature routes.
  - Most pages are lazy-loaded; route additions usually require editing this file plus sidebar/navigation sources.

### API client split in frontend
- `client/src/lib/api.js`: shared Axios instance with auth interceptor (`Authorization: Bearer ...`) and 401 redirect behavior.
- `client/src/lib/api-helpers.js`: convenience wrapper returning `{ success, data/error }` objects for some feature flows.
- `client/src/store.js` (Zustand) drives legacy project/module/script-generation workflows and uses `lib/api`.

## CI and validation baseline
- CI workflow is `.github/workflows/ci.yml`.
- CI currently executes:
  - `npm ci` (root + server + client),
  - `npm run test`,
  - `npm run build:client`.
- Reproducing those locally is the fastest pre-PR sanity check.
