const MikroNode = require('mikronode');

const db = global.db || require('../db/memory');

function getDb() {
  return global.db || db;
}

function getEncryptionConfig() {
  return {
    algorithm: 'aes-256-gcm',
    key: Buffer.from((process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32').slice(0, 32)),
  };
}

function decryptPassword(passwordEncrypted) {
  if (!passwordEncrypted) {
    throw new Error('Router password is missing');
  }

  const { algorithm, key } = getEncryptionConfig();
  const [ivHex, authTagHex, encrypted] = passwordEncrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = require('crypto').createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function getConnectionById(connectionId) {
  if (!connectionId) return null;

  const result = await getDb().query('SELECT * FROM mikrotik_connections WHERE id = $1', [connectionId]);
  if (result.rows.length === 0) {
    return null;
  }

  const connection = result.rows[0];
  return {
    ...connection,
    password: decryptPassword(connection.password_encrypted),
  };
}

async function withConnection(connectionId, handler) {
  const connection = await getConnectionById(connectionId);
  if (!connection) {
    throw new Error('MikroTik connection not found');
  }

  const client = new MikroNode(connection.ip_address, { port: connection.api_port || 8728 });
  const session = await client.connect(connection.username, connection.password);
  const close = session.closeOnDone(true);

  try {
    return await handler(session, connection);
  } finally {
    close();
  }
}

async function execute(connectionId, command, args = {}) {
  return withConnection(connectionId, async (session) => {
    const channel = session.openChannel();
    channel.write(command, args);
    return channel.done;
  });
}

async function print(connectionId, path, properties = null) {
  const args = properties ? { '.proplist': properties } : {};
  const result = await execute(connectionId, `${path}/print`, args);
  return Array.isArray(result) ? result : [];
}

function buildRateLimit(plan) {
  if (!plan?.speed_down || !plan?.speed_up) {
    return '';
  }

  return `${plan.speed_down}/${plan.speed_up}`;
}

function buildComment(subscription) {
  const customerName = subscription.customer?.name || 'Unknown';
  const planName = subscription.plan?.name || 'N/A';
  return `Customer: ${customerName} | Plan: ${planName} | Billing Sync`;
}

async function findSecret(connectionId, username) {
  const secrets = await print(connectionId, '/ppp/secret', '.id,name,disabled,profile,service,comment');
  return secrets.find((secret) => secret.name === username) || null;
}

async function upsertSubscriptionSecret(subscription) {
  if (!subscription.mikrotik_connection_id) {
    return { success: false, status: 'skipped', error: 'No MikroTik connection linked to subscription' };
  }
  if (!subscription.pppoe_username) {
    return { success: false, status: 'skipped', error: 'PPPoE username is required to provision the subscription' };
  }

  const existing = await findSecret(subscription.mikrotik_connection_id, subscription.pppoe_username);
  const args = {
    name: subscription.pppoe_username,
    password: subscription.pppoe_password || subscription.pppoe_username,
    service: 'pppoe',
    disabled: subscription.status === 'active' ? 'no' : 'yes',
    comment: buildComment(subscription),
  };

  if (subscription.pppoe_profile) {
    args.profile = subscription.pppoe_profile;
  }

  const rateLimit = buildRateLimit(subscription.plan);
  if (rateLimit) {
    args['rate-limit'] = rateLimit;
  }

  if (existing) {
    await execute(subscription.mikrotik_connection_id, '/ppp/secret/set', {
      numbers: existing['.id'] || existing.name,
      ...args,
    });
  } else {
    await execute(subscription.mikrotik_connection_id, '/ppp/secret/add', args);
  }

  if (subscription.status !== 'active') {
    await disconnectActiveSession(subscription.mikrotik_connection_id, subscription.pppoe_username);
  }

  return {
    success: true,
    status: 'synced',
    action: existing ? 'updated' : 'created',
    message: existing ? 'PPPoE secret updated on MikroTik' : 'PPPoE secret created on MikroTik',
  };
}

async function disconnectActiveSession(connectionId, username) {
  const activeSessions = await print(connectionId, '/ppp/active', '.id,name');
  const activeSession = activeSessions.find((session) => session.name === username);
  if (!activeSession) {
    return false;
  }

  await execute(connectionId, '/ppp/active/remove', {
    numbers: activeSession['.id'] || activeSession.name,
  });
  return true;
}

async function suspendSubscriptionSecret(subscription) {
  if (!subscription.mikrotik_connection_id || !subscription.pppoe_username) {
    return { success: false, status: 'skipped', error: 'Subscription is missing a linked MikroTik connection or PPPoE username' };
  }

  const existing = await findSecret(subscription.mikrotik_connection_id, subscription.pppoe_username);
  if (!existing) {
    return { success: false, status: 'not_found', error: 'PPPoE secret was not found on MikroTik' };
  }

  await execute(subscription.mikrotik_connection_id, '/ppp/secret/set', {
    numbers: existing['.id'] || existing.name,
    disabled: 'yes',
  });
  await disconnectActiveSession(subscription.mikrotik_connection_id, subscription.pppoe_username);

  return {
    success: true,
    status: 'synced',
    action: 'suspended',
    message: 'PPPoE secret suspended on MikroTik',
  };
}

async function deleteSubscriptionSecret(subscription) {
  if (!subscription.mikrotik_connection_id || !subscription.pppoe_username) {
    return { success: false, status: 'skipped', error: 'Subscription is missing a linked MikroTik connection or PPPoE username' };
  }

  const existing = await findSecret(subscription.mikrotik_connection_id, subscription.pppoe_username);
  if (!existing) {
    return { success: true, status: 'synced', action: 'not_found', message: 'PPPoE secret already absent on MikroTik' };
  }

  await disconnectActiveSession(subscription.mikrotik_connection_id, subscription.pppoe_username);
  await execute(subscription.mikrotik_connection_id, '/ppp/secret/remove', {
    numbers: existing['.id'] || existing.name,
  });

  return {
    success: true,
    status: 'synced',
    action: 'deleted',
    message: 'PPPoE secret removed from MikroTik',
  };
}

async function reconcileSubscription(subscription) {
  if (subscription.status === 'active') {
    return upsertSubscriptionSecret(subscription);
  }

  return suspendSubscriptionSecret(subscription);
}

module.exports = {
  getConnectionById,
  print,
  execute,
  findSecret,
  buildRateLimit,
  upsertSubscriptionSecret,
  suspendSubscriptionSecret,
  deleteSubscriptionSecret,
  reconcileSubscription,
};
