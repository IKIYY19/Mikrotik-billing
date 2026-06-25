---
name: Network alias router path rewriting
description: The /api/network/* alias router in index.js prepends /network to all non-pppoe/hotspot paths before dispatching to network.js
---

## The Rule

Any route in `artifacts/api-server/src/routes/network.js` accessed via `/api/network/` must have a `/network/` prefix in its path declaration — **unless** it starts with `/pppoe/` or `/hotspot/` (those are passed through as-is).

**Why:** `index.js` mounts a `networkAliasRouter` at `/api/network` that rewrites the suffix:
```js
const networkAliasRouter = createPrefixedAliasRouter((suffix) => {
  if (suffix.startsWith("/pppoe/") || suffix.startsWith("/hotspot/")) {
    return suffix;  // pass through
  }
  return `/network${suffix}`;  // prepend /network
}, networkRoutes);
```

So `GET /api/network/summary` → strips to `/summary` → rewrites to `/network/summary` → must match `router.get('/network/summary', ...)`.

**How to apply:**
- When adding a new route to `network.js` that should be accessible at `/api/network/XXX`, define it as `router.get('/network/XXX', ...)` — NOT as `router.get('/XXX', ...)`.
- Exception: pppoe/hotspot routes stay as `/pppoe/XXX` and `/hotspot/XXX`.
- When you see a 404 on `/api/network/something`, check if the route in `network.js` is missing the `/network/` prefix.
