---
name: WireGuard combined link script
description: The new-router-script endpoint and how the one-paste MikroTik linking flow works end-to-end
---

## The pattern
`POST /api/cgnat-tunnel/new-router-script` creates a placeholder `mikrotik_connections` row (ip=0.0.0.0, use_tunnel=true), calls `createTunnel(connectionId)` to allocate a tunnel IP + key pair, then calls `generateCombinedLinkScript()` to return a complete RouterOS script.

**Why:** Routers behind CGNAT have no reachable IP before the tunnel is up, so pre-allocating the tunnel and embedding everything in one script allows the router to fully self-register in a single terminal paste.

**How to apply:** When the user selects WireGuard mode in the Link New Router tab, they fill in router name + API password, the frontend calls this endpoint, and displays the generated script. The script does 4 phases: WireGuard setup → enable API + create billing user → wait for tunnel → enroll (downloads install.rsc which triggers auto-link via ztpMgmtUser/ztpMgmtPass globals).

**RouterOS note:** RouterOS v7+ required for WireGuard support. Commands must be single-line (no backslash continuation). The `billing` API user is created with `group=full`.

**Tunnel IP:** After the placeholder row is created, the enrollment call-home comes through the WireGuard tunnel so the billing server sees the tunnel IP as source — this is how the router's stored IP gets set to the tunnel IP automatically.
