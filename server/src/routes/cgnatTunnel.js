/**
 * CGNAT Tunnel Routes
 * API endpoints for managing WireGuard tunnels that bypass CGNAT
 * for MikroTik routers that cannot be reached directly.
 */

const express = require("express");
const router = express.Router();
const cgnatTunnelService = require("../services/cgnatTunnelService");
const db = global.db || require("../db/memory");
const { encrypt, decrypt } = require("../utils/encryption");

/**
 * GET /api/cgnat-tunnel/status
 * Get overall tunnel service status
 */
router.get("/status", async (req, res) => {
  try {
    const initialized = await cgnatTunnelService.initialize();
    const tunnels = await cgnatTunnelService.listTunnels();

    res.json({
      success: true,
      serviceInitialized: initialized,
      serverPublicKey: cgnatTunnelService.serverPublicKey,
      serverEndpoint: cgnatTunnelService.getServerEndpoint(),
      serverPort: cgnatTunnelService.serverPort || parseInt(process.env.WG_TUNNEL_PORT || "51820", 10),
      tunnelSubnet: `${process.env.WG_TUNNEL_SUBNET || "10.200.0"}.0/24`,
      activeTunnels: tunnels.tunnels?.length || 0,
      tunnels: tunnels.tunnels || [],
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/cgnat-tunnel/tunnels
 * List all configured tunnels
 */
router.get("/tunnels", async (req, res) => {
  try {
    const result = await cgnatTunnelService.listTunnels();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/cgnat-tunnel/create
 * Create a WireGuard tunnel for a router behind CGNAT
 * Body: { connectionId, routerPublicKey? }
 */
router.post("/create", async (req, res) => {
  try {
    const { connectionId, routerPublicKey } = req.body;

    if (!connectionId) {
      return res.status(400).json({
        success: false,
        error: "connectionId is required",
      });
    }

    // Verify connection exists
    const connResult = await db.query(
      "SELECT id, name, ip_address, use_tunnel FROM mikrotik_connections WHERE id = $1",
      [connectionId]
    );

    if (connResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Connection not found",
      });
    }

    const connection = connResult.rows[0];

    // Check if already behind CGNAT
    const isCGNAT = cgnatTunnelService.isCGNATIpAddress(connection.ip_address);

    const result = await cgnatTunnelService.createTunnel(connectionId, routerPublicKey);

    res.json({
      ...result,
      isCGNAT,
      hint: isCGNAT
        ? `${connection.ip_address} appears to be a private/CGNAT address. A WireGuard tunnel is the recommended solution.`
        : `${connection.ip_address} appears to be a public IP. A tunnel may not be needed unless the router is still unreachable.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/cgnat-tunnel/:connectionId
 * Remove a WireGuard tunnel
 */
router.delete("/:connectionId", async (req, res) => {
  try {
    const { connectionId } = req.params;
    const result = await cgnatTunnelService.removeTunnel(connectionId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/cgnat-tunnel/:connectionId/status
 * Get tunnel status for a specific router
 */
router.get("/:connectionId/status", async (req, res) => {
  try {
    const { connectionId } = req.params;
    const result = await cgnatTunnelService.getTunnelStatus(connectionId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/cgnat-tunnel/:connectionId/mikrotik-script
 * Get the MikroTik configuration script for an existing tunnel
 */
router.get("/:connectionId/mikrotik-script", async (req, res) => {
  try {
    const { connectionId } = req.params;
    const script = await cgnatTunnelService.generateExistingRouterTunnelScript(connectionId);
    res.json({ success: true, script });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/cgnat-tunnel/server-setup-script
 * Get the server-side WireGuard setup script
 */
router.get("/scripts/server-setup", async (req, res) => {
  try {
    const script = cgnatTunnelService.generateServerSetupScript();
    res.type("text/plain").send(script);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/cgnat-tunnel/detect-cgnat
 * Check if an IP address appears to be behind CGNAT
 * Body: { ip_address }
 */
router.post("/detect-cgnat", async (req, res) => {
  try {
    const { ip_address } = req.body;

    if (!ip_address) {
      return res.status(400).json({
        success: false,
        error: "ip_address is required",
      });
    }

    const isCGNAT = cgnatTunnelService.isCGNATIpAddress(ip_address);
    const isTunnelIp = ip_address.startsWith(
      (process.env.WG_TUNNEL_SUBNET || "10.200.0").split(".")[0] + "." +
      (process.env.WG_TUNNEL_SUBNET || "10.200.0").split(".")[1] + "."
    );

    res.json({
      success: true,
      ip_address,
      isCGNAT,
      isTunnelIp,
      recommendation: isCGNAT
        ? "This IP is in a private/CGNAT range. Set up a WireGuard tunnel for remote access."
        : isTunnelIp
          ? "This is already a WireGuard tunnel IP. The router should be reachable through the tunnel."
          : "This appears to be a public IP. Direct connection should work if the router is online.",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/cgnat-tunnel/:connectionId/regenerate-keys
 * Regenerate WireGuard keys for a router tunnel
 */
router.post("/:connectionId/regenerate-keys", async (req, res) => {
  try {
    const { connectionId } = req.params;

    // Remove old tunnel and create new one
    await cgnatTunnelService.removeTunnel(connectionId);
    const result = await cgnatTunnelService.createTunnel(connectionId);

    res.json({
      ...result,
      message: "Keys regenerated. Apply the new mikrotikScript on your router to update the tunnel.",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
