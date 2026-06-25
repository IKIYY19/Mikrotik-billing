# CGNAT Remote Access Guide

## Overview

If your MikroTik router is behind **Carrier-Grade NAT (CGNAT)**, the billing server cannot reach it directly. This is because your ISP performs NAT on their end — your router only receives a private IP address (like `10.x.x.x`, `100.64.x.x`, `172.16.x.x`, or `192.168.x.x`), and incoming connections from the internet never reach your device.

The MikroTik Billing System solves this with a **WireGuard reverse tunnel**. Your MikroTik router initiates an outbound WireGuard connection to the billing server (which always works through CGNAT), and the billing server communicates with the router through the tunnel IP address.

```
┌─────────────────────┐          WireGuard Tunnel         ┌──────────────────────┐
│   Billing Server    │◄──────────────────────────────────►│   MikroTik Router    │
│   (VPS/Public IP)   │          10.200.0.1 ◄──► 10.200.0.2│   (Behind CGNAT)     │
│   Port 51820/UDP    │                                   │   Outbound only      │
└─────────────────────┘                                   └──────────────────────┘
```

## How It Works

The CGNAT bypass works by reversing the connection direction:

1. **Normal (broken) approach**: Billing server → tries to connect to router → blocked by CGNAT
2. **WireGuard tunnel approach**: Router → connects outbound to billing server → works through CGNAT → billing server reaches router via tunnel IP

The key is that **outbound connections always work through CGNAT** — only inbound connections are blocked. WireGuard with `persistent-keepalive=25s` keeps the tunnel alive even when idle.

## Detecting CGNAT

Before setting up the tunnel, confirm your router is behind CGNAT:

1. Log into your MikroTik router via WinBox or SSH
2. Check the WAN IP address on the interface connected to your ISP:
   ```
   /ip address print where interface=ether1
   ```
3. From a device on your LAN, visit [whatismyipaddress.com](https://whatismyipaddress.com/)
4. Compare the two addresses. If the WAN IP is in a private range (**10.x.x.x**, **100.64.x.x**, **172.16.x.x**, or **192.168.x.x**) and does NOT match your public IP, you are behind CGNAT.

You can also use the API to detect CGNAT:
```bash
curl -X POST http://your-billing-server/api/cgnat-tunnel/detect-cgnat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ip_address": "100.64.5.10"}'
```

## Using the Dashboard (Recommended)

The fastest way to manage tunnels is the **Routers → CGNAT Tunnel** tab in the app. No `curl` required.

1. **One-time server setup.** Open the CGNAT Tunnel tab and click **Server Setup**. Copy the generated script and run it once on your billing VPS (it installs WireGuard, enables IP forwarding, opens the UDP port, and brings up the `wg-billing` interface). Make sure the environment variables in [Environment Variables](#environment-variables) are set so the server advertises the correct public endpoint.
2. **Link the router to billing.** A tunnel can only be created for a router that is already linked to a billing connection (use the **Link New Router** tab). Routers behind CGNAT can be linked using the phone-home flow, which works outbound through CGNAT.
3. **Create the tunnel.** Under **Add a Tunnel**, find the router and click **Create Tunnel**. A modal shows the RouterOS script (it contains the router's private key).
4. **Apply on the router.** Paste the script into the router's terminal (WinBox → New Terminal, or SSH from the LAN). The router dials home over WireGuard with `persistent-keepalive=25s`.
5. **Confirm health.** Click **Sync Health**. Tunnels with a recent WireGuard handshake turn green, and `is_online`/`last_seen` are updated in the database. From this point, PPPoE provisioning, suspensions, reactivations, and queue updates run transparently over the tunnel IP — no further billing configuration is needed.

The **Tunnel Server** card shows the service status, public endpoint, subnet, and active tunnel count. Use the **Script** button on any active tunnel to re-display its RouterOS configuration, and the trash button to remove a tunnel.

## Setup Instructions

> The steps below are the manual/API equivalents of the dashboard flow above, useful for automation or headless setups.

### Prerequisites

- Your billing server must have a **public IP address** (or be hosted on a VPS)
- WireGuard must be installed on the billing server
- Your MikroTik router must run **RouterOS v7** (WireGuard is built-in)
- UDP port 51820 (or your configured port) must be open on the billing server firewall

### Step 1: Set Up WireGuard on the Billing Server

SSH into your billing server and run the server setup script. You can download it from the API:

```bash
curl -o wg-billing-setup.sh http://your-billing-server/api/cgnat-tunnel/scripts/server-setup
chmod +x wg-billing-setup.sh
sudo ./wg-billing-setup.sh
```

Or manually install WireGuard:

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y wireguard

# Enable IP forwarding
echo "net.ipv4.ip_forward=1" | sudo tee /etc/sysctl.d/99-wireguard.conf
sudo sysctl -p /etc/sysctl.d/99-wireguard.conf

# Open firewall
sudo ufw allow 51820/udp
```

Add these environment variables to your billing server `.env`:

```env
# WireGuard CGNAT Tunnel Configuration
WG_INTERFACE=wg-billing
WG_TUNNEL_SUBNET=10.200.0
WG_TUNNEL_PORT=51820
WG_SERVER_ENDPOINT=YOUR_SERVER_PUBLIC_IP
WG_CONFIG_DIR=/etc/wireguard
```

### Step 2: Create a Tunnel for Your Router

Use the API or UI to create a WireGuard tunnel for your router:

```bash
curl -X POST http://your-billing-server/api/cgnat-tunnel/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"connectionId": "YOUR_ROUTER_CONNECTION_ID"}'
```

The response will include:
- **tunnelIp**: The WireGuard IP assigned to your router (e.g., `10.200.0.2`)
- **serverPublicKey**: The billing server's WireGuard public key
- **serverEndpoint**: The billing server's public IP
- **mikrotikScript**: A complete RouterOS script to apply on your MikroTik
- **routerPrivateKey**: The private key for your router (save this — apply it on the router)

### Step 3: Apply the Script on Your MikroTik

Copy the `mikrotikScript` from the API response and apply it on your MikroTik router. You can do this via:

**Option A: WinBox Terminal**
1. Open WinBox and connect to your MikroTik (from the local network)
2. Open **New Terminal**
3. Paste the entire script and press Enter

**Option B: SSH from local network**
```bash
ssh admin@192.168.88.1
# Paste the script content
```

**Option C: Use the provisioning script generator**
If your router is newly being set up, use the existing provisioning flow with VPN settings enabled.

The script will:
1. Create a WireGuard interface (`wg-billing` or similar)
2. Add the billing server as a WireGuard peer
3. Assign the tunnel IP address
4. Add firewall rules to allow WireGuard traffic
5. Set `persistent-keepalive=25s` to keep the tunnel alive through CGNAT

### Step 4: Verify the Tunnel

After applying the script on your MikroTik:

1. Check on the MikroTik:
   ```
   /interface wireguard print
   /interface wireguard peers print
   ```
   You should see the tunnel interface running and the peer with a recent handshake.

2. Check from the billing server:
   ```bash
   sudo wg show wg-billing
   ```
   You should see the router's public key and a recent `latest-handshake`.

3. Check via the API:
   ```bash
   curl http://your-billing-server/api/cgnat-tunnel/YOUR_CONNECTION_ID/status \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

### Step 5: Test the Billing Connection

Once the tunnel is up, the billing system will automatically use the tunnel IP to connect to your router. You can verify by testing the connection:

```bash
curl -X POST http://your-billing-server/api/mikrotik/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ip_address": "10.200.0.2",
    "username": "admin",
    "password": "your-password",
    "connection_type": "api"
  }'
```

## API Reference

### Service Status
```
GET /api/cgnat-tunnel/status
```
Returns overall tunnel service status, server public key, and list of tunnels.

### Create Tunnel
```
POST /api/cgnat-tunnel/create
Body: { "connectionId": "uuid", "routerPublicKey": "optional" }
```
Creates a WireGuard tunnel for the specified router. If `routerPublicKey` is not provided, a new key pair is generated. Returns the MikroTik configuration script.

### List Tunnels
```
GET /api/cgnat-tunnel/tunnels
```
Lists all configured WireGuard tunnels.

### Tunnel Status
```
GET /api/cgnat-tunnel/:connectionId/status
```
Returns detailed status for a specific router's tunnel, including handshake status.

### Get MikroTik Script
```
GET /api/cgnat-tunnel/:connectionId/mikrotik-script
```
Returns the RouterOS configuration script for an existing tunnel.

### Remove Tunnel
```
DELETE /api/cgnat-tunnel/:connectionId
```
Removes the WireGuard tunnel configuration for a router.

### Regenerate Keys
```
POST /api/cgnat-tunnel/:connectionId/regenerate-keys
```
Generates new WireGuard keys. You must re-apply the new script on the MikroTik.

### Detect CGNAT
```
POST /api/cgnat-tunnel/detect-cgnat
Body: { "ip_address": "100.64.5.10" }
```
Checks if an IP address appears to be behind CGNAT.

### Server Setup Script
```
GET /api/cgnat-tunnel/scripts/server-setup
```
Returns a bash script to set up WireGuard on the billing server.

### Sync Tunnel Health
```
POST /api/cgnat-tunnel/health/sync
Body: { "staleSeconds": 180 }   // optional, default 180
```
Reads WireGuard handshakes once and refreshes `is_online`/`last_seen` for every tunnel-enabled router. A router is marked online if it handshook within `staleSeconds`. Returns `{ wgAvailable, checked, onlineCount, results[] }`. This is the cheapest health signal for CGNAT routers because it requires no probe back through the tunnel. `GET /api/cgnat-tunnel/status` and `/tunnels` also include a live `tunnelActive` flag and `lastHandshake` per tunnel.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WG_INTERFACE` | `wg-billing` | WireGuard interface name |
| `WG_TUNNEL_SUBNET` | `10.200.0` | Tunnel IP subnet (3 octets) |
| `WG_TUNNEL_PORT` | `51820` | WireGuard UDP listening port |
| `WG_SERVER_ENDPOINT` | auto-detected | Server public IP or hostname |
| `WG_CONFIG_DIR` | `/etc/wireguard` | WireGuard config directory |
| `WG_PERSISTENT_KEEPALIVE` | `25` | Keep-alive interval in seconds |

## Multiple Routers Behind CGNAT

Each router gets its own unique tunnel IP in the `10.200.0.0/24` subnet:

| Router | Tunnel IP | WireGuard Peer |
|--------|-----------|----------------|
| Router 1 | 10.200.0.2 | Unique key pair |
| Router 2 | 10.200.0.3 | Unique key pair |
| Router 3 | 10.200.0.4 | Unique key pair |
| ... | ... | ... |
| Server | 10.200.0.1 | Server key pair |

Each router has its own WireGuard key pair. The server config contains a `[Peer]` section for each router. When you create a new tunnel, the server config is automatically updated.

## Alternative Solutions

### MikroTik Back To Home (BTH)
RouterOS v7 includes a built-in feature called "Back To Home" that provides similar functionality without needing your own VPS. It connects to the MikroTik cloud and gives you a secure path back. However, it's limited to router management (WinBox, SSH, WebFig) and doesn't support the full API integration needed for billing.

To enable BTH:
```
/ip cloud set ddns-enabled=yes
/tool mac-server set allowed-interface-list=LAN
/interface bridge add name=bridge1
```

### Reverse SSH Tunnel
If you only need SSH access and your billing server supports it, you can set up a reverse SSH tunnel from the MikroTik:
```
/system ssh-exec host=YOUR_SERVER user=tunnel port=22 source-ip=192.168.88.1 command="echo 'tunnel established'"
```
This is less reliable than WireGuard and doesn't support the MikroTik API.

### ZeroTier
ZeroTier is a mesh VPN that works similarly to WireGuard but doesn't require a public VPS endpoint. MikroTik doesn't have native ZeroTier support, but you can run it on a device behind the router.

## Troubleshooting

### Tunnel not connecting

1. **Check MikroTik WireGuard status**:
   ```
   /interface wireguard print
   /interface wireguard peers print
   ```
   The peer should show a recent `latest-handshake`.

2. **Check server WireGuard status**:
   ```bash
   sudo wg show wg-billing
   ```

3. **Verify firewall allows UDP port 51820** on the billing server:
   ```bash
   sudo ufw status | grep 51820
   ```

4. **Verify the server endpoint** is correct in the MikroTik peer config:
   ```
   /interface wireguard peers print
   ```
   Check `endpoint-address` and `endpoint-port` match your server.

5. **Check `persistent-keepalive`** is set to 25s — this is critical for CGNAT:
   ```
   /interface wireguard peers get [find interface=wg-billing] persistent-keepalive
   ```

### Router shows as offline

1. The router's `ip_address` in the billing system should be set to the **tunnel IP** (e.g., `10.200.0.2`), not the original CGNAT address.
2. When you create a tunnel, the system automatically updates the IP if needed.
3. Verify the API service is enabled on the MikroTik:
   ```
   /ip service print where name=api
   ```
4. Verify firewall on the MikroTik allows API port (8728) from the tunnel interface:
   ```
   /ip firewall filter add chain=input protocol=tcp dst-port=8728 in-interface=wg-billing action=accept comment="Allow API via tunnel"
   ```

### Key rotation

If you need to regenerate keys:
```bash
curl -X POST http://your-billing-server/api/cgnat-tunnel/YOUR_CONNECTION_ID/regenerate-keys \
  -H "Authorization: Bearer YOUR_TOKEN"
```
Then apply the new script on your MikroTik router.

## Security Best Practices

1. **Never expose management ports directly to the internet** — always use the WireGuard tunnel
2. **Each router should have unique WireGuard keys** — never reuse keys across devices
3. **Restrict `AllowedIPs`** on the server to only the router's tunnel IP (`/32`)
4. **Use strong router passwords** and dedicated API users (not admin)
5. **Monitor tunnel handshakes** — if no handshake for >5 minutes, the tunnel is likely broken
6. **Rotate keys periodically** as part of standard security practice
7. **Firewall the WireGuard port** on the server to only accept from expected IP ranges when possible
8. **Disable unnecessary services** on the MikroTik (telnet, ftp, www)

## Architecture Details

The CGNAT bypass solution integrates with the existing MikroTik Billing System in these key areas:

### Database Schema
The `mikrotik_connections` table includes these tunnel fields:
- `use_tunnel` (boolean) — Whether to use tunnel for this connection
- `wireguard_tunnel_ip` (varchar) — The WireGuard tunnel IP assigned to the router
- `wireguard_public_key` (text) — The router's WireGuard public key
- `wireguard_private_key` (text) — The router's WireGuard private key (for script generation)
- `wireguard_interface_name` (varchar) — The WireGuard interface name on the router

### Router Connection Manager
The `RouterConnectionManager` automatically detects when a router has a tunnel configured and uses the tunnel IP instead of the original IP address. This means all existing functionality (API commands, SSH, health checks, billing sync) works transparently through the tunnel.

### Connection Testing
The `/api/mikrotik/test` endpoint now detects CGNAT IP addresses and suggests setting up a WireGuard tunnel. The diagnostic output includes specific instructions for CGNAT scenarios.
