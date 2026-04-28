const { v4: uuidv4 } = require('uuid');

/**
 * In-memory storage fallback when PostgreSQL is not available
 * Simulates database operations with plain JavaScript objects
 */

const store = {
  projects: [],
  project_modules: [],
  templates: [],
  mikrotik_connections: [],
  script_history: [],
  version_history: [],
  routers: [],
  provision_logs: [],
  provision_events: [],
  users: [],
  resellers: [],
  customers: [],
  payments: [],
  olt_connections: [],
  integrations: [],
  hotspot_vouchers: [],
  fup_profiles: [],
  tr069_devices: [],
};

// Seed example templates
const seedTemplates = () => {
  store.templates = [
    {
      id: uuidv4(),
      name: 'Basic VLAN Setup',
      description: 'Creates VLAN interfaces with IP addresses',
      category: 'interfaces',
      content: {
        vlans: [
          { name: 'vlan10', 'vlan-id': '10', interface: 'ether1', comment: 'Management' },
          { name: 'vlan20', 'vlan-id': '20', interface: 'ether1', comment: 'Users' },
        ],
      },
      is_public: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      name: 'Basic Firewall',
      description: 'Standard firewall rules with NAT and FastTrack',
      category: 'firewall',
      content: {
        filter_rules: [
          { chain: 'input', action: 'accept', connection_state: 'established,related,untracked', comment: 'Allow established' },
          { chain: 'input', action: 'drop', comment: 'Drop everything else' },
        ],
        nat_rules: [
          { chain: 'srcnat', action: 'masquerade', out_interface: 'ether1', comment: 'Masquerade' },
        ],
      },
      is_public: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      name: 'PPPoE Server',
      description: 'Complete PPPoE server setup with profiles and secrets',
      category: 'isp',
      content: {
        pppoe_server: {
          'service-name': 'ISP-PPPoE',
          interface: 'ether2',
          'max-mtu': '1492',
          'max-mru': '1492',
        },
        ppp_profiles: [
          { name: 'default', 'local-address': '10.0.0.1', 'remote-address': 'pppoe-pool', 'rate-limit': '10M/10M', 'change-tcp-mss': 'yes' },
        ],
      },
      is_public: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      name: 'WireGuard VPN',
      description: 'WireGuard server and peer configuration',
      category: 'vpn',
      content: {
        wireguard: {
          interface: { name: 'wg1', 'listen-port': '13231', mtu: '1420' },
          peers: [
            { interface: 'wg1', 'public-key': '(client-public-key)', 'allowed-address': '10.200.0.2/32', comment: 'Client 1' },
          ],
        },
      },
      is_public: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      name: 'OSPF Single Area',
      description: 'Basic OSPF configuration with single area',
      category: 'routing',
      content: {
        ospf: {
          'router-id': '1.1.1.1',
          networks: [
            { network: '192.168.1.0/24', area: 'backbone', comment: 'LAN' },
          ],
        },
      },
      is_public: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
};

seedTemplates();

// Seed integrations
const seedIntegrations = () => {
  store.integrations = [
    {
      id: uuidv4(),
      service_name: 'africas_talking',
      display_name: "Africa's Talking",
      category: 'sms',
      config_data: { username: 'sandbox', api_key: '', sender_id: 'MyISP' },
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      service_name: 'mpesa',
      display_name: 'M-Pesa',
      category: 'payment',
      config_data: { consumer_key: '', consumer_secret: '', shortcode: '174379', passkey: '', environment: 'sandbox' },
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      service_name: 'whatsapp',
      display_name: 'WhatsApp Business',
      category: 'messaging',
      config_data: { access_token: '', phone_number_id: '', verify_token: '' },
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      service_name: 'sendgrid',
      display_name: 'SendGrid',
      category: 'email',
      config_data: { api_key: '', from_email: '', from_name: '' },
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      service_name: 'twilio',
      display_name: 'Twilio SMS',
      category: 'sms',
      config_data: { account_sid: '', auth_token: '', phone_number: '' },
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      service_name: 'stripe',
      display_name: 'Stripe',
      category: 'payment',
      config_data: { secret_key: '', publishable_key: '', webhook_secret: '', currency: 'usd' },
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      service_name: 'paypal',
      display_name: 'PayPal',
      category: 'payment',
      config_data: { client_id: '', client_secret: '', environment: 'sandbox', webhook_id: '' },
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      service_name: 'flutterwave',
      display_name: 'Flutterwave',
      category: 'payment',
      config_data: { secret_key: '', public_key: '', encryption_key: '', environment: 'sandbox' },
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      service_name: 'slack',
      display_name: 'Slack Notifications',
      category: 'monitoring',
      config_data: { webhook_url: '', channel: '#alerts' },
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      service_name: 'discord',
      display_name: 'Discord Webhook',
      category: 'monitoring',
      config_data: { webhook_url: '' },
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
};

seedIntegrations();

module.exports = {
  query: async (text, params) => {
    const lowerText = text.toLowerCase();

    // SELECT projects
    if (lowerText.includes('select') && lowerText.includes('from projects')) {
      if (lowerText.includes('where id =')) {
        const project = store.projects.find(p => p.id === params[0]);
        return { rows: project ? [project] : [] };
      }
      return { rows: store.projects.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)) };
    }

    // INSERT projects
    if (lowerText.includes('insert into projects')) {
      const project = {
        id: params[0],
        name: params[1],
        description: params[2],
        routeros_version: params[3],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.projects.push(project);
      return { rows: [project] };
    }

    // UPDATE projects
    if (lowerText.includes('update projects')) {
      const idx = store.projects.findIndex(p => p.id === params[4]);
      if (idx === -1) return { rows: [] };
      const project = {
        ...store.projects[idx],
        name: params[0] || store.projects[idx].name,
        description: params[1] !== null ? params[1] : store.projects[idx].description,
        routeros_version: params[2] || store.projects[idx].routeros_version,
        updated_at: new Date().toISOString(),
      };
      store.projects[idx] = project;
      return { rows: [project] };
    }

    // DELETE projects
    if (lowerText.includes('delete from projects')) {
      const idx = store.projects.findIndex(p => p.id === params[0]);
      if (idx === -1) return { rows: [] };
      const deleted = store.projects.splice(idx, 1)[0];
      // Also delete associated modules
      store.project_modules = store.project_modules.filter(m => m.project_id !== params[0]);
      return { rows: [deleted] };
    }

    // SELECT routers
    if (lowerText.includes('select') && lowerText.includes('from routers')) {
      if (lowerText.includes('where provision_token =')) {
        const router = store.routers.find(r => r.provision_token === params[0]);
        return { rows: router ? [router] : [] };
      }
      if (lowerText.includes('where id =')) {
        const router = store.routers.find(r => r.id === params[0]);
        return { rows: router ? [router] : [] };
      }
      if (lowerText.includes('where project_id =')) {
        const routers = store.routers.filter(r => r.project_id === params[0]);
        return { rows: routers };
      }
      return { rows: store.routers };
    }

    // INSERT routers
    if (lowerText.includes('insert into routers')) {
      const router = {
        id: params[0],
        project_id: params[1],
        name: params[2],
        identity: params[3],
        model: params[4],
        mac_address: params[5],
        ip_address: params[6],
        wan_interface: params[7],
        lan_interface: params[8],
        lan_ports: params[9],
        provision_token: params[10],
        provision_status: params[11],
        dns_servers: params[12],
        ntp_servers: params[13],
        radius_server: params[14],
        radius_secret: params[15],
        radius_port: params[16],
        hotspot_enabled: params[17],
        pppoe_enabled: params[18],
        pppoe_interface: params[19],
        pppoe_service_name: params[20],
        mgmt_port: params[21],
        mgmt_username: params[22],
        mgmt_password_encrypted: params[23],
        connection_type: params[24],
        notes: params[25],
        linked_mikrotik_connection_id: null,
        billing_activated_at: null,
        billing_activation_error: null,
        provision_attempts: 0,
        last_provisioned_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.routers.push(router);
      return { rows: [router] };
    }

    // UPDATE routers
    if (lowerText.includes('update routers') && lowerText.includes('set')) {
      const idx = store.routers.findIndex(r => r.id === params[params.length - 1]);
      if (idx === -1) return { rows: [] };
      const router = { ...store.routers[idx], updated_at: new Date().toISOString() };
      // Handle various SET patterns
      if (lowerText.includes('name =')) router.name = params[0];
      if (lowerText.includes('identity =')) router.identity = params[1];
      if (lowerText.includes('model =')) router.model = params[2];
      if (lowerText.includes('mac_address =')) router.mac_address = params[3];
      if (lowerText.includes('ip_address =')) router.ip_address = params[4];
      if (lowerText.includes('wan_interface =')) router.wan_interface = params[5];
      if (lowerText.includes('lan_interface =')) router.lan_interface = params[6];
      if (lowerText.includes('lan_ports =')) router.lan_ports = params[7];
      if (lowerText.includes('dns_servers =')) router.dns_servers = params[8];
      if (lowerText.includes('ntp_servers =')) router.ntp_servers = params[9];
      if (lowerText.includes('radius_server =')) router.radius_server = params[10];
      if (lowerText.includes('radius_secret =')) router.radius_secret = params[11];
      if (lowerText.includes('radius_port =')) router.radius_port = params[12];
      if (lowerText.includes('hotspot_enabled =')) router.hotspot_enabled = params[13];
      if (lowerText.includes('pppoe_enabled =')) router.pppoe_enabled = params[14];
      if (lowerText.includes('pppoe_interface =')) router.pppoe_interface = params[15];
      if (lowerText.includes('pppoe_service_name =')) router.pppoe_service_name = params[16];
      if (lowerText.includes('mgmt_port =')) router.mgmt_port = params[17];
      if (lowerText.includes('mgmt_username =')) router.mgmt_username = params[18];
      if (lowerText.includes('mgmt_password_encrypted =')) router.mgmt_password_encrypted = params[19];
      if (lowerText.includes('connection_type =')) router.connection_type = params[20];
      if (lowerText.includes('notes =')) router.notes = params[21];
      if (lowerText.includes('provision_token =')) router.provision_token = params[0];
      if (lowerText.includes('provision_status =')) router.provision_status = params[0];
      if (lowerText.includes('linked_mikrotik_connection_id =')) router.linked_mikrotik_connection_id = params[0];
      if (lowerText.includes('billing_activated_at = case when')) router.billing_activated_at = params[0] ? new Date().toISOString() : router.billing_activated_at;
      if (lowerText.includes('billing_activation_error =')) router.billing_activation_error = params[1];
      if (lowerText.includes('last_provisioned_at = current_timestamp')) router.last_provisioned_at = new Date().toISOString();
      if (lowerText.includes('provision_attempts = coalesce(provision_attempts, 0) + 1')) router.provision_attempts = (router.provision_attempts || 0) + 1;
      if (lowerText.includes('last_provisioned_at =') && !lowerText.includes('current_timestamp')) router.last_provisioned_at = params[0];
      store.routers[idx] = router;
      return { rows: [router] };
    }

    // DELETE routers
    if (lowerText.includes('delete from routers')) {
      const idx = store.routers.findIndex(r => r.id === params[0]);
      if (idx === -1) return { rows: [] };
      const deleted = store.routers.splice(idx, 1)[0];
      return { rows: [deleted] };
    }

    // SELECT provision logs
    if (lowerText.includes('select') && lowerText.includes('from provision_logs')) {
      let rows = [...store.provision_logs];
      if (lowerText.includes('where router_id =')) {
        rows = rows.filter((log) => log.router_id === params[0]);
      }
      rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return { rows };
    }

    // INSERT provision logs
    if (lowerText.includes('insert into provision_logs')) {
      const log = {
        id: params[0],
        token: params[1],
        router_id: params[2],
        ip_address: params[3],
        user_agent: params[4],
        action: params[5],
        status: params[6],
        details: params[7],
        created_at: new Date().toISOString(),
      };
      store.provision_logs.push(log);
      return { rows: [log] };
    }

    // INSERT provision events
    if (lowerText.includes('insert into provision_events')) {
      const event = {
        id: params[0],
        router_id: params[1],
        event_type: params[2],
        script_content: params[3],
        created_at: new Date().toISOString(),
      };
      store.provision_events.push(event);
      return { rows: [event] };
    }

    // SELECT project_modules
    if (lowerText.includes('select') && lowerText.includes('from project_modules')) {
      if (lowerText.includes('where project_id =')) {
        const modules = store.project_modules.filter(m => m.project_id === params[0]);
        return { rows: modules };
      }
      return { rows: store.project_modules };
    }

    // SELECT modules by project_id and module_type (check existing)
    if (lowerText.includes('select id from project_modules')) {
      const modules = store.project_modules.filter(m => m.project_id === params[0] && m.module_type === params[1]);
      return { rows: modules };
    }

    // INSERT/UPDATE project_modules
    if (lowerText.includes('update project_modules')) {
      const module = store.project_modules.find(m => m.project_id === params[2] && m.module_type === params[3]);
      if (!module) return { rows: [] };
      module.config_data = params[0];
      module.generated_script = params[1] || module.generated_script;
      module.updated_at = new Date().toISOString();
      return { rows: [module] };
    }

    if (lowerText.includes('insert into project_modules')) {
      const mod = {
        id: params[0],
        project_id: params[1],
        module_type: params[2],
        config_data: params[3],
        generated_script: params[4],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.project_modules.push(mod);
      return { rows: [mod] };
    }

    // DELETE project_modules
    if (lowerText.includes('delete from project_modules')) {
      const idx = store.project_modules.findIndex(m => m.id === params[0]);
      if (idx === -1) return { rows: [] };
      return { rows: store.project_modules.splice(idx, 1) };
    }

    // SELECT templates
    if (lowerText.includes('select') && lowerText.includes('from templates')) {
      let results = [...store.templates];
      if (lowerText.includes('where')) {
        if (lowerText.includes('category =')) {
          results = results.filter(t => t.category === params[0]);
        } else if (lowerText.includes('id =')) {
          results = results.filter(t => t.id === params[0]);
        }
      }
      return { rows: results.sort((a, b) => a.name.localeCompare(b.name)) };
    }

    // INSERT templates
    if (lowerText.includes('insert into templates')) {
      const template = {
        id: params[0],
        name: params[1],
        description: params[2],
        category: params[3],
        content: params[4],
        is_public: params[5],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.templates.push(template);
      return { rows: [template] };
    }

    // UPDATE templates
    if (lowerText.includes('update templates')) {
      const idx = store.templates.findIndex(t => t.id === params[5]);
      if (idx === -1) return { rows: [] };
      const template = {
        ...store.templates[idx],
        name: params[0] || store.templates[idx].name,
        description: params[1] !== null ? params[1] : store.templates[idx].description,
        category: params[2] || store.templates[idx].category,
        content: params[3] || store.templates[idx].content,
        is_public: params[4] !== undefined ? params[4] : store.templates[idx].is_public,
        updated_at: new Date().toISOString(),
      };
      store.templates[idx] = template;
      return { rows: [template] };
    }

    // DELETE templates
    if (lowerText.includes('delete from templates')) {
      const idx = store.templates.findIndex(t => t.id === params[0]);
      if (idx === -1) return { rows: [] };
      return { rows: store.templates.splice(idx, 1) };
    }

    // SELECT mikrotik_connections
    if (lowerText.includes('select') && lowerText.includes('mikrotik_connections')) {
      if (lowerText.includes('where id =')) {
        const conn = store.mikrotik_connections.find(c => c.id === params[0]);
        return { rows: conn ? [conn] : [] };
      }
      // Return without password
      const conns = store.mikrotik_connections.map(c => ({
        id: c.id, name: c.name, ip_address: c.ip_address,
        api_port: c.api_port, ssh_port: c.ssh_port, username: c.username,
        connection_type: c.connection_type, use_tunnel: c.use_tunnel,
        tunnel_host: c.tunnel_host, tunnel_port: c.tunnel_port,
        tunnel_username: c.tunnel_username,
        is_online: c.is_online || false, last_seen: c.last_seen || null,
        created_at: c.created_at, updated_at: c.updated_at,
      }));
      return { rows: conns };
    }

    // INSERT mikrotik_connections
    if (lowerText.includes('insert into mikrotik_connections')) {
      const conn = {
        id: params[0],
        name: params[1],
        ip_address: params[2],
        api_port: params[3],
        ssh_port: params[4],
        username: params[5],
        password_encrypted: params[6],
        connection_type: params[7],
        use_tunnel: params[8],
        tunnel_host: params[9],
        tunnel_port: params[10],
        tunnel_username: params[11],
        tunnel_password_encrypted: params[12],
        is_online: false,
        last_seen: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.mikrotik_connections.push(conn);
      const safeConn = {
        id: conn.id,
        name: conn.name,
        ip_address: conn.ip_address,
        api_port: conn.api_port,
        ssh_port: conn.ssh_port,
        username: conn.username,
        connection_type: conn.connection_type,
        use_tunnel: conn.use_tunnel,
        tunnel_host: conn.tunnel_host,
        tunnel_port: conn.tunnel_port,
        tunnel_username: conn.tunnel_username,
        created_at: conn.created_at,
      };
      return { rows: [safeConn] };
    }

    // UPDATE mikrotik_connections
    if (lowerText.includes('update mikrotik_connections')) {
      const id = params[12];
      const conn = store.mikrotik_connections.find(c => c.id === id);
      if (!conn) return { rows: [] };
      conn.name = params[0];
      conn.ip_address = params[1];
      conn.api_port = params[2];
      conn.ssh_port = params[3];
      conn.username = params[4];
      conn.password_encrypted = params[5];
      conn.connection_type = params[6];
      conn.use_tunnel = params[7];
      conn.tunnel_host = params[8];
      conn.tunnel_port = params[9];
      conn.tunnel_username = params[10];
      conn.tunnel_password_encrypted = params[11];
      conn.updated_at = new Date().toISOString();

      return {
        rows: [{
          id: conn.id,
          name: conn.name,
          ip_address: conn.ip_address,
          api_port: conn.api_port,
          ssh_port: conn.ssh_port,
          username: conn.username,
          connection_type: conn.connection_type,
          use_tunnel: conn.use_tunnel,
          tunnel_host: conn.tunnel_host,
          tunnel_port: conn.tunnel_port,
          tunnel_username: conn.tunnel_username,
          is_online: conn.is_online || false,
          last_seen: conn.last_seen || null,
          created_at: conn.created_at,
          updated_at: conn.updated_at,
        }]
      };
    }

    // DELETE mikrotik_connections
    if (lowerText.includes('delete from mikrotik_connections')) {
      const idx = store.mikrotik_connections.findIndex(c => c.id === params[0]);
      if (idx === -1) return { rows: [] };
      return { rows: store.mikrotik_connections.splice(idx, 1) };
    }

    // INSERT script_history
    if (lowerText.includes('insert into script_history')) {
      return { rows: [] };
    }

    // SELECT resellers
    if (lowerText.includes('select') && lowerText.includes('from resellers')) {
      if (lowerText.includes('where id =')) {
        const reseller = store.resellers.find(r => r.id === params[0]);
        return { rows: reseller ? [reseller] : [] };
      }
      // Handle COUNT and COALESCE subqueries for customer_count and total_revenue
      const resellersWithStats = store.resellers.map(r => {
        const customers = store.customers.filter(c => c.reseller_id === r.id);
        const customerCount = customers.length;
        const totalRevenue = store.payments
          .filter(p => customers.some(c => c.id === p.customer_id))
          .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        return { ...r, customer_count: customerCount, total_revenue: totalRevenue };
      });
      return { rows: resellersWithStats.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) };
    }

    // INSERT resellers
    if (lowerText.includes('insert into resellers')) {
      const reseller = {
        id: params[0],
        name: params[1],
        company: params[2],
        email: params[3],
        phone: params[4],
        commission_rate: params[5] || 10,
        credit_limit: params[6] || 0,
        status: params[7] || 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.resellers.push(reseller);
      return { rows: [reseller] };
    }

    // UPDATE resellers
    if (lowerText.includes('update resellers')) {
      const idx = store.resellers.findIndex(r => r.id === params[7]);
      if (idx === -1) return { rows: [] };
      const reseller = {
        ...store.resellers[idx],
        name: params[0] || store.resellers[idx].name,
        company: params[1] !== undefined ? params[1] : store.resellers[idx].company,
        email: params[2] !== undefined ? params[2] : store.resellers[idx].email,
        phone: params[3] !== undefined ? params[3] : store.resellers[idx].phone,
        commission_rate: params[4] !== undefined ? params[4] : store.resellers[idx].commission_rate,
        credit_limit: params[5] !== undefined ? params[5] : store.resellers[idx].credit_limit,
        status: params[6] !== undefined ? params[6] : store.resellers[idx].status,
        updated_at: new Date().toISOString(),
      };
      store.resellers[idx] = reseller;
      return { rows: [reseller] };
    }

    // DELETE resellers
    if (lowerText.includes('delete from resellers')) {
      const idx = store.resellers.findIndex(r => r.id === params[0]);
      if (idx === -1) return { rows: [] };
      const deleted = store.resellers.splice(idx, 1)[0];
      // Set reseller_id to null for associated customers
      store.customers.forEach(c => {
        if (c.reseller_id === params[0]) c.reseller_id = null;
      });
      return { rows: [deleted] };
    }

    // SELECT customers (for customer routes)
    if (lowerText.includes('select') && lowerText.includes('from customers')) {
      if (lowerText.includes('where id =')) {
        const customer = store.customers.find(c => c.id === params[0]);
        return { rows: customer ? [customer] : [] };
      }
      return { rows: store.customers.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) };
    }

    // INSERT customers
    if (lowerText.includes('insert into customers')) {
      const customer = {
        id: params[0],
        name: params[1] || '',
        email: params[2] || '',
        phone: params[3] || '',
        address: params[4] || '',
        status: params[5] || 'active',
        service_plan_id: params[6],
        reseller_id: params[7],
        fup_profile_id: params[8] || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.customers.push(customer);
      return { rows: [customer] };
    }

    // UPDATE customers
    if (lowerText.includes('update customers') && lowerText.includes('where id =')) {
      const idx = store.customers.findIndex(c => c.id === params[params.length - 1]);
      if (idx === -1) return { rows: [] };
      store.customers[idx] = { 
        ...store.customers[idx], 
        ...params[0], 
        fup_profile_id: params[0].fup_profile_id !== undefined ? params[0].fup_profile_id : store.customers[idx].fup_profile_id,
        updated_at: new Date().toISOString() 
      };
      return { rows: [store.customers[idx]] };
    }

    // DELETE customers
    if (lowerText.includes('delete from customers')) {
      const idx = store.customers.findIndex(c => c.id === params[0]);
      if (idx === -1) return { rows: [] };
      return { rows: store.customers.splice(idx, 1) };
    }

    // SELECT payments
    if (lowerText.includes('select') && lowerText.includes('from payments')) {
      if (lowerText.includes('where id =')) {
        const payment = store.payments.find(p => p.id === params[0]);
        return { rows: payment ? [payment] : [] };
      }
      return { rows: store.payments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) };
    }

    // INSERT payments
    if (lowerText.includes('insert into payments')) {
      const payment = {
        id: params[0],
        customer_id: params[1],
        amount: params[2],
        method: params[3],
        reference: params[4],
        notes: params[5],
        created_at: new Date().toISOString(),
      };
      store.payments.push(payment);
      return { rows: [payment] };
    }

    // DELETE payments
    if (lowerText.includes('delete from payments')) {
      const idx = store.payments.findIndex(p => p.id === params[0]);
      if (idx === -1) return { rows: [] };
      return { rows: store.payments.splice(idx, 1) };
    }

    // SELECT olt_connections
    if (lowerText.includes('select') && lowerText.includes('from olt_connections')) {
      if (lowerText.includes('where id =')) {
        const olt = store.olt_connections.find(o => o.id === params[0]);
        return { rows: olt ? [olt] : [] };
      }
      return { rows: store.olt_connections.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) };
    }

    // INSERT olt_connections
    if (lowerText.includes('insert into olt_connections')) {
      const olt = {
        id: params[0],
        name: params[1],
        vendor: params[2],
        model: params[3],
        ip_address: params[4],
        telnet_port: params[5] || 23,
        snmp_port: params[6] || 161,
        username: params[7],
        password_encrypted: params[8],
        snmp_community_encrypted: params[9],
        location: params[10],
        status: params[11] || 'active',
        custom_oids: params[12],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.olt_connections.push(olt);
      return { rows: [olt] };
    }

    // UPDATE olt_connections
    if (lowerText.includes('update olt_connections') && lowerText.includes('where id =')) {
      const idx = store.olt_connections.findIndex(o => o.id === params[0]);
      if (idx === -1) return { rows: [] };
      store.olt_connections[idx] = {
        ...store.olt_connections[idx],
        name: params[1] || store.olt_connections[idx].name,
        vendor: params[2] || store.olt_connections[idx].vendor,
        model: params[3] || store.olt_connections[idx].model,
        ip_address: params[4] || store.olt_connections[idx].ip_address,
        telnet_port: params[5] || store.olt_connections[idx].telnet_port,
        snmp_port: params[6] || store.olt_connections[idx].snmp_port,
        username: params[7] || store.olt_connections[idx].username,
        password_encrypted: params[8] || store.olt_connections[idx].password_encrypted,
        snmp_community_encrypted: params[9] || store.olt_connections[idx].snmp_community_encrypted,
        location: params[10] !== undefined ? params[10] : store.olt_connections[idx].location,
        status: params[11] || store.olt_connections[idx].status,
        custom_oids: params[12] !== undefined ? params[12] : store.olt_connections[idx].custom_oids,
        updated_at: new Date().toISOString(),
      };
      return { rows: [store.olt_connections[idx]] };
    }

    // DELETE olt_connections
    if (lowerText.includes('delete from olt_connections')) {
      const idx = store.olt_connections.findIndex(o => o.id === params[0]);
      if (idx === -1) return { rows: [] };
      return { rows: store.olt_connections.splice(idx, 1) };
    }

    // SELECT integrations
    if (lowerText.includes('select') && lowerText.includes('from integrations')) {
      if (lowerText.includes('where id =')) {
        const integration = store.integrations.find(i => i.id === params[0]);
        return { rows: integration ? [integration] : [] };
      }
      return { rows: store.integrations.sort((a, b) => a.category.localeCompare(b.category)) };
    }

    // UPDATE integrations
    if (lowerText.includes('update integrations')) {
      const idx = store.integrations.findIndex(i => i.id === params[2]);
      if (idx === -1) return { rows: [] };
      store.integrations[idx] = {
        ...store.integrations[idx],
        config_data: params[0],
        is_active: params[1] !== undefined ? params[1] : store.integrations[idx].is_active,
        updated_at: new Date().toISOString(),
      };
      return { rows: [store.integrations[idx]] };
    }

    // SELECT hotspot_vouchers
    if (lowerText.includes('select') && lowerText.includes('from hotspot_vouchers')) {
      return { rows: store.hotspot_vouchers.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) };
    }

    // INSERT hotspot_vouchers
    if (lowerText.includes('insert into hotspot_vouchers')) {
      const voucher = {
        id: params[0],
        username: params[1],
        password: params[2],
        profile: params[3],
        valid_for: params[4],
        rate_limit: params[5],
        data_limit: params[6],
        price: params[7],
        company_name: params[8],
        connection_id: params[9],
        created_at: params[10] || new Date().toISOString(),
      };
      store.hotspot_vouchers.push(voucher);
      return { rows: [voucher] };
    }

    // DELETE hotspot_vouchers
    if (lowerText.includes('delete from hotspot_vouchers')) {
      const idx = store.hotspot_vouchers.findIndex(v => v.id === params[0]);
      if (idx === -1) return { rows: [] };
      return { rows: store.hotspot_vouchers.splice(idx, 1) };
    }

    // SELECT fup_profiles
    if (lowerText.includes('select') && lowerText.includes('from fup_profiles')) {
      if (params[0] && params.length === 1) {
        const fup = store.fup_profiles.find(f => f.id === params[0]);
        return fup ? { rows: [fup] } : { rows: [] };
      }
      return { rows: store.fup_profiles.sort((a, b) => (a.priority || 100) - (b.priority || 100)) };
    }

    // INSERT fup_profiles
    if (lowerText.includes('insert into fup_profiles')) {
      const fup = {
        id: params[0],
        name: params[1],
        description: params[2],
        data_limit: params[3],
        data_limit_unit: params[4],
        reset_period: params[5],
        throttle_speed: params[6],
        priority: params[7],
        is_active: params[8],
        created_at: params[9] || new Date().toISOString(),
        updated_at: params[10] || new Date().toISOString(),
      };
      store.fup_profiles.push(fup);
      return { rows: [fup] };
    }

    // UPDATE fup_profiles
    if (lowerText.includes('update fup_profiles') && lowerText.includes('where id =')) {
      const idx = store.fup_profiles.findIndex(f => f.id === params[8]);
      if (idx === -1) return { rows: [] };
      store.fup_profiles[idx] = {
        ...store.fup_profiles[idx],
        name: params[0],
        description: params[1],
        data_limit: params[2],
        data_limit_unit: params[3],
        reset_period: params[4],
        throttle_speed: params[5],
        priority: params[6],
        is_active: params[7],
        updated_at: new Date().toISOString(),
      };
      return { rows: [store.fup_profiles[idx]] };
    }

    // DELETE fup_profiles
    if (lowerText.includes('delete from fup_profiles')) {
      const idx = store.fup_profiles.findIndex(f => f.id === params[0]);
      if (idx === -1) return { rows: [] };
      return { rows: store.fup_profiles.splice(idx, 1) };
    }

    // SELECT tr069_devices
    if (lowerText.includes('select') && lowerText.includes('from tr069_devices')) {
      if (params[0] && params.length === 1) {
        const device = store.tr069_devices.find(d => d.id === params[0]);
        return device ? { rows: [device] } : { rows: [] };
      }
      if (lowerText.includes('serial_number =')) {
        const device = store.tr069_devices.find(d => d.serial_number === params[0]);
        return device ? { rows: [device] } : { rows: [] };
      }
      return { rows: store.tr069_devices.sort((a, b) => new Date(b.last_inform || 0) - new Date(a.last_inform || 0)) };
    }

    // INSERT tr069_devices
    if (lowerText.includes('insert into tr069_devices')) {
      const device = {
        id: params[0],
        serial_number: params[1],
        manufacturer: params[2],
        model: params[3],
        firmware_version: params[4],
        connection_id: params[5],
        ip_address: params[6],
        status: params[7],
        last_inform: params[8] || new Date().toISOString(),
        parameters: params[9],
        created_at: params[10] || new Date().toISOString(),
        updated_at: params[11] || new Date().toISOString(),
      };
      const existingIdx = store.tr069_devices.findIndex(d => d.serial_number === device.serial_number);
      if (existingIdx !== -1) {
        store.tr069_devices[existingIdx] = { ...store.tr069_devices[existingIdx], ...device, updated_at: new Date().toISOString() };
        return { rows: [store.tr069_devices[existingIdx]] };
      }
      store.tr069_devices.push(device);
      return { rows: [device] };
    }

    // UPDATE tr069_devices
    if (lowerText.includes('update tr069_devices') && lowerText.includes('where id =')) {
      const idx = store.tr069_devices.findIndex(d => d.id === params[7]);
      if (idx === -1) return { rows: [] };
      store.tr069_devices[idx] = {
        ...store.tr069_devices[idx],
        manufacturer: params[0],
        model: params[1],
        firmware_version: params[2],
        connection_id: params[3],
        ip_address: params[4],
        status: params[5],
        parameters: params[6],
        updated_at: new Date().toISOString(),
      };
      return { rows: [store.tr069_devices[idx]] };
    }

    // DELETE tr069_devices
    if (lowerText.includes('delete from tr069_devices')) {
      const idx = store.tr069_devices.findIndex(d => d.id === params[0]);
      if (idx === -1) return { rows: [] };
      return { rows: store.tr069_devices.splice(idx, 1) };
    }

    // INSERT/UPDATE anything else (generic fallback)
    return { rows: [] };
  },

  pool: { on: () => {} },
  _getStore: () => store,
};

// Wrap query to check users first
const _origQ = module.exports.query;
module.exports.query = async function(text, params) {
  // Users handler
  const lower = text.toLowerCase();
  if (lower.includes('users')) {
    if (lower.includes('select count(*) from users')) {
      return { rows: [{ count: String(store.users.length) }] };
    }
    if (lower.includes('from users') && lower.includes('where email')) {
      const user = store.users.find(u => u.email === params[0]);
      return { rows: user ? [user] : [] };
    }
    if (lower.includes('from users') && lower.includes('where id')) {
      const user = store.users.find(u => u.id === params[params.length - 1]);
      return { rows: user ? [{ id: user.id, email: user.email, name: user.name, role: user.role, created_at: user.created_at }] : [] };
    }
    if (lower.includes('select id from users')) {
      return { rows: store.users.length > 0 ? [{ id: store.users[0].id }] : [] };
    }
    if (lower.includes('insert into users')) {
      const user = { id: params[0], email: params[1], password_hash: params[2], name: params[3], role: params[4], created_at: new Date().toISOString() };
      store.users.push(user);
      return { rows: [{ id: user.id, email: user.email, name: user.name, role: user.role }] };
    }
    if (lower.includes('update users')) {
      const user = store.users.find(u => u.id === params[params.length - 1]);
      if (user) { user.last_login_at = new Date().toISOString(); return { rows: [] }; }
    }
  }
  return _origQ(text, params);
};
