const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const billing = require("./billingData");
const mikrotikProvisioning = require("./mikrotikProvisioning");
const memoryDb = require("../db/memory");

function getDb() {
  return global.db || memoryDb;
}

function getEncryptionKey() {
  return Buffer.from(
    (process.env.ENCRYPTION_KEY || "default-key-change-in-production-32").slice(
      0,
      32,
    ),
  );
}

function encryptForMikrotik(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

async function getRouterById(routerId) {
  const result = await getDb().query("SELECT * FROM routers WHERE id = $1", [
    routerId,
  ]);
  return result.rows[0] || null;
}

async function getConnectionById(connectionId) {
  const result = await getDb().query(
    "SELECT * FROM mikrotik_connections WHERE id = $1",
    [connectionId],
  );
  return result.rows[0] || null;
}

async function updateRouterLink(routerId, connectionId, errorMessage = null) {
  try {
    await getDb().query(
      `UPDATE routers
       SET linked_mikrotik_connection_id = $1,
           billing_activated_at = CASE WHEN $1 IS NULL THEN billing_activated_at ELSE CURRENT_TIMESTAMP END,
           billing_activation_error = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [connectionId, errorMessage, routerId],
    );
  } catch (error) {
    console.error(
      `[updateRouterLink] Failed to update router ${routerId}:`,
      error.message,
    );
    // Fallback: try a simpler update without the billing columns
    try {
      await getDb().query(
        `UPDATE routers
         SET linked_mikrotik_connection_id = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [connectionId, routerId],
      );
    } catch (fallbackError) {
      console.error(
        `[updateRouterLink] Fallback update also failed for router ${routerId}:`,
        fallbackError.message,
      );
    }
  }
}

function buildConnectionFields(router, overrides = {}) {
  const connectionType =
    overrides.connection_type || router.connection_type || "api";
  const managementPort = Number(
    overrides.mgmt_port || router.mgmt_port || 8728,
  );
  const username = overrides.mgmt_username || router.mgmt_username || "";
  console.log("[ZTP buildConnectionFields] overrides.mgmt_username=", overrides.mgmt_username, "overrides.mgmt_password=", overrides.mgmt_password ? "SET" : "NOT SET", "router.mgmt_username=", router.mgmt_username);
  const passwordEncrypted = overrides.mgmt_password
    ? encryptForMikrotik(overrides.mgmt_password)
    : overrides.mgmt_password_encrypted ||
      router.mgmt_password_encrypted ||
      null;

  return {
    name: overrides.name || router.identity || router.name,
    ip_address: overrides.ip_address || router.ip_address || "",
    api_port: connectionType === "api" ? managementPort : 8728,
    ssh_port: connectionType === "ssh" ? managementPort : 22,
    username,
    password_encrypted: passwordEncrypted,
    connection_type: connectionType,
    use_tunnel: false,
    tunnel_host: null,
    tunnel_port: 22,
    tunnel_username: null,
    tunnel_password_encrypted: null,
  };
}

async function ensureMikrotikConnection(routerId, overrides = {}) {
  const router = await getRouterById(routerId);
  if (!router) {
    throw new Error("Router not found");
  }

  const fields = buildConnectionFields(router, overrides);
  if (!fields.ip_address) {
    return {
      success: false,
      status: "skipped",
      error: "Router IP address is missing",
    };
  }
  if (!fields.username || !fields.password_encrypted) {
  console.log("[ZTP ensureMikrotikConnection] fields.username=", fields.username, "fields.password_encrypted=", fields.password_encrypted ? "SET(len=" + fields.password_encrypted.length + ")" : "NOT SET");
    return {
      success: false,
      status: "skipped",
      error: "Management credentials are missing on this zero-touch router",
    };
  }

  const db = getDb();
  let connection;

  if (router.linked_mikrotik_connection_id) {
    const result = await db.query(
      `UPDATE mikrotik_connections
       SET name = $1,
           ip_address = $2,
           api_port = $3,
           ssh_port = $4,
           username = $5,
           password_encrypted = $6,
           connection_type = $7,
           use_tunnel = $8,
           tunnel_host = $9,
           tunnel_port = $10,
           tunnel_username = $11,
           tunnel_password_encrypted = $12,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $13
       RETURNING id, name, ip_address, api_port, ssh_port, username, connection_type, use_tunnel, tunnel_host, tunnel_port, tunnel_username, is_online, last_seen, created_at, updated_at`,
      [
        fields.name,
        fields.ip_address,
        fields.api_port,
        fields.ssh_port,
        fields.username,
        fields.password_encrypted,
        fields.connection_type,
        fields.use_tunnel,
        fields.tunnel_host,
        fields.tunnel_port,
        fields.tunnel_username,
        fields.tunnel_password_encrypted,
        router.linked_mikrotik_connection_id,
      ],
    );
    connection = result.rows[0] || null;
  }

  if (!connection) {
    const connectionId = uuidv4();
    const result = await db.query(
      `INSERT INTO mikrotik_connections
       (id, name, ip_address, api_port, ssh_port, username, password_encrypted, connection_type, use_tunnel, tunnel_host, tunnel_port, tunnel_username, tunnel_password_encrypted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, name, ip_address, api_port, ssh_port, username, connection_type, use_tunnel, tunnel_host, tunnel_port, tunnel_username, is_online, last_seen, created_at, updated_at`,
      [
        connectionId,
        fields.name,
        fields.ip_address,
        fields.api_port,
        fields.ssh_port,
        fields.username,
        fields.password_encrypted,
        fields.connection_type,
        fields.use_tunnel,
        fields.tunnel_host,
        fields.tunnel_port,
        fields.tunnel_username,
        fields.tunnel_password_encrypted,
      ],
    );
    connection = result.rows[0] || null;
  }

  if (!connection) {
    throw new Error("Failed to create MikroTik connection");
  }

  await updateRouterLink(router.id, connection.id, null);

  return {
    success: true,
    status: "linked",
    router: await getRouterById(router.id),
    connection,
  };
}

async function syncRouterSubscriptions(router, connection) {
  const subscriptions = await billing.listSubscriptions();
  const targets = subscriptions.filter(
    (subscription) =>
      subscription.router_id === router.id ||
      subscription.mikrotik_connection_id === connection.id,
  );

  const results = [];

  for (const subscription of targets) {
    const updated = await billing.updateSubscription(subscription.id, {
      router_id: router.id,
      mikrotik_connection_id: connection.id,
    });

    const expanded = {
      ...updated,
      customer:
        updated.customer ||
        (await billing.getCustomerById(updated.customer_id)),
      plan: updated.plan || (await billing.getPlanById(updated.plan_id)),
    };

    if (!expanded.auto_provision || !expanded.pppoe_username) {
      results.push({
        subscription_id: expanded.id,
        pppoe_username: expanded.pppoe_username || null,
        success: false,
        status: "skipped",
        message: "Subscription is not ready for MikroTik sync yet",
      });
      continue;
    }

    if (connection.connection_type !== "api") {
      results.push({
        subscription_id: expanded.id,
        pppoe_username: expanded.pppoe_username,
        success: false,
        status: "skipped",
        message:
          "Billing sync currently requires an API-backed MikroTik connection",
      });
      continue;
    }

    try {
      const syncResult =
        await mikrotikProvisioning.reconcileSubscription(expanded);
      await billing.updateSubscription(expanded.id, {
        last_synced_at: new Date().toISOString(),
        last_sync_status:
          syncResult.status || (syncResult.success ? "synced" : "failed"),
        last_sync_error: syncResult.success
          ? null
          : syncResult.error || syncResult.message || "Unknown sync error",
      });
      results.push({
        subscription_id: expanded.id,
        pppoe_username: expanded.pppoe_username,
        ...syncResult,
      });
    } catch (error) {
      await billing.updateSubscription(expanded.id, {
        last_synced_at: new Date().toISOString(),
        last_sync_status: "failed",
        last_sync_error: error.message,
      });
      results.push({
        subscription_id: expanded.id,
        pppoe_username: expanded.pppoe_username,
        success: false,
        status: "failed",
        message: error.message,
      });
    }
  }

  return results;
}

async function activateRouterInBilling(routerId, overrides = {}) {
  try {
    const currentRouter = await getRouterById(routerId);
    const linkResult = await ensureMikrotikConnection(routerId, overrides);
    if (!linkResult.success) {
      await updateRouterLink(
        routerId,
        currentRouter?.linked_mikrotik_connection_id || null,
        linkResult.error,
      );
      return linkResult;
    }

    const syncResults = await syncRouterSubscriptions(
      linkResult.router,
      linkResult.connection,
    );
    await updateRouterLink(routerId, linkResult.connection.id, null);

    return {
      success: true,
      status: "activated",
      router: await getRouterById(routerId),
      connection: linkResult.connection,
      subscriptions_synced: syncResults.length,
      sync_results: syncResults,
    };
  } catch (error) {
    const currentRouter = await getRouterById(routerId);
    await updateRouterLink(
      routerId,
      currentRouter?.linked_mikrotik_connection_id || null,
      error.message,
    );
    return {
      success: false,
      status: "failed",
      error: error.message,
    };
  }
}

module.exports = {
  getRouterById,
  encryptForMikrotik,
  ensureMikrotikConnection,
  activateRouterInBilling,
};
