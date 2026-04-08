/**
 * Inventory API Routes
 */

const express = require('express');
const router = express.Router();
const inv = require('../db/inventoryStore');

// ─── Stats ───
router.get('/stats', (req, res) => {
  const stats = inv.getStats();
  const alerts = inv.generateAlerts();
  res.json({ ...stats, alerts: alerts.slice(0, 20) });
});

// ─── Categories ───
router.get('/categories', (req, res) => res.json(inv.inventoryStore.categories));

// ─── Brands ───
router.get('/brands', (req, res) => res.json(inv.inventoryStore.brands));

// ─── Locations ───
router.get('/locations', (req, res) => res.json(inv.inventoryStore.locations));
router.post('/locations', (req, res) => {
  const loc = { id: `loc-${Date.now()}`, ...req.body };
  inv.inventoryStore.locations.push(loc);
  res.status(201).json(loc);
});

// ─── Devices ───
router.get('/devices', (req, res) => {
  const { status, category_id, brand, location_id, search } = req.query;
  let devices = [...inv.inventoryStore.devices];

  if (status) devices = devices.filter(d => d.status === status);
  if (category_id) devices = devices.filter(d => d.category_id === category_id);
  if (brand) devices = devices.filter(d => d.brand === brand);
  if (location_id) devices = devices.filter(d => d.location_id === location_id);
  if (search) {
    const s = search.toLowerCase();
    devices = devices.filter(d =>
      d.name.toLowerCase().includes(s) ||
      d.model.toLowerCase().includes(s) ||
      d.serial.toLowerCase().includes(s) ||
      d.mac.toLowerCase().includes(s) ||
      d.brand.toLowerCase().includes(s) ||
      d.ip_address.toLowerCase().includes(s)
    );
  }

  // Enrich with category name
  devices = devices.map(d => {
    const cat = inv.inventoryStore.categories.find(c => c.id === d.category_id);
    return { ...d, category_name: cat?.name || 'Unknown', category_icon: cat?.icon || 'Package', category_color: cat?.color || '#71717a' };
  });

  res.json(devices);
});

router.get('/devices/:id', (req, res) => {
  const device = inv.getDevice(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const cat = inv.inventoryStore.categories.find(c => c.id === device.category_id);
  const location = inv.inventoryStore.locations.find(l => l.id === device.location_id);
  const maintenanceLogs = inv.inventoryStore.maintenanceLogs.filter(l => l.device_id === device.id);
  const assignmentHistory = inv.inventoryStore.assignments.filter(a => a.device_id === device.id);

  res.json({
    ...device,
    category_name: cat?.name || 'Unknown',
    category_icon: cat?.icon || 'Package',
    category_color: cat?.color || '#71717a',
    location_name: location?.name || null,
    maintenance_logs: maintenanceLogs,
    assignment_history: assignmentHistory,
  });
});

router.post('/devices', (req, res) => {
  const device = inv.createDevice(req.body);
  res.status(201).json(device);
});

router.put('/devices/:id', (req, res) => {
  const device = inv.updateDevice(req.params.id, req.body);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  res.json(device);
});

router.delete('/devices/:id', (req, res) => {
  const device = inv.deleteDevice(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  res.json({ message: 'Device deleted' });
});

// ─── Assignment ───
router.post('/devices/:id/assign', (req, res) => {
  const { customer_name, customer_id } = req.body;
  const device = inv.assignDevice(req.params.id, customer_name, customer_id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  res.json(device);
});

router.post('/devices/:id/unassign', (req, res) => {
  const device = inv.unassignDevice(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  res.json(device);
});

// ─── Maintenance ───
router.get('/devices/:id/maintenance', (req, res) => {
  const logs = inv.inventoryStore.maintenanceLogs.filter(l => l.device_id === req.params.id);
  res.json(logs);
});

router.post('/devices/:id/maintenance', (req, res) => {
  const log = inv.addMaintenanceLog(req.params.id, req.body);
  res.status(201).json(log);
});

// ─── Alerts ───
router.get('/alerts', (req, res) => {
  const alerts = inv.generateAlerts();
  res.json(alerts);
});

router.post('/alerts/:id/acknowledge', (req, res) => {
  const alert = inv.inventoryStore.alerts.find(a => a.id === req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  alert.acknowledged = true;
  res.json(alert);
});

// ─── Import/Export ───
router.post('/import', (req, res) => {
  const { devices } = req.body;
  if (!Array.isArray(devices)) return res.status(400).json({ error: 'devices array required' });

  const created = [];
  for (const d of devices) {
    created.push(inv.createDevice(d));
  }
  res.status(201).json({ imported: created.length, devices: created });
});

router.get('/export', (req, res) => {
  const { status } = req.query;
  let devices = [...inv.inventoryStore.devices];
  if (status) devices = devices.filter(d => d.status === status);

  // Convert to CSV
  const headers = ['Name', 'Category', 'Brand', 'Model', 'Serial', 'MAC', 'Firmware', 'IP', 'Status', 'Purchase Date', 'Cost', 'Warranty', 'Location', 'Assigned To', 'Notes'];
  const rows = devices.map(d => {
    const cat = inv.inventoryStore.categories.find(c => c.id === d.category_id);
    const loc = inv.inventoryStore.locations.find(l => l.id === d.location_id);
    return [
      d.name, cat?.name || '', d.brand, d.model, d.serial, d.mac, d.firmware,
      d.ip_address, d.status, d.purchase_date, d.purchase_cost, d.warranty_expires || '',
      loc?.name || '', d.assigned_customer || '', d.notes || ''
    ];
  });

  let csv = headers.join(',') + '\n';
  rows.forEach(row => {
    csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="inventory-${new Date().toISOString().split('T')[0]}.csv"`);
  res.send(csv);
});

// ─── Bulk Actions ───
router.post('/bulk/status', (req, res) => {
  const { device_ids, status } = req.body;
  if (!Array.isArray(device_ids) || !status) return res.status(400).json({ error: 'device_ids and status required' });

  const updated = [];
  for (const id of device_ids) {
    const device = inv.updateDevice(id, { status });
    if (device) updated.push(device);
  }
  res.json({ updated: updated.length, devices: updated });
});

router.post('/bulk/location', (req, res) => {
  const { device_ids, location_id } = req.body;
  if (!Array.isArray(device_ids)) return res.status(400).json({ error: 'device_ids required' });

  const updated = [];
  for (const id of device_ids) {
    const device = inv.updateDevice(id, { location_id });
    if (device) updated.push(device);
  }
  res.json({ updated: updated.length, devices: updated });
});

module.exports = router;
