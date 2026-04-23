/**
 * Settings API Routes
 * Stores application-wide settings
 */

const express = require('express');
const router = express.Router();

// In-memory settings store (in production, use database)
const settingsStore = {
  company_name: '',
  company_logo: '',
  contact_email: '',
  contact_phone: '',
  address: '',
  city: '',
  country: '',
  timezone: 'Africa/Nairobi',
  currency: 'KES',
  currency_symbol: 'KES',
  date_format: 'DD/MM/YYYY',
  invoice_prefix: 'INV-',
  invoice_start_number: '1001',
  payment_terms: '14',
  tax_rate: '16',
};

// WireGuard settings store
const wireguardStore = {
  enabled: false,
  server_port: '51820',
  server_private_key: '',
  server_public_key: '',
  server_address: '10.0.0.1',
  server_dns: '1.1.1.1',
  peers: [],
};

// Default permissions (can be overridden via API)
const permissionsStore = {
  admin: ['*'],
  staff: ['billing:read', 'billing:write', 'customers:read', 'customers:write', 'reports:read'],
  technician: ['network:read', 'network:write', 'monitoring:read', 'devices:read', 'devices:write'],
  reseller: ['customers:read', 'customers:write', 'billing:read', 'invoices:write'],
  customer: ['own:read', 'billing:read', 'tickets:write'],
};

// Feature access by role
const featureAccessStore = {
  admin: [
    'dashboard', 'topology', 'router-linking', 'devices', 'templates', 'mikrotik-api', 'integrations', 'settings',
    'billing', 'customers', 'plans', 'subscriptions', 'invoices', 'payments', 'wallet', 'sms', 'whatsapp',
    'network-map', 'monitoring', 'agents', 'auto-suspend', 'reports', 'analytics', 'pppoe', 'hotspot',
    'vouchers', 'network-services', 'olt', 'radius', 'tickets', 'captive-portal', 'bandwidth', 'resellers',
    'backups', 'inventory', 'users',
  ],
  staff: [
    'dashboard', 'topology', 'router-linking',
    'billing', 'customers', 'plans', 'subscriptions', 'invoices', 'payments', 'wallet', 'sms', 'whatsapp',
    'network-map', 'monitoring', 'reports', 'analytics', 'pppoe', 'hotspot', 'vouchers', 'tickets',
  ],
  technician: [
    'dashboard', 'devices', 'templates',
    'monitoring', 'bandwidth',
  ],
  reseller: [
    'dashboard',
    'billing', 'customers', 'plans', 'subscriptions', 'invoices', 'payments', 'wallet',
  ],
  customer: [],
};

// Payment gateway settings
const paymentGatewayStore = {
  mpesa: {
    enabled: false,
    consumer_key: '',
    consumer_secret: '',
    passkey: '',
    shortcode: '',
    environment: 'sandbox', // sandbox or production
  },
  stripe: {
    enabled: false,
    publishable_key: '',
    secret_key: '',
    webhook_secret: '',
  },
  paypal: {
    enabled: false,
    client_id: '',
    client_secret: '',
    mode: 'sandbox', // sandbox or live
  },
};

// Bank paybill settings - Kenyan banks
const bankPaybillStore = {
  enabled: false,
  banks: [
    {
      name: 'Equity Bank',
      paybill: '247247',
      account_number: '',
      enabled: true,
    },
    {
      name: 'KCB Bank',
      paybill: '522522',
      account_number: '',
      enabled: true,
    },
    {
      name: 'Co-operative Bank',
      paybill: '400200',
      account_number: '',
      enabled: true,
    },
    {
      name: 'Standard Chartered',
      paybill: '320320',
      account_number: '',
      enabled: false,
    },
    {
      name: 'Absa Bank',
      paybill: '303030',
      account_number: '',
      enabled: false,
    },
    {
      name: 'NCBA Bank',
      paybill: '880200',
      account_number: '',
      enabled: false,
    },
    {
      name: 'Diamond Trust Bank',
      paybill: '444444',
      account_number: '',
      enabled: false,
    },
    {
      name: 'I&M Bank',
      paybill: '545500',
      account_number: '',
      enabled: false,
    },
  ],
};

// Get settings
router.get('/', (req, res) => {
  res.json(settingsStore);
});

// Update settings
router.put('/', (req, res) => {
  Object.assign(settingsStore, req.body);
  res.json(settingsStore);
});

// Get permissions
router.get('/permissions', (req, res) => {
  res.json(featureAccessStore);
});

// Update permissions
router.put('/permissions', (req, res) => {
  Object.assign(featureAccessStore, req.body);
  res.json(featureAccessStore);
});

// Get payment gateway settings
router.get('/payment-gateways', (req, res) => {
  res.json(paymentGatewayStore);
});

// Update payment gateway settings
router.put('/payment-gateways', (req, res) => {
  Object.assign(paymentGatewayStore, req.body);
  res.json(paymentGatewayStore);
});

// Get bank paybill settings
router.get('/bank-paybills', (req, res) => {
  res.json(bankPaybillStore);
});

// Update bank paybill settings
router.put('/bank-paybills', (req, res) => {
  Object.assign(bankPaybillStore, req.body);
  res.json(bankPaybillStore);
});

// Get WireGuard settings
router.get('/wireguard', (req, res) => {
  res.json(wireguardStore);
});

// Update WireGuard settings
router.put('/wireguard', (req, res) => {
  Object.assign(wireguardStore, req.body);
  res.json(wireguardStore);
});

// Add WireGuard peer
router.post('/wireguard/peers', (req, res) => {
  const { name, public_key, allowed_ips, preshared_key } = req.body;
  const peer = {
    id: Date.now().toString(),
    name,
    public_key,
    allowed_ips,
    preshared_key,
    enabled: true,
    created_at: new Date().toISOString(),
  };
  wireguardStore.peers.push(peer);
  res.json(peer);
});

// Update WireGuard peer
router.put('/wireguard/peers/:id', (req, res) => {
  const { id } = req.params;
  const peerIndex = wireguardStore.peers.findIndex(p => p.id === id);
  if (peerIndex === -1) {
    return res.status(404).json({ error: 'Peer not found' });
  }
  Object.assign(wireguardStore.peers[peerIndex], req.body);
  res.json(wireguardStore.peers[peerIndex]);
});

// Delete WireGuard peer
router.delete('/wireguard/peers/:id', (req, res) => {
  const { id } = req.params;
  wireguardStore.peers = wireguardStore.peers.filter(p => p.id !== id);
  res.json({ success: true });
});

// Generate WireGuard client config
router.post('/wireguard/config/:id', (req, res) => {
  const { id } = req.params;
  const peer = wireguardStore.peers.find(p => p.id === id);
  if (!peer) {
    return res.status(404).json({ error: 'Peer not found' });
  }

  const config = `[Interface]
PrivateKey = ${peer.private_key || 'YOUR_PRIVATE_KEY'}
Address = ${peer.allowed_ips}
DNS = ${wireguardStore.server_dns}

[Peer]
PublicKey = ${wireguardStore.server_public_key}
Endpoint = ${req.body.endpoint || 'YOUR_SERVER_IP:51820'}
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25`;

  res.json({ config });
});

// Export the stores for use in other modules
module.exports = router;
module.exports.paymentGatewayStore = paymentGatewayStore;
module.exports.bankPaybillStore = bankPaybillStore;
module.exports.settingsStore = settingsStore;
module.exports.wireguardStore = wireguardStore;
