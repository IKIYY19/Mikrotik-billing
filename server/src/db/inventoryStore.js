/**
 * Device Inventory Store
 * Tracks all network equipment: routers, switches, APs, ONTs, CPEs, antennas, cables, UPS, etc.
 */

const { v4: uuidv4 } = require('uuid');

const inventoryStore = {
  devices: [],
  categories: [],
  brands: [],
  locations: [],
  maintenanceLogs: [],
  assignments: [],
  alerts: [],
};

// ─── Seed Data ───
const seedInventory = () => {
  if (inventoryStore.devices.length > 0) return;

  // Categories
  inventoryStore.categories = [
    { id: 'cat-router', name: 'Router', icon: 'Router', color: '#3b82f6' },
    { id: 'cat-switch', name: 'Switch', icon: 'Network', color: '#8b5cf6' },
    { id: 'cat-ap', name: 'Access Point', icon: 'Wifi', color: '#10b981' },
    { id: 'cat-ont', name: 'ONT / Fiber Terminal', icon: 'Cable', color: '#f59e0b' },
    { id: 'cat-cpe', name: 'CPE / Client Device', icon: 'Monitor', color: '#6366f1' },
    { id: 'cat-antenna', name: 'Antenna / Sector', icon: 'Radio', color: '#ec4899' },
    { id: 'cat-server', name: 'Server', icon: 'Server', color: '#64748b' },
    { id: 'cat-ups', name: 'UPS / Power', icon: 'Battery', color: '#84cc16' },
    { id: 'cat-cable', name: 'Cable / Fiber', icon: 'Cable', color: '#a855f7' },
    { id: 'cat-rack', name: 'Rack / Enclosure', icon: 'Grid', color: '#f97316' },
    { id: 'cat-other', name: 'Other Equipment', icon: 'Package', color: '#71717a' },
  ];

  // Brands
  inventoryStore.brands = [
    'MikroTik', 'Ubiquiti', 'Huawei', 'ZTE', 'Cisco', 'TP-Link', 'D-Link',
    'Juniper', 'Aruba', 'Ruckus', 'Cambium', 'FiberHome', 'Nokia', 'APC',
    'Eaton', 'Generic', 'Other'
  ];

  // Locations
  inventoryStore.locations = [
    { id: 'loc-warehouse-main', name: 'Main Warehouse', type: 'warehouse', address: 'Nairobi HQ' },
    { id: 'loc-branch-nbi', name: 'Nairobi Branch Stock', type: 'branch', address: 'Moi Avenue' },
    { id: 'loc-branch-mba', name: 'Mombasa Branch Stock', type: 'branch', address: 'Moi Road' },
    { id: 'loc-rack-hq-01', name: 'HQ Rack A - U1-10', type: 'rack', address: 'Server Room' },
    { id: 'loc-rack-hq-02', name: 'HQ Rack B - U1-20', type: 'rack', address: 'Server Room' },
  ];

  // Sample Devices
  const devices = [
    // Routers
    {
      id: uuidv4(), name: 'CCR2004-Core-01', category_id: 'cat-router', brand: 'MikroTik',
      model: 'CCR2004-1G-12S+2XS', serial: 'HE0B0G5TABC12', mac: 'D4:01:6D:A1:B2:C3',
      firmware: '7.12.1', ip_address: '192.168.88.1', status: 'active',
      purchase_date: '2024-06-15', purchase_cost: 85000, warranty_expires: '2026-06-15',
      location_id: 'loc-rack-hq-01', assigned_to: null, notes: 'Core router - Nairobi POP',
      specs: { cpu: 'AL32400 4-core', ram: '1GB', storage: '128MB NAND', ports: '12xSFP+ 2xQSFP+' },
      maintenance_schedule: 'monthly', last_maintenance: '2026-03-01',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    },
    {
      id: uuidv4(), name: 'RB5009-Branch-01', category_id: 'cat-router', brand: 'MikroTik',
      model: 'RB5009UG+S+IN', serial: 'HE0B0G5TDEF34', mac: 'D4:01:6D:A4:E5:F6',
      firmware: '7.12.1', ip_address: '192.168.88.2', status: 'active',
      purchase_date: '2024-08-20', purchase_cost: 32000, warranty_expires: '2026-08-20',
      location_id: 'loc-branch-nbi', assigned_to: 'cust-001', notes: 'Branch office router',
      specs: { cpu: 'RTL8324 4-core', ram: '1GB', ports: '8xGE 1xSFP+ 1xUSB3' },
      maintenance_schedule: 'quarterly', last_maintenance: '2026-01-15',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    },
    {
      id: uuidv4(), name: 'hAP-ax2-Stock', category_id: 'cat-ap', brand: 'MikroTik',
      model: 'C52iG-5HaxD2HaxD-TC', serial: 'HE0B0G5TGHI56', mac: 'D4:01:6D:A7:G8:H9',
      firmware: '7.12.1', ip_address: '', status: 'in-stock',
      purchase_date: '2025-01-10', purchase_cost: 12000, warranty_expires: '2027-01-10',
      location_id: 'loc-warehouse-main', assigned_to: null, notes: '10 units in stock',
      specs: { cpu: 'IPQ-5010', ram: '256MB', ports: '5xGE', wireless: 'WiFi 6 dual-band' },
      maintenance_schedule: 'none', last_maintenance: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    },
    // Switches
    {
      id: uuidv4(), name: 'CRS326-Access-01', category_id: 'cat-switch', brand: 'MikroTik',
      model: 'CRS326-24G-2S+RM', serial: 'HE0B0G5TJKL78', mac: 'D4:01:6D:AA:BB:CC',
      firmware: '7.12.1', ip_address: '192.168.88.10', status: 'active',
      purchase_date: '2024-05-01', purchase_cost: 42000, warranty_expires: '2026-05-01',
      location_id: 'loc-rack-hq-01', assigned_to: null, notes: 'Access switch - 24 port',
      specs: { cpu: 'Marvell 98DX3236', ports: '24xGE 2xSFP+', poe: 'No' },
      maintenance_schedule: 'quarterly', last_maintenance: '2026-02-01',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    },
    // ONTs
    {
      id: uuidv4(), name: 'HG8245H-ONT-Batch', category_id: 'cat-ont', brand: 'Huawei',
      model: 'HG8245H', serial: '48575443A1B2C3D4', mac: '',
      firmware: 'V5R019C10S100', ip_address: '', status: 'in-stock',
      purchase_date: '2024-11-01', purchase_cost: 3500, warranty_expires: '2026-11-01',
      location_id: 'loc-warehouse-main', assigned_to: null, notes: '50 units in stock for FTTH deployment',
      specs: { ports: '4xFE 1xPOTS 1xWiFi GPON', wifi: '2.4GHz 802.11n', power: '12V 1A' },
      maintenance_schedule: 'none', last_maintenance: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    },
    // CPEs
    {
      id: uuidv4(), name: 'LHG-5-Stock', category_id: 'cat-cpe', brand: 'MikroTik',
      model: 'LHG 5 ac', serial: 'HE0B0G5TMNO90', mac: '',
      firmware: '7.12.1', ip_address: '', status: 'in-stock',
      purchase_date: '2025-02-01', purchase_cost: 8500, warranty_expires: '2027-02-01',
      location_id: 'loc-warehouse-main', assigned_to: null, notes: '30 units - WISP client devices',
      specs: { frequency: '5GHz', gain: '23dBi', throughput: '867Mbps' },
      maintenance_schedule: 'none', last_maintenance: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    },
    // Antennas
    {
      id: uuidv4(), name: 'Sector-90-NBI-Tower', category_id: 'cat-antenna', brand: 'Ubiquiti',
      model: 'airISO Prism 5GHz 90° 20dBi', serial: 'UBNT-AIS-90-001', mac: '',
      firmware: '', ip_address: '', status: 'active',
      purchase_date: '2024-03-15', purchase_cost: 45000, warranty_expires: '2026-03-15',
      location_id: null, assigned_to: null, notes: 'Mounted on Nairobi Tower - North sector',
      specs: { frequency: '5GHz', beamwidth: '90°', gain: '20dBi' },
      maintenance_schedule: 'semi-annual', last_maintenance: '2025-09-01',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    },
    // UPS
    {
      id: uuidv4(), name: 'APC-SmartUPS-3000', category_id: 'cat-ups', brand: 'APC',
      model: 'SMT3000RM2UC', serial: 'AS1234567890', mac: '',
      firmware: 'UPS 09.4 / ID 18', ip_address: '192.168.88.50', status: 'active',
      purchase_date: '2023-08-01', purchase_cost: 120000, warranty_expires: '2025-08-01',
      location_id: 'loc-rack-hq-01', assigned_to: null, notes: 'Battery replaced 2025-01',
      specs: { capacity: '3000VA/2700W', batteries: '4x 12V 9Ah', outlets: '8x C13 2x C19' },
      maintenance_schedule: 'monthly', last_maintenance: '2026-03-15',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    },
    // Servers
    {
      id: uuidv4(), name: 'RADIUS-Server-01', category_id: 'cat-server', brand: 'Dell',
      model: 'PowerEdge R540', serial: 'DL-ABC-12345', mac: 'AC:1F:6B:A1:B2:C3',
      firmware: 'iDRAC 4.40.40.40', ip_address: '10.0.0.100', status: 'active',
      purchase_date: '2023-01-15', purchase_cost: 350000, warranty_expires: '2026-01-15',
      location_id: 'loc-rack-hq-02', assigned_to: null, notes: 'FreeRADIUS + MySQL billing backend',
      specs: { cpu: 'Xeon Silver 4210R', ram: '64GB DDR4', storage: '4x 1.2TB SAS RAID10' },
      maintenance_schedule: 'monthly', last_maintenance: '2026-03-20',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    },
  ];

  inventoryStore.devices = devices;

  // Sample maintenance logs
  inventoryStore.maintenanceLogs = [
    { id: uuidv4(), device_id: devices[0].id, type: 'firmware_update', notes: 'Upgraded to RouterOS 7.12.1', performed_by: 'Admin', created_at: '2026-03-01T10:00:00Z' },
    { id: uuidv4(), device_id: devices[7].id, type: 'battery_replacement', notes: 'Replaced all 4 battery modules', performed_by: 'Tech Team', created_at: '2025-01-15T14:00:00Z' },
  ];

  // Sample alerts
  inventoryStore.alerts = [
    { id: uuidv4(), type: 'warranty_expiring', device_id: devices[7].id, message: 'APC UPS warranty expires in 4 months', severity: 'warning', acknowledged: false, created_at: new Date().toISOString() },
    { id: uuidv4(), type: 'low_stock', device_id: null, message: 'Low stock: hAP ax2 (10 units remaining)', severity: 'info', acknowledged: false, created_at: new Date().toISOString() },
  ];
};
seedInventory();

// ─── Device CRUD ───
function createDevice(data) {
  const device = {
    id: uuidv4(),
    name: data.name,
    category_id: data.category_id || 'cat-other',
    brand: data.brand || '',
    model: data.model || '',
    serial: data.serial || '',
    mac: data.mac || '',
    firmware: data.firmware || '',
    ip_address: data.ip_address || '',
    status: data.status || 'in-stock',
    purchase_date: data.purchase_date || new Date().toISOString().split('T')[0],
    purchase_cost: parseFloat(data.purchase_cost) || 0,
    warranty_expires: data.warranty_expires || null,
    location_id: data.location_id || null,
    assigned_to: data.assigned_to || null,
    assigned_customer: data.assigned_customer || null,
    notes: data.notes || '',
    specs: data.specs || {},
    maintenance_schedule: data.maintenance_schedule || 'none',
    last_maintenance: data.last_maintenance || null,
    tags: data.tags || [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  inventoryStore.devices.push(device);
  return device;
}

function updateDevice(id, data) {
  const idx = inventoryStore.devices.findIndex(d => d.id === id);
  if (idx === -1) return null;
  inventoryStore.devices[idx] = { ...inventoryStore.devices[idx], ...data, updated_at: new Date().toISOString() };
  return inventoryStore.devices[idx];
}

function deleteDevice(id) {
  const idx = inventoryStore.devices.findIndex(d => d.id === id);
  if (idx === -1) return null;
  return inventoryStore.devices.splice(idx, 1)[0];
}

function getDevice(id) {
  return inventoryStore.devices.find(d => d.id === id) || null;
}

// ─── Assign Device ───
function assignDevice(deviceId, customerName, customerId) {
  const device = inventoryStore.devices.find(d => d.id === deviceId);
  if (!device) return null;

  device.assigned_to = customerId || customerName;
  device.assigned_customer = customerName;
  device.status = 'deployed';
  device.updated_at = new Date().toISOString();

  inventoryStore.assignments.push({
    id: uuidv4(),
    device_id: deviceId,
    assigned_to: customerId || customerName,
    customer_name: customerName,
    assigned_at: new Date().toISOString(),
    notes: `Assigned to ${customerName}`,
  });

  return device;
}

function unassignDevice(deviceId) {
  const device = inventoryStore.devices.find(d => d.id === deviceId);
  if (!device) return null;

  device.assigned_to = null;
  device.assigned_customer = null;
  device.status = 'in-stock';
  device.updated_at = new Date().toISOString();

  return device;
}

// ─── Maintenance Logs ───
function addMaintenanceLog(deviceId, data) {
  const log = {
    id: uuidv4(),
    device_id: deviceId,
    type: data.type || 'general',
    notes: data.notes || '',
    performed_by: data.performed_by || 'Unknown',
    cost: parseFloat(data.cost) || 0,
    created_at: data.date || new Date().toISOString(),
  };
  inventoryStore.maintenanceLogs.unshift(log);

  // Update device last_maintenance
  const device = inventoryStore.devices.find(d => d.id === deviceId);
  if (device) {
    device.last_maintenance = log.created_at.split('T')[0];
    device.updated_at = new Date().toISOString();
  }

  return log;
}

// ─── Alerts ───
function generateAlerts() {
  inventoryStore.alerts = [];
  const now = new Date();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  for (const device of inventoryStore.devices) {
    // Warranty expiring soon
    if (device.warranty_expires) {
      const warrantyEnd = new Date(device.warranty_expires);
      const daysUntil = (warrantyEnd - now) / (24 * 60 * 60 * 1000);
      if (daysUntil > 0 && daysUntil < 90) {
        inventoryStore.alerts.push({
          id: uuidv4(),
          type: 'warranty_expiring',
          device_id: device.id,
          device_name: device.name,
          message: `${device.name} warranty expires in ${Math.round(daysUntil)} days (${device.warranty_expires})`,
          severity: daysUntil < 30 ? 'critical' : 'warning',
          acknowledged: false,
          created_at: now.toISOString(),
        });
      }
      if (daysUntil < 0) {
        inventoryStore.alerts.push({
          id: uuidv4(),
          type: 'warranty_expired',
          device_id: device.id,
          device_name: device.name,
          message: `${device.name} warranty expired on ${device.warranty_expires}`,
          severity: 'info',
          acknowledged: false,
          created_at: now.toISOString(),
        });
      }
    }

    // Maintenance overdue
    if (device.maintenance_schedule !== 'none' && device.last_maintenance) {
      const lastMaint = new Date(device.last_maintenance);
      const daysSince = (now - lastMaint) / (24 * 60 * 60 * 1000);
      const intervals = { monthly: 30, quarterly: 90, 'semi-annual': 180, annual: 365 };
      const interval = intervals[device.maintenance_schedule] || 365;
      if (daysSince > interval) {
        inventoryStore.alerts.push({
          id: uuidv4(),
          type: 'maintenance_overdue',
          device_id: device.id,
          device_name: device.name,
          message: `${device.name} maintenance overdue (${Math.round(daysSince - interval)} days past)`,
          severity: 'warning',
          acknowledged: false,
          created_at: now.toISOString(),
        });
      }
    }
  }

  // Low stock alerts
  const categoryCounts = {};
  for (const device of inventoryStore.devices) {
    if (device.status === 'in-stock') {
      const key = `${device.category_id}-${device.brand}-${device.model}`;
      categoryCounts[key] = (categoryCounts[key] || 0) + 1;
    }
  }
  for (const [key, count] of Object.entries(categoryCounts)) {
    if (count < 5) {
      const parts = key.split('-');
      const device = inventoryStore.devices.find(d => d.category_id === parts[0] && d.status === 'in-stock');
      inventoryStore.alerts.push({
        id: uuidv4(),
        type: 'low_stock',
        device_id: null,
        device_name: device?.name || 'Unknown',
        message: `Low stock: ${device?.brand || ''} ${device?.model || ''} (${count} remaining)`,
        severity: count < 3 ? 'critical' : 'info',
        acknowledged: false,
        created_at: now.toISOString(),
      });
    }
  }

  return inventoryStore.alerts;
}

// ─── Stats ───
function getStats() {
  const devices = inventoryStore.devices;
  const statusCounts = {};
  const categoryCounts = {};
  const brandCounts = {};
  let totalValue = 0;
  let depreciatedValue = 0;

  for (const d of devices) {
    statusCounts[d.status] = (statusCounts[d.status] || 0) + 1;
    categoryCounts[d.category_id] = (categoryCounts[d.category_id] || 0) + 1;
    brandCounts[d.brand] = (brandCounts[d.brand] || 0) + 1;
    totalValue += d.purchase_cost || 0;

    // Simple straight-line depreciation over 5 years
    const age = (Date.now() - new Date(d.purchase_date).getTime()) / (365 * 24 * 60 * 60 * 1000);
    depreciatedValue += Math.max(0, (d.purchase_cost || 0) * (1 - age / 5));
  }

  return {
    total_devices: devices.length,
    total_value: totalValue,
    depreciated_value: depreciatedValue,
    by_status: statusCounts,
    by_category: categoryCounts,
    by_brand: brandCounts,
    active_count: statusCounts['active'] || 0,
    in_stock_count: statusCounts['in-stock'] || 0,
    deployed_count: statusCounts['deployed'] || 0,
    in_repair_count: statusCounts['in-repair'] || 0,
    retired_count: statusCounts['retired'] || 0,
  };
}

module.exports = {
  inventoryStore,
  createDevice,
  updateDevice,
  deleteDevice,
  getDevice,
  assignDevice,
  unassignDevice,
  addMaintenanceLog,
  generateAlerts,
  getStats,
};
