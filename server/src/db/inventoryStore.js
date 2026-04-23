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

  // No sample devices - start empty
  inventoryStore.devices = [];
  inventoryStore.maintenanceLogs = [];
  inventoryStore.alerts = [];
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
