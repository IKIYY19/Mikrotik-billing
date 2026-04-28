const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const provisionStore = require("../db/provisionStore");
const memoryDb = require("../db/memory");
const zeroTouchBilling = require("../services/zeroTouchBilling");

function getDb() {
  return global.db || memoryDb;
}

function toSafeDevice(device) {
  if (!device) return null;
  const { mgmt_password_encrypted, radius_secret, ...safe } = device;
  return safe;
}

function normalizeStringList(value, fallback = []) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return fallback;
}

async function runMikroTikPrint(session, path, properties = null) {
  const channel = session.openChannel();
  const args = properties ? { ".proplist": properties } : {};
  channel.write(`${path}/print`, args);
  const result = await channel.done;
  return Array.isArray(result) ? result : [];
}

async function scanMikroTikRouter({
  ip_address,
  api_port,
  mgmt_port,
  username,
  password,
}) {
  if (!ip_address) {
    throw new Error("Router IP / host is required for scan");
  }

  if (!username || !password) {
    throw new Error("Router username and password are required for scan");
  }

  const MikroNode = require("mikronode");
  const port = Number(api_port || mgmt_port || 8728);
  const mikrotik = new MikroNode(ip_address, { port });
  const conn = await mikrotik.connect(username, password);
  const close = conn.closeOnDone(true);

  try {
    const resources = await runMikroTikPrint(conn, "/system/resource");
    const identities = await runMikroTikPrint(conn, "/system/identity");
    const interfaces = await runMikroTikPrint(
      conn,
      "/interface",
      ".id,name,type,mac-address,disabled,running,default-name,comment",
    );
    const addresses = await runMikroTikPrint(
      conn,
      "/ip/address",
      ".id,address,interface,disabled,comment",
    );

    const normalizedInterfaces = interfaces.map((iface) => ({
      id: iface[".id"] || iface.id || iface.name,
      name: iface.name,
      default_name: iface["default-name"] || "",
      type: iface.type || "",
      mac_address: iface["mac-address"] || "",
      disabled: iface.disabled === "true",
      running: iface.running === "true",
      comment: iface.comment || "",
      addresses: addresses
        .filter((address) => address.interface === iface.name)
        .map((address) => address.address),
    }));

    const usablePorts = normalizedInterfaces
      .filter(
        (iface) =>
          !iface.disabled &&
          ["ether", "vlan", "wlan", "bridge"].some((type) =>
            iface.type.includes(type),
          ),
      )
      .map((iface) => iface.name);

    const suggestedWan =
      usablePorts.find((name) => name === "ether1") ||
      usablePorts[0] ||
      "ether1";
    const suggestedLanPorts = usablePorts.filter(
      (name) => name !== suggestedWan,
    );

    return {
      success: true,
      host: ip_address,
      port,
      identity: identities[0]?.name || "",
      model: resources[0]?.["board-name"] || resources[0]?.platform || "",
      version: resources[0]?.version || "",
      uptime: resources[0]?.uptime || "",
      cpu: resources[0]?.cpu || "",
      interfaces: normalizedInterfaces,
      ip_addresses: addresses,
      suggested: {
        wan_interface: suggestedWan,
        lan_interface: "bridge1",
        lan_ports: suggestedLanPorts,
      },
    };
  } finally {
    close();
  }
}

// GET all devices
router.get("/", async (req, res) => {
  try {
    const { project_id } = req.query;
    let result;
    if (project_id) {
      result = await getDb().query(
        "SELECT * FROM routers WHERE project_id = $1 ORDER BY created_at DESC",
        [project_id],
      );
    } else {
      result = await getDb().query(
        "SELECT * FROM routers ORDER BY created_at DESC",
        [],
      );
    }
    res.json(result.rows.map(toSafeDevice));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST scan MikroTik router before creating/updating zero-touch device
router.post("/scan", async (req, res) => {
  try {
    const scan = await scanMikroTikRouter(req.body || {});
    res.json(scan);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      message:
        "Scan failed. Ensure the API service is enabled, credentials are correct, and this server can reach the router.",
    });
  }
});

// GET single device
router.get("/:id", async (req, res) => {
  try {
    const result = await getDb().query("SELECT * FROM routers WHERE id = $1", [
      req.params.id,
    ]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Device not found" });
    res.json(toSafeDevice(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET device provision logs
router.get("/:id/logs", async (req, res) => {
  try {
    const result = await getDb().query(
      "SELECT * FROM provision_logs WHERE router_id = $1 ORDER BY created_at DESC LIMIT 50",
      [req.params.id],
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET provision script preview
router.get("/:id/script", async (req, res) => {
  try {
    const result = await getDb().query("SELECT * FROM routers WHERE id = $1", [
      req.params.id,
    ]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Device not found" });
    const baseUrl =
      process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get("host")}`;
    const script = provisionStore.generateProvisionScript(result.rows[0], {
      callbackBaseUrl: baseUrl,
    });
    res.json({ script });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE device
router.post("/", async (req, res) => {
  try {
    const {
      project_id,
      name,
      identity,
      model,
      mac_address,
      ip_address,
      wan_interface,
      lan_interface,
      lan_ports,
      dns_servers,
      ntp_servers,
      radius_server,
      radius_secret,
      radius_port,
      hotspot_enabled,
      pppoe_enabled,
      pppoe_interface,
      pppoe_service_name,
      mgmt_port,
      mgmt_username,
      mgmt_password,
      connection_type,
      notes,
    } = req.body;

    const id = uuidv4();
    const token = provisionStore.generateToken();
    const encryptedMgmtPassword = mgmt_password
      ? zeroTouchBilling.encryptForMikrotik(mgmt_password)
      : null;

    const result = await getDb().query(
      `INSERT INTO routers (id, project_id, name, identity, model, mac_address, ip_address,
       wan_interface, lan_interface, lan_ports, provision_token, provision_status,
       dns_servers, ntp_servers, radius_server, radius_secret, radius_port,
       hotspot_enabled, pppoe_enabled, pppoe_interface, pppoe_service_name,
       mgmt_port, mgmt_username, mgmt_password_encrypted, connection_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
       RETURNING *`,
      [
        id,
        project_id,
        name,
        identity || name,
        model || "",
        mac_address || "",
        ip_address || "",
        wan_interface || "ether1",
        lan_interface || "bridge1",
        normalizeStringList(lan_ports, [
          "ether2",
          "ether3",
          "ether4",
          "ether5",
        ]),
        token,
        "pending",
        dns_servers || ["8.8.8.8", "8.8.4.4"],
        ntp_servers || ["pool.ntp.org"],
        radius_server || "",
        radius_secret || "",
        radius_port || 1812,
        hotspot_enabled || false,
        pppoe_enabled || false,
        pppoe_interface || "",
        pppoe_service_name || "",
        mgmt_port || 8728,
        mgmt_username || "",
        encryptedMgmtPassword,
        connection_type || "api",
        notes || "",
      ],
    );

    res.status(201).json(toSafeDevice(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE device
router.put("/:id", async (req, res) => {
  try {
    const {
      name,
      identity,
      model,
      mac_address,
      ip_address,
      wan_interface,
      lan_interface,
      lan_ports,
      dns_servers,
      ntp_servers,
      radius_server,
      radius_secret,
      radius_port,
      hotspot_enabled,
      pppoe_enabled,
      pppoe_interface,
      pppoe_service_name,
      mgmt_port,
      mgmt_username,
      mgmt_password,
      connection_type,
      notes,
    } = req.body;

    const existing = await getDb().query(
      "SELECT * FROM routers WHERE id = $1",
      [req.params.id],
    );
    if (existing.rows.length === 0)
      return res.status(404).json({ error: "Device not found" });

    const r = existing.rows[0];
    const encryptedMgmtPassword = mgmt_password
      ? zeroTouchBilling.encryptForMikrotik(mgmt_password)
      : r.mgmt_password_encrypted;
    const result = await getDb().query(
      `UPDATE routers SET
        name = COALESCE($1, name), identity = COALESCE($2, identity),
        model = COALESCE($3, model), mac_address = COALESCE($4, mac_address),
        ip_address = COALESCE($5, ip_address), wan_interface = COALESCE($6, wan_interface),
        lan_interface = COALESCE($7, lan_interface), lan_ports = COALESCE($8, lan_ports),
        dns_servers = COALESCE($9, dns_servers), ntp_servers = COALESCE($10, ntp_servers),
        radius_server = COALESCE($11, radius_server),
        radius_secret = COALESCE($12, radius_secret), radius_port = COALESCE($13, radius_port),
        hotspot_enabled = COALESCE($14, hotspot_enabled), pppoe_enabled = COALESCE($15, pppoe_enabled),
        pppoe_interface = COALESCE($16, pppoe_interface), pppoe_service_name = COALESCE($17, pppoe_service_name),
        mgmt_port = COALESCE($18, mgmt_port), mgmt_username = COALESCE($19, mgmt_username),
        mgmt_password_encrypted = COALESCE($20, mgmt_password_encrypted), connection_type = COALESCE($21, connection_type),
        notes = COALESCE($22, notes),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $23 RETURNING *`,
      [
        name || r.name,
        identity || r.identity,
        model || r.model,
        mac_address || r.mac_address,
        ip_address || r.ip_address,
        wan_interface || r.wan_interface,
        lan_interface || r.lan_interface,
        lan_ports !== undefined
          ? normalizeStringList(lan_ports, r.lan_ports || [])
          : r.lan_ports,
        dns_servers || r.dns_servers,
        ntp_servers || r.ntp_servers,
        radius_server !== undefined ? radius_server : r.radius_server,
        radius_secret !== undefined ? radius_secret : r.radius_secret,
        radius_port || r.radius_port,
        hotspot_enabled !== undefined ? hotspot_enabled : r.hotspot_enabled,
        pppoe_enabled !== undefined ? pppoe_enabled : r.pppoe_enabled,
        pppoe_interface || r.pppoe_interface,
        pppoe_service_name || r.pppoe_service_name,
        mgmt_port || r.mgmt_port,
        mgmt_username !== undefined ? mgmt_username : r.mgmt_username,
        encryptedMgmtPassword,
        connection_type || r.connection_type || "api",
        notes !== undefined ? notes : r.notes,
        req.params.id,
      ],
    );

    res.json(toSafeDevice(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// REGENERATE token
router.post("/:id/regenerate-token", async (req, res) => {
  try {
    const token = provisionStore.generateToken();
    const result = await getDb().query(
      `UPDATE routers
       SET provision_token = $1,
           provision_status = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, provision_token, provision_status`,
      [token, "pending", req.params.id],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Device not found" });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ACTIVATE router as billing-linked MikroTik connection
router.post("/:id/activate-billing", async (req, res) => {
  try {
    const activation = await zeroTouchBilling.activateRouterInBilling(
      req.params.id,
      req.body || {},
    );
    if (!activation.success) {
      return res.status(400).json(activation);
    }
    res.json({
      ...activation,
      router: toSafeDevice(activation.router),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE device
router.delete("/:id", async (req, res) => {
  try {
    const result = await getDb().query(
      "DELETE FROM routers WHERE id = $1 RETURNING id",
      [req.params.id],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Device not found" });
    res.json({ message: "Device deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
