/**
 * Database migrations for Zero-Touch Provisioning
 * Adds routers/devices table with provisioning tokens and audit logging
 */

const provisioningMigrations = [
  // Routers/Devices table
  `CREATE TABLE IF NOT EXISTS routers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    identity VARCHAR(255),
    model VARCHAR(100),
    mac_address VARCHAR(17),
    ip_address VARCHAR(45),
    wan_interface VARCHAR(50) DEFAULT 'ether1',
    lan_interface VARCHAR(50) DEFAULT 'bridge1',
    lan_ports TEXT[] DEFAULT ARRAY['ether2', 'ether3', 'ether4', 'ether5'],

    -- Provisioning
    provision_token VARCHAR(128) UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    provision_status VARCHAR(20) DEFAULT 'pending',
    last_provisioned_at TIMESTAMP,
    provision_attempts INTEGER DEFAULT 0,

    -- Router settings
    dns_servers TEXT[],
    ntp_servers TEXT[],
    radius_server VARCHAR(45),
    radius_secret VARCHAR(255),
    radius_port INTEGER DEFAULT 1812,
    hotspot_enabled BOOLEAN DEFAULT false,
    pppoe_enabled BOOLEAN DEFAULT false,
    pppoe_interface VARCHAR(50),
    pppoe_service_name VARCHAR(100),
    mgmt_port INTEGER DEFAULT 8728,

    -- Metadata
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Provisioning audit logs
  `CREATE TABLE IF NOT EXISTS provision_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token VARCHAR(128) NOT NULL,
    router_id UUID REFERENCES routers(id) ON DELETE SET NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    action VARCHAR(50),
    status VARCHAR(20),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Provisioning events (script generation history)
  `CREATE TABLE IF NOT EXISTS provision_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    router_id UUID REFERENCES routers(id) ON DELETE CASCADE,
    event_type VARCHAR(50),
    script_content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_routers_project_id ON routers(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_routers_token ON routers(provision_token)`,
  `CREATE INDEX IF NOT EXISTS idx_routers_status ON routers(provision_status)`,
  `ALTER TABLE routers ADD COLUMN IF NOT EXISTS lan_ports TEXT[] DEFAULT ARRAY['ether2', 'ether3', 'ether4', 'ether5']`,
  `ALTER TABLE routers ADD COLUMN IF NOT EXISTS mgmt_username VARCHAR(100)`,
  `ALTER TABLE routers ADD COLUMN IF NOT EXISTS mgmt_password_encrypted TEXT`,
  `ALTER TABLE routers ADD COLUMN IF NOT EXISTS connection_type VARCHAR(10) DEFAULT 'api'`,
  `ALTER TABLE routers ADD COLUMN IF NOT EXISTS linked_mikrotik_connection_id UUID REFERENCES mikrotik_connections(id) ON DELETE SET NULL`,
  `ALTER TABLE routers ADD COLUMN IF NOT EXISTS billing_activated_at TIMESTAMP`,
  `ALTER TABLE routers ADD COLUMN IF NOT EXISTS billing_activation_error TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_routers_linked_mikrotik_connection ON routers(linked_mikrotik_connection_id)`,
  `CREATE INDEX IF NOT EXISTS idx_provision_logs_token ON provision_logs(token)`,
  `CREATE INDEX IF NOT EXISTS idx_provision_logs_router ON provision_logs(router_id)`,
  `CREATE INDEX IF NOT EXISTS idx_provision_events_router ON provision_events(router_id)`,
];

module.exports = provisioningMigrations;
