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
