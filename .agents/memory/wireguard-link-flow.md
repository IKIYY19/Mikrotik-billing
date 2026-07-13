---
name: WireGuard combined link script
description: The new-router-script endpoint and how the one-paste MikroTik linking flow works end-to-end, including bugs fixed to make it functional.
---

## The pattern
`POST /api/cgnat-tunnel/new-router-script` creates a placeholder `mikrotik_connections` row (ip=0.0.0.0, use_tunnel=true), calls `createTunnel(connectionId)` to allocate a tunnel IP + key pair, then calls `generateCombinedLinkScript()` to return a complete RouterOS script.

**Why:** Routers behind CGNAT have no reachable IP before the tunnel is up, so pre-allocating the tunnel and embedding everything in one script allows the router to fully self-register in a single terminal paste.

**How to apply:** User fills in router name + API password in WireGuard mode → calls this endpoint → pastes the script on MikroTik. The script does 4 phases: WireGuard setup → enable API + create billing user → wait for tunnel → enroll (downloads install.rsc which triggers auto-link via ztpMgmtUser/ztpMgmtPass globals).

**RouterOS note:** RouterOS v7+ required for WireGuard support. Commands must be single-line (no backslash continuation). The `billing` API user is created with `group=full`.

## Bugs fixed to make the flow actually work

| Bug | Symptom | Fix |
|-----|---------|-----|
| `createTunnel()` return missing fields | `undefined` for interfaceName and routerTunnelIp in script | Added `routerTunnelIp` (with /24 CIDR) and `interfaceName` to return object |
| `new-router-script` used wrong field names | `tunnel.routerTunnelIp`, `tunnel.interfaceName`, `tunnel.serverWgPort` all undefined | Use correct names: `tunnel.routerTunnelIp`, `tunnel.interfaceName`, `tunnel.serverPort` |
| INSERT missing `password_encrypted` | NOT NULL constraint violation on row creation | Encrypt `apiPassword` via `encrypt()` and include in INSERT |
| `system_keys` table queried before created | `initialize()` threw → keys stayed null → `public-key="null"` in script | `CREATE TABLE IF NOT EXISTS system_keys` at top of `initialize()` before the SELECT |
| `generateServerSetupScript()` generated conflicting keys | Running the script would overwrite the DB-stored keys | Made async; uses `this.serverPrivateKey` (actual DB key) so router scripts and server config match |
| Module-level `const db = global.db \|\| require(...)` in route | Captured before global.db was set, used in-memory DB | Replaced with a proxy `{ query: (...args) => getDb().query(...args) }` that resolves at call time |

## Key invariant
Server WireGuard keys are generated once in `initialize()`, stored in `system_keys` table, and reused across restarts. Router scripts always embed `cgnatTunnelService.serverPublicKey`. The server setup bash script (from "Server Setup" button) uses the same private key — so server config and router scripts are always in sync.
