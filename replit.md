# MikroTik Billing

MikroTik ISP Billing & Management Platform — a full-featured web app for managing ISP customers, subscriptions, routers, billing, payments, and network services.

## Run & Operate

- Frontend: `artifacts/mikrotik-billing` — Vite + React SPA
- Backend API (not yet migrated): original Express server in `.migration-backup/server/`
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite, React Router v6, Tailwind CSS v3, Zustand, i18next (multi-language), react-leaflet (maps)
- API: Express (original backend preserved in .migration-backup/server/)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/mikrotik-billing/src/` — React frontend source
  - `pages/` — all route pages (billing/, network/, etc.)
  - `components/` — shared UI components + Sidebar
  - `contexts/` — React contexts (BrandingContext, ThemeContext)
  - `lib/` — auth, axios setup, API helpers
  - `i18n/` — internationalization (en, fr, es, sw, ar)
- `.migration-backup/server/` — original Express backend (to be wired into artifacts/api-server)
- `lib/api-spec/openapi.yaml` — API contract source of truth

## Architecture decisions

- Frontend is a Vite + React SPA with client-side routing via React Router DOM v6
- Tailwind CSS v3 (PostCSS-based, not the v4 Vite plugin) — uses tailwind.config.js
- Auth is JWT-based, stored in localStorage, attached via Axios interceptors
- Multi-tenant architecture: domain resolution middleware selects tenant context
- Sentry DSN is optional — app degrades gracefully when not configured

## Product

- Login/auth with Google OAuth + email/password
- Dashboard for ISP routers, customers, subscriptions, billing
- Network management: PPPoE, Hotspot, RADIUS, OLT, IPAM
- Billing: invoices, payments (M-Pesa, Airtel, MTN, Paystack), credit notes, wallets
- Customer portal, reseller portal, agent portal
- Analytics, reports, audit logs, ticketing, SMS/WhatsApp messaging
- Captive portal builder, topology builder, bandwidth graphs, maps

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The backend API is NOT yet wired into artifacts/api-server — the frontend makes calls to `/api` which currently returns 502. The original server lives in `.migration-backup/server/`.
- Tailwind v3 must use postcss plugins in vite.config.ts (NOT @tailwindcss/vite plugin which is v4 only)
- vite-plugin-pwa was dropped per migration plan (PWA can be re-added later)
- Sentry requires VITE_SENTRY_DSN env var — safe to omit for now

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
