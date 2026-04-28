const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const provisionStore = require("../db/provisionStore");
const memoryDb = require("../db/memory");
const zeroTouchBilling = require("../services/zeroTouchBilling");
const enrollmentMemoryStore = require("../services/enrollmentMemoryStore");

function getDb() {
  return global.db || memoryDb;
}

function getServerBaseUrl(req, explicitBaseUrl) {
  return (
    explicitBaseUrl ||
    process.env.PUBLIC_APP_URL ||
    `${req.protocol}://${req.get("host")}`
  );
}

function buildProvisionCommand(serverUrl, token, method = "script", delay = 0) {
  const cleanBaseUrl = serverUrl.replace(/\/$/, "");
  const scriptUrl = `${cleanBaseUrl}/mikrotik/provision/${token}`;
  const fetchScript = provisionStore.buildFetchCommand(
    scriptUrl,
    "provision.rsc",
    true,
  );
  const delaySec = parseInt(delay, 10) || 0;
  const delayCommand = delaySec > 0 ? `; :delay ${delaySec}s` : "";

  switch (method) {
    case "fetch":
      return fetchScript;
    case "inline":
      return `${fetchScript}${delayCommand}; /import file-name=provision.rsc; /file remove provision.rsc`;
    case "script":
    case "import":
    default:
      return `${fetchScript}${delayCommand}; /import file-name=provision.rsc`;
  }
}

// GET /mikrotik/provision/:token - Router downloads its config
router.get("/provision/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const ip = req.ip || req.connection.remoteAddress;
    const ua = req.get("User-Agent") || "unknown";

    // Find router by token
    const result = await getDb().query(
      "SELECT * FROM routers WHERE provision_token = $1",
      [token],
    );

    if (result.rows.length === 0) {
      await getDb().query(
        "INSERT INTO provision_logs (id, token, router_id, ip_address, user_agent, action, status, details) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [
          uuidv4(),
          token,
          null,
          ip,
          ua,
          "script_fetch",
          "failed",
          "Invalid token",
        ],
      );
      return res
        .status(404)
        .type("text/plain")
        .send("# ERROR: Invalid provisioning token");
    }

    const routerData = result.rows[0];

    // Log the fetch
    await getDb().query(
      "INSERT INTO provision_logs (id, token, router_id, ip_address, user_agent, action, status, details) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [
        uuidv4(),
        token,
        routerData.id,
        ip,
        ua,
        "script_fetch",
        "success",
        `Router: ${routerData.name}`,
      ],
    );

    // Generate the provisioning script
    const script = provisionStore.generateProvisionScript(routerData, {
      callbackBaseUrl: getServerBaseUrl(req),
    });

    // Log the event
    await getDb().query(
      "INSERT INTO provision_events (id, router_id, event_type, script_content) VALUES ($1, $2, $3, $4)",
      [uuidv4(), routerData.id, "script_generated", script],
    );

    res.type("text/plain").send(script);
  } catch (error) {
    console.error("Provision error:", error);
    res.status(500).type("text/plain").send("# ERROR: Internal server error");
  }
});

// GET /mikrotik/provision/callback/:token - Router confirms provision
router.get("/provision/callback/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const ip = req.ip || req.connection.remoteAddress;
    const ua = req.get("User-Agent") || "unknown";

    // Find router
    const result = await getDb().query(
      "SELECT * FROM routers WHERE provision_token = $1",
      [token],
    );

    if (result.rows.length === 0) {
      return res.type("text/plain").send("# ERROR: Invalid token");
    }

    const routerData = result.rows[0];

    // Mark as provisioned
    await getDb().query(
      `UPDATE routers
       SET provision_status = $1,
           last_provisioned_at = CURRENT_TIMESTAMP,
           provision_attempts = COALESCE(provision_attempts, 0) + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      ["provisioned", routerData.id],
    );

    // Log callback
    await getDb().query(
      "INSERT INTO provision_logs (id, token, router_id, ip_address, user_agent, action, status, details) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [
        uuidv4(),
        token,
        routerData.id,
        ip,
        ua,
        "callback",
        "success",
        "Router confirmed provisioning",
      ],
    );

    const activation = await zeroTouchBilling.activateRouterInBilling(
      routerData.id,
    );
    const activationStatus = activation.success
      ? `Billing link activated${activation.subscriptions_synced ? ` (${activation.subscriptions_synced} subscriptions processed)` : ""}`
      : `Billing link skipped: ${activation.error || "missing credentials"}`;

    await getDb().query(
      "INSERT INTO provision_logs (id, token, router_id, ip_address, user_agent, action, status, details) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [
        uuidv4(),
        token,
        routerData.id,
        ip,
        ua,
        "billing_activation",
        activation.success ? "success" : "skipped",
        activationStatus,
      ],
    );

    res
      .type("text/plain")
      .send(`# OK: Router marked as provisioned\n# ${activationStatus}`);
  } catch (error) {
    console.error("Callback error:", error);
    res.status(500).type("text/plain").send("# ERROR: Internal server error");
  }
});

// GET /mikrotik/provision/command/:routerId - Generate one-line provision command
router.get("/provision/command/:routerId", async (req, res) => {
  try {
    const { routerId } = req.params;
    const { method = "import", baseUrl, delay = 0 } = req.query;

    // Find router
    const result = await getDb().query("SELECT * FROM routers WHERE id = $1", [
      routerId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Router not found" });
    }

    const router = result.rows[0];
    const serverUrl = getServerBaseUrl(req, baseUrl);
    const token = router.provision_token;
    const command = buildProvisionCommand(serverUrl, token, method, delay);

    res.json({
      success: true,
      routerId,
      token,
      method,
      command,
      serverUrl,
      copyText: command.replace(/\\\n/g, " "),
    });
  } catch (error) {
    console.error("Command generation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /mikrotik/provision/command/:routerId - Regenerate token and get new command
router.post("/provision/command/:routerId", async (req, res) => {
  try {
    const { routerId } = req.params;
    const { method = "import", baseUrl, delay = 0 } = req.body;

    // Find router
    const result = await getDb().query("SELECT * FROM routers WHERE id = $1", [
      routerId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Router not found" });
    }

    const newToken = provisionStore.generateToken();
    const updateResult = await getDb().query(
      `UPDATE routers
       SET provision_token = $1,
           provision_status = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, provision_token`,
      [newToken, "pending", routerId],
    );
    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: "Router not found" });
    }

    const serverUrl = getServerBaseUrl(req, baseUrl);
    const token = updateResult.rows[0].provision_token;
    const command = buildProvisionCommand(serverUrl, token, method, delay);

    res.json({
      success: true,
      routerId,
      token,
      method,
      command,
      serverUrl,
      copyText: command.replace(/\\\n/g, " "),
      message: "Token regenerated",
    });
  } catch (error) {
    console.error("Command regeneration error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ─── ENROLLMENT HELPERS ────────────────────────────────────────────────────

async function findEnrollmentToken(token) {
  if (!global.dbAvailable) {
    return enrollmentMemoryStore.tokens.find((t) => t.token === token) || null;
  }
  try {
    const result = await getDb().query(
      "SELECT * FROM enrollment_tokens WHERE token = $1",
      [token],
    );
    return result.rows[0] || null;
  } catch (e) {
    return null;
  }
}

async function upsertDiscoveredRouter(enrollToken, tokenRecord, data, ip, ua) {
  const now = new Date().toISOString();

  if (!global.dbAvailable) {
    const existing = enrollmentMemoryStore.discovered.find(
      (d) => d.enrollment_token === enrollToken,
    );
    if (existing) {
      Object.assign(existing, {
        ...data,
        last_seen_at: now,
        updated_at: now,
        source_ip: ip,
        user_agent: ua,
      });
      return existing;
    }
    const record = {
      id: uuidv4(),
      enrollment_token: enrollToken,
      token_id: tokenRecord?.id || null,
      router_id: null,
      identity: data.identity || null,
      model: data.model || null,
      version: data.version || null,
      serial_number: data.serial_number || null,
      primary_mac: data.primary_mac || null,
      source_ip: ip,
      user_agent: ua,
      interfaces: data.interfaces || [],
      ip_addresses: data.ip_addresses || [],
      raw_payload: data,
      suggested_wan_interface: data.suggested_wan_interface || null,
      suggested_lan_interface: "bridge1",
      suggested_lan_ports: data.suggested_lan_ports || [],
      status: "discovered",
      first_seen_at: now,
      last_seen_at: now,
      approved_at: null,
      created_at: now,
      updated_at: now,
    };
    enrollmentMemoryStore.discovered.push(record);
    return record;
  }

  try {
    const existing = await getDb().query(
      "SELECT id FROM discovered_routers WHERE enrollment_token = $1",
      [enrollToken],
    );
    if (existing.rows.length > 0) {
      const result = await getDb().query(
        `UPDATE discovered_routers SET
           identity = COALESCE($1, identity),
           model = COALESCE($2, model),
           version = COALESCE($3, version),
           serial_number = COALESCE($4, serial_number),
           primary_mac = COALESCE($5, primary_mac),
           source_ip = $6,
           user_agent = $7,
           interfaces = COALESCE($8, interfaces),
           ip_addresses = COALESCE($9, ip_addresses),
           raw_payload = $10,
           suggested_wan_interface = COALESCE($11, suggested_wan_interface),
           suggested_lan_ports = COALESCE($12, suggested_lan_ports),
           last_seen_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
         WHERE enrollment_token = $13
         RETURNING *`,
        [
          data.identity || null,
          data.model || null,
          data.version || null,
          data.serial_number || null,
          data.primary_mac || null,
          ip,
          ua,
          JSON.stringify(data.interfaces || []),
          JSON.stringify(data.ip_addresses || []),
          JSON.stringify(data),
          data.suggested_wan_interface || null,
          data.suggested_lan_ports || null,
          enrollToken,
        ],
      );
      return result.rows[0];
    }

    const result = await getDb().query(
      `INSERT INTO discovered_routers
         (id, enrollment_token, token_id, identity, model, version, serial_number, primary_mac,
          source_ip, user_agent, interfaces, ip_addresses, raw_payload,
          suggested_wan_interface, suggested_lan_interface, suggested_lan_ports, status,
          first_seen_at, last_seen_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'bridge1',$15,'discovered',
               CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        uuidv4(),
        enrollToken,
        tokenRecord?.id || null,
        data.identity || null,
        data.model || null,
        data.version || null,
        data.serial_number || null,
        data.primary_mac || null,
        ip,
        ua,
        JSON.stringify(data.interfaces || []),
        JSON.stringify(data.ip_addresses || []),
        JSON.stringify(data),
        data.suggested_wan_interface || null,
        data.suggested_lan_ports || null,
      ],
    );
    return result.rows[0];
  } catch (e) {
    console.error("[Enrollment] upsertDiscoveredRouter error:", e.message);
    return null;
  }
}

function appendInterfaceToDiscovered(enrollToken, iface) {
  if (!global.dbAvailable) {
    const record = enrollmentMemoryStore.discovered.find(
      (d) => d.enrollment_token === enrollToken,
    );
    if (record) {
      const list = Array.isArray(record.interfaces) ? record.interfaces : [];
      const existing = list.findIndex((i) => i.name === iface.name);
      if (existing >= 0) {
        list[existing] = { ...list[existing], ...iface };
      } else {
        list.push(iface);
      }
      record.interfaces = list;

      // Auto-suggest WAN (first running non-bridge ethernet)
      const ethRunning = list.filter(
        (i) => !i.disabled && i.running && i.type && i.type.includes("ether"),
      );
      if (!record.suggested_wan_interface && ethRunning.length > 0) {
        record.suggested_wan_interface = ethRunning[0].name;
        record.suggested_lan_ports = ethRunning.slice(1).map((i) => i.name);
      }
    }
    return;
  }

  getDb()
    .query(
      `UPDATE discovered_routers
     SET interfaces = (
           CASE
             WHEN interfaces @> $1::jsonb THEN interfaces
             ELSE interfaces || $1::jsonb
           END
         ),
         suggested_wan_interface = COALESCE(suggested_wan_interface, $2),
         last_seen_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE enrollment_token = $3`,
      [
        JSON.stringify([iface]),
        iface.running &&
        !iface.disabled &&
        iface.type &&
        iface.type.includes("ether")
          ? iface.name
          : null,
        enrollToken,
      ],
    )
    .catch((e) =>
      console.error("[Enrollment] appendInterface error:", e.message),
    );
}

function appendAddressToDiscovered(enrollToken, addr) {
  if (!global.dbAvailable) {
    const record = enrollmentMemoryStore.discovered.find(
      (d) => d.enrollment_token === enrollToken,
    );
    if (record) {
      const list = Array.isArray(record.ip_addresses)
        ? record.ip_addresses
        : [];
      if (
        !list.find(
          (a) => a.address === addr.address && a.interface === addr.interface,
        )
      ) {
        list.push(addr);
      }
      record.ip_addresses = list;
    }
    return;
  }

  getDb()
    .query(
      `UPDATE discovered_routers
     SET ip_addresses = ip_addresses || $1::jsonb,
         last_seen_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE enrollment_token = $2`,
      [JSON.stringify([addr]), enrollToken],
    )
    .catch((e) =>
      console.error("[Enrollment] appendAddress error:", e.message),
    );
}

// ─── ENROLLMENT PUBLIC ROUTES ──────────────────────────────────────────────

/**
 * GET /mikrotik/enroll/bootstrap/:token
 * The MikroTik downloads and runs this script.
 * It collects identity, model, version, interfaces, IPs and reports back.
 */
router.get("/enroll/bootstrap/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const ip = req.ip || req.connection.remoteAddress;
    const ua = req.get("User-Agent") || "RouterOS";

    const tokenRecord = await findEnrollmentToken(token);

    if (!tokenRecord) {
      return res
        .status(404)
        .type("text/plain")
        .send(
          "# ERROR: Invalid enrollment token. Generate a new one from the platform.",
        );
    }

    if (tokenRecord.status === "approved" || tokenRecord.status === "expired") {
      return res
        .status(410)
        .type("text/plain")
        .send(
          `# ERROR: Enrollment token is ${tokenRecord.status}. Generate a new one.`,
        );
    }

    if (
      tokenRecord.expires_at &&
      new Date(tokenRecord.expires_at) < new Date()
    ) {
      return res
        .status(410)
        .type("text/plain")
        .send(
          "# ERROR: Enrollment token has expired. Generate a new one from the platform.",
        );
    }

    const serverUrl = getServerBaseUrl(req);
    const cleanUrl = serverUrl.replace(/\/$/, "");
    const mode = cleanUrl.startsWith("https") ? "https" : "http";

    // RouterOS enrollment script - works on RouterOS v6.49+ and all v7
    const script = [
      "#############################################",
      "# Zero-Touch Enrollment Script",
      "# Generated by MikroTik Billing Platform",
      `# Token: ${token}`,
      `# Server: ${cleanUrl}`,
      "#############################################",
      "",
      ':local enrollToken "' + token + '"',
      ':local serverUrl "' + cleanUrl + '"',
      ':local fetchMode "' + mode + '"',
      "",
      "# ── Step 1: Collect system info ──",
      ":local sysIdentity [/system identity get name]",
      ':local sysModel ""',
      ':local sysVersion ""',
      ':local sysUptime ""',
      ':local sysSerial ""',
      ':local sysMac ""',
      "",
      ":do { :set sysModel [/system resource get board-name] } on-error={}",
      ":do { :set sysVersion [/system resource get version] } on-error={}",
      ":do { :set sysUptime [/system resource get uptime] } on-error={}",
      ":do { :set sysSerial [/system routerboard get serial-number] } on-error={}",
      "",
      "# Get first ethernet MAC as primary identifier",
      ":do {",
      "  :local eths [/interface ethernet find]",
      "  :if ([:len $eths] > 0) do={",
      "    :set sysMac [/interface ethernet get ($eths->0) mac-address]",
      "  }",
      "} on-error={}",
      "",
      "# ── Step 2: Report system info ──",
      ':local reportUrl ($serverUrl . "/mikrotik/enroll/report/" . $enrollToken)',
      ':local sysPayload ("identity=" . $sysIdentity . "&model=" . $sysModel . "&version=" . $sysVersion . "&uptime=" . $sysUptime . "&serial=" . $sysSerial . "&mac=" . $sysMac)',
      "",
      ":do {",
      "  /tool fetch mode=$fetchMode url=$reportUrl http-method=post http-data=$sysPayload keep-result=no",
      "} on-error={",
      "  # Fallback: encode in URL for older RouterOS",
      '  /tool fetch mode=$fetchMode url=($reportUrl . "?" . $sysPayload) keep-result=no',
      "}",
      "",
      ':log info message=("[ZTP] Reported system info: " . $sysIdentity)',
      "",
      "# ── Step 3: Report each interface ──",
      ":foreach iface in=[/interface find] do={",
      '  :local iName ""',
      '  :local iType ""',
      '  :local iMac ""',
      '  :local iRunning "false"',
      '  :local iDisabled "false"',
      "",
      "  :do { :set iName [/interface get $iface name] } on-error={}",
      "  :do { :set iType [/interface get $iface type] } on-error={}",
      "  :do { :set iMac [/interface get $iface mac-address] } on-error={}",
      "  :do {",
      '    :if ([/interface get $iface running]) do={ :set iRunning "true" }',
      "  } on-error={}",
      "  :do {",
      '    :if ([/interface get $iface disabled]) do={ :set iDisabled "true" }',
      "  } on-error={}",
      "",
      '  :local ifaceUrl ($serverUrl . "/mikrotik/enroll/iface/" . $enrollToken . "?n=" . $iName . "&t=" . $iType . "&m=" . $iMac . "&r=" . $iRunning . "&d=" . $iDisabled)',
      "  :do { /tool fetch mode=$fetchMode url=$ifaceUrl keep-result=no } on-error={}",
      "}",
      "",
      "# ── Step 4: Report IP addresses ──",
      ":foreach addr in=[/ip address find] do={",
      '  :local aAddr ""',
      '  :local aIface ""',
      "  :do { :set aAddr [/ip address get $addr address] } on-error={}",
      "  :do { :set aIface [/ip address get $addr interface] } on-error={}",
      '  :local addrUrl ($serverUrl . "/mikrotik/enroll/addr/" . $enrollToken . "?addr=" . $aAddr . "&iface=" . $aIface)',
      "  :do { /tool fetch mode=$fetchMode url=$addrUrl keep-result=no } on-error={}",
      "}",
      "",
      "# ── Step 5: Signal enrollment complete ──",
      ":do {",
      '  /tool fetch mode=$fetchMode url=($serverUrl . "/mikrotik/enroll/done/" . $enrollToken) keep-result=no',
      "} on-error={}",
      "",
      ':log info message="[ZTP] Enrollment report complete. Check the platform to approve this router."',
      ':put "[ZTP] Enrollment sent to ' + cleanUrl + '"',
      ':put "[ZTP] Check the platform Zero-Touch Provisioning page to approve this router."',
      "#############################################",
      "# End of Zero-Touch Enrollment Script",
      "#############################################",
    ].join("\n");

    // Log the bootstrap download
    console.log(`[Enrollment] Bootstrap fetched - token: ${token}, ip: ${ip}`);

    res.type("text/plain").send(script);
  } catch (error) {
    console.error("[Enrollment] Bootstrap error:", error.message);
    res.status(500).type("text/plain").send("# ERROR: Internal server error");
  }
});

/**
 * POST /mikrotik/enroll/report/:token  (also accepts GET with query params)
 * Router reports system identity, model, version, serial number, primary MAC
 */
router.all("/enroll/report/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const ip = req.ip || req.connection.remoteAddress;
    const ua = req.get("User-Agent") || "RouterOS";
    const raw = { ...req.query, ...req.body };

    const tokenRecord = await findEnrollmentToken(token);
    if (!tokenRecord) {
      return res.type("text/plain").send("# ERROR: Invalid enrollment token");
    }

    if (
      tokenRecord.expires_at &&
      new Date(tokenRecord.expires_at) < new Date()
    ) {
      return res.type("text/plain").send("# ERROR: Token expired");
    }

    const data = {
      identity: raw.identity || raw.name || null,
      model: raw.model || raw.board || null,
      version: raw.version || raw.ver || null,
      serial_number: raw.serial || raw.serial_number || null,
      primary_mac: raw.mac || raw.primary_mac || null,
      uptime: raw.uptime || null,
      interfaces: [],
      ip_addresses: [],
      suggested_wan_interface: null,
      suggested_lan_ports: [],
    };

    await upsertDiscoveredRouter(token, tokenRecord, data, ip, ua);

    console.log(
      `[Enrollment] System report received - identity: ${data.identity}, model: ${data.model}, ip: ${ip}`,
    );
    res.type("text/plain").send("# OK: System info received");
  } catch (error) {
    console.error("[Enrollment] Report error:", error.message);
    res.type("text/plain").send("# ERROR: " + error.message);
  }
});

/**
 * GET /mikrotik/enroll/iface/:token
 * Router reports a single interface (called once per interface in a loop)
 * Query: n=name, t=type, m=mac, r=running(true/false), d=disabled(true/false)
 */
router.get("/enroll/iface/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { n: name, t: type, m: mac, r: running, d: disabled } = req.query;

    if (!name) {
      return res.type("text/plain").send("# SKIP: no name");
    }

    const tokenRecord = await findEnrollmentToken(token);
    if (!tokenRecord) {
      return res.type("text/plain").send("# ERROR: Invalid token");
    }

    const iface = {
      name,
      type: type || "",
      mac_address: mac || "",
      running: running === "true",
      disabled: disabled === "true",
      addresses: [],
    };

    appendInterfaceToDiscovered(token, iface);

    res.type("text/plain").send("# OK");
  } catch (error) {
    console.error("[Enrollment] Iface error:", error.message);
    res.type("text/plain").send("# ERROR: " + error.message);
  }
});

/**
 * GET /mikrotik/enroll/addr/:token
 * Router reports a single IP address
 * Query: addr=192.168.88.1/24, iface=ether1
 */
router.get("/enroll/addr/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { addr, iface } = req.query;

    if (!addr) {
      return res.type("text/plain").send("# SKIP: no address");
    }

    const tokenRecord = await findEnrollmentToken(token);
    if (!tokenRecord) {
      return res.type("text/plain").send("# ERROR: Invalid token");
    }

    appendAddressToDiscovered(token, { address: addr, interface: iface || "" });

    res.type("text/plain").send("# OK");
  } catch (error) {
    console.error("[Enrollment] Addr error:", error.message);
    res.type("text/plain").send("# ERROR: " + error.message);
  }
});

/**
 * GET /mikrotik/enroll/done/:token
 * Router signals it has finished reporting all data.
 * We do a final auto-suggestion of WAN/LAN ports if not already set.
 */
router.get("/enroll/done/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const ip = req.ip || req.connection.remoteAddress;

    if (!global.dbAvailable) {
      const record = enrollmentMemoryStore.discovered.find(
        (d) => d.enrollment_token === token,
      );
      if (record && record.interfaces?.length > 0) {
        const etherRunning = record.interfaces.filter(
          (i) => !i.disabled && i.running && i.type?.includes("ether"),
        );
        if (!record.suggested_wan_interface && etherRunning.length > 0) {
          record.suggested_wan_interface = etherRunning[0].name;
          record.suggested_lan_ports = etherRunning.slice(1).map((i) => i.name);
        }
      }
    } else {
      // Re-compute suggested WAN/LAN from interfaces stored in DB
      try {
        const result = await getDb().query(
          "SELECT id, interfaces FROM discovered_routers WHERE enrollment_token = $1",
          [token],
        );
        if (result.rows.length > 0) {
          const row = result.rows[0];
          let interfaces = row.interfaces;
          if (typeof interfaces === "string") {
            try {
              interfaces = JSON.parse(interfaces);
            } catch (e) {
              interfaces = [];
            }
          }
          if (Array.isArray(interfaces) && interfaces.length > 0) {
            const etherRunning = interfaces.filter(
              (i) => !i.disabled && i.running && i.type?.includes("ether"),
            );
            if (etherRunning.length > 0) {
              await getDb().query(
                `UPDATE discovered_routers
                 SET suggested_wan_interface = COALESCE(suggested_wan_interface, $1),
                     suggested_lan_ports = COALESCE(suggested_lan_ports, $2),
                     last_seen_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE enrollment_token = $3`,
                [
                  etherRunning[0].name,
                  etherRunning.slice(1).map((i) => i.name),
                  token,
                ],
              );
            }
          }
        }
      } catch (e) {
        console.warn("[Enrollment] done finalization error:", e.message);
      }
    }

    console.log(
      `[Enrollment] Done signal received - token: ${token}, ip: ${ip}`,
    );
    res
      .type("text/plain")
      .send(
        "# OK: Enrollment complete. Check the platform to approve this router.",
      );
  } catch (error) {
    console.error("[Enrollment] Done error:", error.message);
    res.type("text/plain").send("# ERROR: " + error.message);
  }
});

module.exports = router;
