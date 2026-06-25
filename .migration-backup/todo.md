# Audit Dummy Data + Build Unified Network Management Dashboard

## Phase 1: Audit for Dummy/Fake Data
- [x] Scan Dashboard.jsx for fake data — uses real API data ✅
- [x] Scan BillingDashboard.jsx for fake data — hardcoded trend (line 128), hardcoded "KES" ✅
- [x] Scan MonitoringDashboard.jsx for fake data — uses real MikroTik data ✅
- [x] Scan Monitoring.jsx for fake data — uses real API endpoints ✅
- [x] Scan server routes (dashboard.js, analytics.js) for mock data — real PG queries ✅
- [x] Scan server services for dummy/stub data — billingStore active_radius_sessions=0, multiFeatureStore hardcoded branches ✅
- [x] Document all findings ✅

**Findings:**
1. BillingDashboard.jsx line 128: `trend={i === 0 ? 12 : undefined}` — hardcoded 12% trend
2. billingStore.js line 410: `active_radius_sessions: 0` — always 0 instead of querying radacct
3. multiFeatureStore.js: hardcoded _branches with fake Nairobi/Mombasa/Kisumu data + DEFAULT_AGENTS seed
4. BillingDashboard.jsx: hardcoded "KES" currency in stat cards

## Phase 2: Fix Dummy Data → Real Data
- [x] Fix BillingDashboard.jsx hardcoded trend — use real revenue_trend from backend ✅
- [x] Fix billingStore.js active_radius_sessions — query radacct WHERE acctstoptime IS NULL ✅
- [x] Fix BillingDashboard.jsx hardcoded "KES" currency — use settings currency_symbol ✅
- [x] Fix multiFeatureStore.js — remove fake branch/agent/voucher seed data ✅
- [x] Add revenue_trend + currency_symbol to billing dashboard backend response ✅

## Phase 3: Build Unified Network Management Dashboard
- [x] Create backend API `/api/network/management/dashboard` aggregating router health, IP pool, PPPoE sessions, RADIUS NAS ✅
- [x] Build frontend NetworkManagementDashboard.jsx page ✅
- [x] Register route in App.jsx and add to Sidebar navigation ✅

## Phase 4: Finalize & Push
- [ ] Test and verify all changes
- [ ] Push to feature branch
- [ ] Create PR
