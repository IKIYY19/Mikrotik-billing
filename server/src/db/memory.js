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
        provision_token: params[9],
        provision_status: params[10],
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
      if (lowerText.includes('provision_status =')) router.provision_status = params[0];
      if (lowerText.includes('provision_token =')) router.provision_token = params[0];
      if (lowerText.includes('last_provisioned_at =')) router.last_provisioned_at = params[0];
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
        api_port: c.api_port, username: c.username,
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
        username: params[4],
        password_encrypted: params[5],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.mikrotik_connections.push(conn);
      const safeConn = { id: conn.id, name: conn.name, ip_address: conn.ip_address, api_port: conn.api_port, username: conn.username, created_at: conn.created_at };
      return { rows: [safeConn] };
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
      store.customers[idx] = { ...store.customers[idx], ...params[0], updated_at: new Date().toISOString() };
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
