const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const logger = require("../utils/logger");
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

// Simple in-memory cache for provision scripts (30s TTL)
const provisionCache = new Map();
const PROVISION_CACHE_TTL = 30_000; // 30 seconds

function getCachedScript(token) {
  const cached = provisionCache.get(token);
  if (cached && Date.now() - cached.timestamp < PROVISION_CACHE_TTL) {
    return cached.script;
  }
  provisionCache.delete(token);
  return null;
}

function setCachedScript(token, script) {
  provisionCache.set(token, { script, timestamp: Date.now() });
  // Evict old entries if cache grows too large
  if (provisionCache.size > 100) {
    const oldest = [...provisionCache.entries()]
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)
      .slice(0, 20);
    oldest.forEach(([key]) => provisionCache.delete(key));
  }
}

// GET /mikrotik/provision/:token - Router downloads its config
router.get("/provision/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const ip = req.ip || req.connection.remoteAddress;
    const ua = req.get("User-Agent") || "unknown";

    // Check cache first
    const cached = getCachedScript(token);
    if (cached) {
      return res.type("text/plain").send(cached);
    }

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

    // Cache the script for subsequent rapid requests (e.g., retries)
    setCachedScript(token, script);

    // Log the script for debugging
    logger.info(
      `[Provision] Generated script for router ${routerData.id} (${routerData.name}):`,
    );
    logger.info("--- SCRIPT START ---");
    const scriptLines = script.split("\n");
    scriptLines.forEach((line, idx) => {
      logger.info(`${String(idx + 1).padStart(3)}: ${line}`);
    });
    logger.info("--- SCRIPT END ---");

    // Log the event
    await getDb().query(
      "INSERT INTO provision_events (id, router_id, event_type, script_content) VALUES ($1, $2, $3, $4)",
      [uuidv4(), routerData.id, "script_generated", script],
    );

    res.type("text/plain").send(script);
  } catch (error) {
    logger.error("Provision error:", {
      error: error.message,
      stack: error.stack,
    });
    res
      .status(500)
      .type("text/plain")
      .send(`# ERROR: ${error.message || "Internal server error"}`);
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

    // Invalidate cached script so next fetch is fresh
    provisionCache.delete(token);

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
    logger.error("Callback error:", {
      error: error.message,
      stack: error.stack,
    });
    res
      .status(500)
      .type("text/plain")
      .send(`# ERROR: ${error.message || "Internal server error"}`);
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
    logger.error("Command generation error:", { error: error.message });
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
    logger.error("Command regeneration error:", { error: error.message });
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
      mgmt_username: data.mgmt_username || null,
      mgmt_password: data.mgmt_password || null,
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
           mgmt_username = COALESCE($14, mgmt_username),
           mgmt_password = COALESCE($15, mgmt_password),
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
          data.mgmt_username || null,
          data.mgmt_password || null,
        ],
      );
      return result.rows[0];
    }

    const result = await getDb().query(
      `INSERT INTO discovered_routers
         (id, enrollment_token, token_id, identity, model, version, serial_number, primary_mac,
          source_ip, user_agent, interfaces, ip_addresses, raw_payload,
          suggested_wan_interface, suggested_lan_interface, suggested_lan_ports, status,
          mgmt_username, mgmt_password,
          first_seen_at, last_seen_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'bridge1',$15,'discovered',
               $16,$17,
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
        data.mgmt_username || null,
        data.mgmt_password || null,
      ],
    );
    return result.rows[0];
  } catch (e) {
    logger.error("[Enrollment] upsertDiscoveredRouter error:", {
      error: e.message,
    });
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
      logger.error("[Enrollment] appendInterface error:", { error: e.message }),
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
      logger.error("[Enrollment] appendAddress error:", { error: e.message }),
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
    const isHttps = cleanUrl.startsWith("https");
    const mode = isHttps ? "https" : "http";
    // check-certificate=no is required for HTTPS on RouterOS when the server
    // uses a certificate from a CA that RouterOS does not have in its store,
    // or when TLS negotiation times out (common on Render, Railway, etc).
    // We always set it so the script works regardless of RouterOS cert store state.
    const certCheck = "check-certificate=no";

    // NOTE: All /tool fetch calls inside this script use GET-only with query
    // params.  http-method=post / http-data= are RouterOS v7-only and silently
    // break on v6.  GET works on all versions (v6.49+, v7.x).

    const fetchCmd = (urlExpr) =>
      `/tool fetch mode=${mode} ${certCheck} url=${urlExpr} keep-result=no`;

    // RouterOS enrollment script - works on RouterOS v6.49+ and all v7
    const script = [
      "#############################################",
      "# Zero-Touch Enrollment Script",
      "# Generated by MikroTik Billing Platform",
      `# Token: ${token}`,
      `# Server: ${cleanUrl}`,
      "# Works on RouterOS v6.49+ and v7.x",
      "#############################################",
      "",
      ':local enrollToken "' + token + '"',
      ':local serverUrl "' + cleanUrl + '"',
      "",
      "# ── Optional: Management credentials for auto billing linking ──",
      "# Set these on the router BEFORE running this script:",
      '#   :global ztpMgmtUser "admin"',
      '#   :global ztpMgmtPass "password"',
      ":global ztpMgmtUser; :global ztpMgmtPass;",
      ":local mgmtUser $ztpMgmtUser",
      ":local mgmtPass $ztpMgmtPass",
      ':if ([:len $mgmtUser] > 0) do={ :log info message="[ZTP] Mgmt user provided: $mgmtUser" }',
      "",
      "# URL-encode subroutine - encodes special characters in URL parameters",
      ":global ztpUrlEncode do={",
      "  :local str $1",
      '  :local result ""',
      "  :local i 0",
      '  :local ch ""',
      "  :local len [:len $str]",
      "  :while ($i < $len) do={",
      "    :set ch [:pick $str $i]",
      '    :if ($ch = " ") do={ :set result ($result . "%20") } else={',
      '      :if ($ch = "&") do={ :set result ($result . "%26") } else={',
      '        :if ($ch = "=") do={ :set result ($result . "%3D") } else={',
      '          :if ($ch = "/") do={ :set result ($result . "%2F") } else={',
      '            :if ($ch = "?") do={ :set result ($result . "%3F") } else={',
      '              :if ($ch = "#") do={ :set result ($result . "%23") } else={',
      '                :if ($ch = "+") do={ :set result ($result . "%2B") } else={',
      '                  :if ($ch = "@") do={ :set result ($result . "%40") } else={',
      '                    :if ($ch = ":") do={ :set result ($result . "%3A") } else={',
      "                      :set result ($result . $ch)",
      "                    }",
      "                  }",
      "                }",
      "              }",
      "            }",
      "          }",
      "        }",
      "      }",
      "    }",
      "    :set i ($i + 1)",
      "  }",
      "  :return $result",
      "}",
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
      "# ── Step 2: Report system info via GET (v6 + v7 compatible) ──",
      ':local reportUrl ($serverUrl . "/mikrotik/enroll/report/" . $enrollToken . "?identity=" . [$ztpUrlEncode $sysIdentity] . "&model=" . [$ztpUrlEncode $sysModel] . "&version=" . [$ztpUrlEncode $sysVersion] . "&uptime=" . [$ztpUrlEncode $sysUptime] . "&serial=" . [$ztpUrlEncode $sysSerial] . "&mac=" . [$ztpUrlEncode $sysMac])',
      ':if ([:len $mgmtUser] > 0) do={ :set reportUrl ($reportUrl . "&mgmt_user=" . [$ztpUrlEncode $mgmtUser] . "&mgmt_pass=" . [$ztpUrlEncode $mgmtPass]) }',
      `:do { ${fetchCmd("$reportUrl")} } on-error={}`,
      "",
      ':log info message=("[ZTP] Reported system info: " . $sysIdentity)',
      "",
      "# ── Step 3: Report each interface (one GET per interface) ──",
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
      '  :local ifaceUrl ($serverUrl . "/mikrotik/enroll/iface/" . $enrollToken . "?n=" . [$ztpUrlEncode $iName] . "&t=" . [$ztpUrlEncode $iType] . "&m=" . [$ztpUrlEncode $iMac] . "&r=" . [$ztpUrlEncode $iRunning] . "&d=" . [$ztpUrlEncode $iDisabled])',
      `  :do { ${fetchCmd("$ifaceUrl")} } on-error={}`,
      "}",
      "",
      "# ── Step 4: Report IP addresses ──",
      ":foreach addr in=[/ip address find] do={",
      '  :local aAddr ""',
      '  :local aIface ""',
      "  :do { :set aAddr [/ip address get $addr address] } on-error={}",
      "  :do { :set aIface [/ip address get $addr interface] } on-error={}",
      '  :local addrUrl ($serverUrl . "/mikrotik/enroll/addr/" . $enrollToken . "?addr=" . [$ztpUrlEncode $aAddr] . "&iface=" . [$ztpUrlEncode $aIface])',
      `  :do { ${fetchCmd("$addrUrl")} } on-error={}`,
      "}",
      "",
      "# ── Step 5: Signal enrollment complete ──",
      `:do { ${fetchCmd('($serverUrl . "/mikrotik/enroll/done/" . $enrollToken)')} } on-error={}`,
      "",
      ':log info message="[ZTP] Enrollment complete. Check the platform Discovered Routers tab to approve this router."',
      ':put "[ZTP] Done. Visit the platform and approve this router in the Discovered Routers tab."',
      "#############################################",
      "# End of Zero-Touch Enrollment Script",
      "#############################################",
    ].join("\n");

    // Log the bootstrap download
    logger.info(`[Enrollment] Bootstrap fetched - token: ${token}, ip: ${ip}`);

    res.type("text/plain").send(script);
  } catch (error) {
    logger.error("[Enrollment] Bootstrap error:", { error: error.message });
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
      mgmt_username: raw.mgmt_user || null,
      mgmt_password: raw.mgmt_pass || null,
    };

    await upsertDiscoveredRouter(token, tokenRecord, data, ip, ua);

    logger.info(
      `[Enrollment] System report received - identity: ${data.identity}, model: ${data.model}, ip: ${ip}`,
    );
    res.type("text/plain").send("# OK: System info received");
  } catch (error) {
    logger.error("[Enrollment] Report error:", { error: error.message });
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
    logger.error("[Enrollment] Iface error:", { error: error.message });
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
    logger.error("[Enrollment] Addr error:", { error: error.message });
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

    logger.info(
      `[Enrollment] Done signal received - token: ${token}, ip: ${ip}`,
    );
    res
      .type("text/plain")
      .send(
        "# OK: Enrollment complete. Check the platform to approve this router.",
      );
  } catch (error) {
    logger.error("[Enrollment] Done error:", { error: error.message });
    res.type("text/plain").send("# ERROR: " + error.message);
  }
});

/**
 * GET /mikrotik/enroll/auto-complete/:token
 * Called by the one-shot script after reporting all data.
 * Auto-approves the discovered router, creates a router record,
 * generates a provision token, and returns a RouterOS script that
 * directly fetches and applies the provision script (no variable passing needed).
 */
router.get("/enroll/auto-complete/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const serverUrl = req.query.serverUrl || getServerBaseUrl(req);
    const cleanBaseUrl = serverUrl.replace(/\/$/, "");
    const isHttps = cleanBaseUrl.startsWith("https");
    const mode = isHttps ? "https" : "http";
    const certCheck = "check-certificate=no";

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

    // 1. Find the discovered router
    let discovered = null;
    if (!global.dbAvailable) {
      discovered = enrollmentMemoryStore.discovered.find(
        (d) => d.enrollment_token === token,
      );
    } else {
      const result = await getDb().query(
        "SELECT * FROM discovered_routers WHERE enrollment_token = $1",
        [token],
      );
      discovered = result.rows[0] || null;
    }

    if (!discovered) {
      if (!global.dbAvailable) {
        discovered = {
          id: uuidv4(),
          enrollment_token: token,
          identity: "router",
          model: "unknown",
          primary_mac: "00:00:00:00:00:00",
          suggested_wan_interface: "ether1",
          suggested_lan_ports: [
            "ether2",
            "ether3",
            "ether4",
            "ether5",
            "ether6",
            "ether7",
            "ether8",
          ],
          status: "discovered",
        };
        enrollmentMemoryStore.discovered.push(discovered);
      } else {
        return res
          .type("text/plain")
          .send(
            "# ERROR: Router not discovered yet. Complete enrollment first.",
          );
      }
    }

    // 2. Mark as approved
    const now = new Date().toISOString();
    if (!global.dbAvailable) {
      discovered.status = "approved";
      discovered.approved_at = now;
    } else {
      await getDb().query(
        `UPDATE discovered_routers SET status = 'approved', approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE enrollment_token = $1`,
        [token],
      );
    }

    // 3. Create router record with provision token
    const provisionToken = provisionStore.generateToken();
    const routerId = `router-${uuidv4().slice(0, 8)}`;
    const routerName = discovered.identity || "ztp-router";
    const wanIface = discovered.suggested_wan_interface || "ether1";
    const lanIface = discovered.suggested_lan_interface || "bridge1";
    const lanPorts = discovered.suggested_lan_ports || [
      "ether2",
      "ether3",
      "ether4",
    ];
    const macAddr = discovered.primary_mac || "00:00:00:00:00:00";

    if (!global.dbAvailable) {
      const store = provisionStore.extendStore();
      if (!store.routers.find((r) => r.provision_token === provisionToken)) {
        store.routers.push({
          id: routerId,
          project_id: null,
          name: routerName,
          identity: routerName,
          model: discovered.model || "unknown",
          mac_address: macAddr,
          ip_address: discovered.source_ip || "",
          wan_interface: wanIface,
          lan_interface: lanIface,
          provision_token: provisionToken,
          provision_status: "pending",
          last_provisioned_at: null,
          provision_attempts: 0,
          dns_servers: ["8.8.8.8", "8.8.4.4"],
          ntp_servers: ["pool.ntp.org"],
          radius_server: "",
          radius_secret: "",
          radius_port: 1812,
          hotspot_enabled: false,
          pppoe_enabled: false,
          pppoe_interface: "",
          pppoe_service_name: "",
          mgmt_port: 8728,
          mgmt_username: discovered.mgmt_username || "",
          mgmt_password_encrypted: discovered.mgmt_password
            ? zeroTouchBilling.encryptForMikrotik(discovered.mgmt_password)
            : null,
          notes: "",
          lan_ports: lanPorts,
          created_at: now,
          updated_at: now,
        });
      }
    } else {
      const existingRouter = await getDb().query(
        "SELECT id FROM routers WHERE provision_token = $1",
        [provisionToken],
      );
      if (existingRouter.rows.length === 0) {
        const mgmtPasswordEncrypted = discovered.mgmt_password
          ? zeroTouchBilling.encryptForMikrotik(discovered.mgmt_password)
          : null;
        await getDb().query(
          `INSERT INTO routers (id, name, identity, model, mac_address, ip_address, wan_interface, lan_interface, provision_token, provision_status, mgmt_username, mgmt_password_encrypted, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
          [
            routerId,
            routerName,
            routerName,
            discovered.model || "unknown",
            macAddr,
            discovered.source_ip || "",
            wanIface,
            lanIface,
            provisionToken,
            discovered.mgmt_username || null,
            mgmtPasswordEncrypted,
          ],
        );
      }
    }

    logger.info(
      `[Enrollment] Auto-complete - token: ${token}, provisionToken: ${provisionToken}, router: ${routerName}`,
    );

    // Return a script that directly fetches AND applies the provision script
    // This avoids RouterOS variable scoping issues between imported files
    const provUrl = `${cleanBaseUrl}/mikrotik/provision/${provisionToken}`;
    const fetchCmd = `/tool fetch mode=${mode} ${certCheck} url="${provUrl}" dst-path=provision.rsc`;
    const response = [
      "# Auto-generated by MikroTik Billing Platform",
      fetchCmd + "; /import file-name=provision.rsc",
    ].join("\n");

    res.type("text/plain").send(response);
  } catch (error) {
    logger.error("[Enrollment] Auto-complete error:", { error: error.message });
    res.type("text/plain").send("# ERROR: " + error.message);
  }
});

/**
 * GET /mikrotik/ztp/one-shot/:token
 * ONE-STEP Zero-Touch Provisioning — discover + auto-approve + provision in a single script.
 * Just run this ONE command on the router and it's fully set up.
 */
router.get("/ztp/one-shot/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const serverUrl = getServerBaseUrl(req);
    const cleanUrl = serverUrl.replace(/\/$/, "");
    const isHttps = cleanUrl.startsWith("https");
    const mode = isHttps ? "https" : "http";
    const certCheck = "check-certificate=no";

    const fetchNoKeep = (urlExpr) =>
      `/tool fetch mode=${mode} ${certCheck} url=${urlExpr} keep-result=no`;
    const fetchSaveFile = (urlExpr, dst) =>
      `/tool fetch mode=${mode} ${certCheck} url=${urlExpr} dst-path=${dst}`;

    const script = [
      "#############################################",
      "# MikroTik One-Shot ZTP Script",
      "# Generated by MikroTik Billing Platform",
      `# Token: ${token}`,
      `# Server: ${cleanUrl}`,
      "# Discover + Auto-Approve + Provision in ONE step",
      "# Works on RouterOS v6.49+ and v7.x",
      "#############################################",
      "",
      ':local enrollToken "' + token + '"',
      ':local serverUrl "' + cleanUrl + '"',
      "",
      "# ── Optional: Management credentials for auto billing linking ──",
      "# Set these on the router BEFORE running this script:",
      '#   :global ztpMgmtUser "admin"',
      '#   :global ztpMgmtPass "password"',
      ":global ztpMgmtUser; :global ztpMgmtPass;",
      ":local mgmtUser $ztpMgmtUser",
      ":local mgmtPass $ztpMgmtPass",
      ':if ([:len $mgmtUser] > 0) do={ :log info message="[ZTP] Mgmt user provided: $mgmtUser" }',
      "",
      "# URL-encode subroutine - encodes special characters in URL parameters",
      ":global ztpUrlEncode do={",
      "  :local str $1",
      '  :local result ""',
      "  :local i 0",
      '  :local ch ""',
      "  :local len [:len $str]",
      "  :while ($i < $len) do={",
      "    :set ch [:pick $str $i]",
      '    :if ($ch = " ") do={ :set result ($result . "%20") } else={',
      '      :if ($ch = "&") do={ :set result ($result . "%26") } else={',
      '        :if ($ch = "=") do={ :set result ($result . "%3D") } else={',
      '          :if ($ch = "/") do={ :set result ($result . "%2F") } else={',
      '            :if ($ch = "?") do={ :set result ($result . "%3F") } else={',
      '              :if ($ch = "#") do={ :set result ($result . "%23") } else={',
      '                :if ($ch = "+") do={ :set result ($result . "%2B") } else={',
      '                  :if ($ch = "@") do={ :set result ($result . "%40") } else={',
      '                    :if ($ch = ":") do={ :set result ($result . "%3A") } else={',
      "                      :set result ($result . $ch)",
      "                    }",
      "                  }",
      "                }",
      "              }",
      "            }",
      "          }",
      "        }",
      "      }",
      "    }",
      "    :set i ($i + 1)",
      "  }",
      "  :return $result",
      "}",
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
      ':local reportUrl ($serverUrl . "/mikrotik/enroll/report/" . $enrollToken . "?identity=" . [$ztpUrlEncode $sysIdentity] . "&model=" . [$ztpUrlEncode $sysModel] . "&version=" . [$ztpUrlEncode $sysVersion] . "&uptime=" . [$ztpUrlEncode $sysUptime] . "&serial=" . [$ztpUrlEncode $sysSerial] . "&mac=" . [$ztpUrlEncode $sysMac])',
      ':if ([:len $mgmtUser] > 0) do={ :set reportUrl ($reportUrl . "&mgmt_user=" . [$ztpUrlEncode $mgmtUser] . "&mgmt_pass=" . [$ztpUrlEncode $mgmtPass]) }',
      `:do { ${fetchNoKeep("$reportUrl")} } on-error={}`,
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
      '  :do {\n    :if ([/interface get $iface running]) do={ :set iRunning "true" }\n  } on-error={}',
      '  :do {\n    :if ([/interface get $iface disabled]) do={ :set iDisabled "true" }\n  } on-error={}',
      "",
      '  :local ifaceUrl ($serverUrl . "/mikrotik/enroll/iface/" . $enrollToken . "?n=" . [$ztpUrlEncode $iName] . "&t=" . [$ztpUrlEncode $iType] . "&m=" . [$ztpUrlEncode $iMac] . "&r=" . [$ztpUrlEncode $iRunning] . "&d=" . [$ztpUrlEncode $iDisabled])',
      `  :do { ${fetchNoKeep("$ifaceUrl")} } on-error={}`,
      "}",
      "",
      "# ── Step 4: Report IP addresses ──",
      ":foreach addr in=[/ip address find] do={",
      '  :local aAddr ""',
      '  :local aIface ""',
      "  :do { :set aAddr [/ip address get $addr address] } on-error={}",
      "  :do { :set aIface [/ip address get $addr interface] } on-error={}",
      '  :local addrUrl ($serverUrl . "/mikrotik/enroll/addr/" . $enrollToken . "?addr=" . [$ztpUrlEncode $aAddr] . "&iface=" . [$ztpUrlEncode $aIface])',
      `  :do { ${fetchNoKeep("$addrUrl")} } on-error={}`,
      "}",
      "",
      "# ── Step 5: Auto-complete + provision (server approves, generates & returns provision script) ──",
      ':log info message="[ZTP] Enrollment complete. Auto-approving and provisioning..."',
      ':put "[ZTP] Auto-approving and applying configuration..."',
      `:local autoUrl ($serverUrl . "/mikrotik/enroll/auto-complete/" . $enrollToken . "?serverUrl=" . [$ztpUrlEncode $serverUrl])`,
      `:do { ${fetchSaveFile("$autoUrl", "ztp-provision.rsc")} } on-error={ :put "[ZTP] Failed to get provision script" }`,
      "",
      "# Wait up to 30s for the file to finish downloading before importing",
      ":local attempts 0",
      ":while ([:len [/file find name=ztp-provision.rsc]] = 0 && $attempts < 30) do={",
      "  :delay 1s",
      "  :set attempts ($attempts + 1)",
      "}",
      ':if ($attempts >= 30) do={ :put "[ZTP] Timeout waiting for provision script" }',
      "",
      "# ── Step 6: Run the provision script (auto-complete returned a fetch+import command) ──",
      ':do { /import file-name=ztp-provision.rsc } on-error={ :put "[ZTP] Provision script failed - check server logs" }',
      "",
      "# Cleanup temp files",
      ":do { /file remove ztp-provision.rsc } on-error={}",
      ":do { /file remove provision.rsc } on-error={}",
      "",
      ':put "[ZTP] One-shot provisioning complete! Router is now configured."',
      ':log info message="[ZTP] One-shot provisioning complete!"',
      "#############################################",
      "# End of One-Shot ZTP Script",
      "#############################################",
    ].join("\n");

    logger.info(`[ZTP] One-shot script fetched - token: ${token}`);
    res.type("text/plain").send(script);
  } catch (error) {
    logger.error("[ZTP] One-shot error:", { error: error.message });
    res.status(500).type("text/plain").send("# ERROR: Internal server error");
  }
});

module.exports = router;
