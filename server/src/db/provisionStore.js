/**
 * In-memory storage for Zero-Touch Provisioning
 * Extends the base memory store with routers, provision_logs, provision_events
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Self-contained store
const store = {
  routers: [],
  provision_logs: [],
  provision_events: [],
};

function generateToken() {
  return `prov-${crypto.randomBytes(24).toString('hex')}`;
}

function logProvision(store, token, routerId, action, status, details, ip, ua) {
  store.provision_logs.push({
    id: uuidv4(),
    token,
    router_id: routerId || null,
    ip_address: ip || 'unknown',
    user_agent: ua || 'unknown',
    action,
    status,
    details,
    created_at: new Date().toISOString(),
  });
}

function generateProvisionScript(router) {
  const lines = [];
  lines.push('#############################################');
  lines.push('# MikroTik Auto-Provisioning Script');
  lines.push(`# Router: ${router.name}`);
  lines.push(`# Identity: ${router.identity || router.name}`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push(`# Token: ${router.provision_token}`);
  lines.push('#############################################');
  lines.push('');

  // System identity
  if (router.identity) {
    lines.push('# System Identity');
    lines.push(`/system identity set name="${router.identity}"`);
    lines.push('');
  }

  // DNS
  if (router.dns_servers && router.dns_servers.length > 0) {
    lines.push('# DNS Configuration');
    lines.push(`/ip dns set servers=${router.dns_servers.join(',')}`);
    lines.push('/ip dns set allow-remote-requests=yes');
    lines.push('');
  }

  // NTP
  if (router.ntp_servers && router.ntp_servers.length > 0) {
    lines.push('# NTP Configuration');
    lines.push('/system ntp client set enabled=yes');
    if (router.ntp_servers[0]) {
      lines.push(`/system ntp client set primary-ntp=${router.ntp_servers[0]}`);
    }
    if (router.ntp_servers[1]) {
      lines.push(`/system ntp client set secondary-ntp=${router.ntp_servers[1]}`);
    }
    lines.push('');
  }

  // WAN interface (DHCP client by default)
  lines.push('# WAN Configuration');
  lines.push(`/ip dhcp-client add interface=${router.wan_interface} add-default-route=yes use-peer-dns=yes comment="WAN auto-configured"`);
  lines.push('');

  // LAN Bridge
  lines.push('# LAN Bridge');
  lines.push('/interface bridge add name=bridge1 comment="Auto-created LAN bridge"');
  lines.push('');

  // Add LAN ports to bridge (ether2-ether5)
  lines.push('# Bridge LAN ports');
  for (let i = 2; i <= 5; i++) {
    lines.push(`/interface bridge port add bridge=bridge1 interface=ether${i} comment="Auto-bridge ether${i}"`);
  }
  lines.push('');

  // LAN IP
  lines.push('# LAN IP Address');
  lines.push('/ip address add address=192.168.88.1/24 interface=bridge1 comment="LAN gateway"');
  lines.push('');

  // NAT Masquerade
  lines.push('# NAT Masquerade');
  lines.push(`/ip firewall nat add chain=srcnat action=masquerade out-interface=${router.wan_interface} comment="Auto-NAT masquerade"`);
  lines.push('');

  // DHCP Server for LAN
  lines.push('# DHCP Server');
  lines.push('/ip pool add name=dhcp_pool ranges=192.168.88.100-192.168.88.200');
  lines.push('/ip dhcp-server network add address=192.168.88.0/24 gateway=192.168.88.1 dns-server=192.168.88.1');
  lines.push(`/ip dhcp-server add name=dhcp_lan interface=bridge1 address-pool=dhcp_pool disabled=no comment="Auto DHCP server"`);
  lines.push('');

  // Basic Firewall
  lines.push('# Basic Firewall');
  lines.push('/ip firewall filter add chain=input action=accept connection-state=established,related,untracked comment="Auto: Allow established"');
  lines.push('/ip firewall filter add chain=input action=drop connection-state=invalid comment="Auto: Drop invalid"');
  lines.push('/ip firewall filter add chain=input protocol=icmp action=accept comment="Auto: Allow ICMP"');
  lines.push('/ip firewall filter add chain=input action=drop comment="Auto: Drop all other input"');
  lines.push('/ip firewall filter add chain=forward action=accept connection-state=established,related,untracked comment="Auto: Forward established"');
  lines.push('/ip firewall filter add chain=forward action=accept comment="Auto: Allow LAN to WAN"');
  lines.push('/ip firewall filter add chain=forward action=drop comment="Auto: Drop forward"');
  lines.push('');

  // FastTrack
  lines.push('# FastTrack');
  lines.push('/ip firewall filter add chain=forward action=fasttrack-connection connection-state=established,related comment="Auto: FastTrack"');
  lines.push('');

  // RADIUS
  if (router.radius_server && router.radius_secret) {
    lines.push('# RADIUS Configuration');
    lines.push(`/radius add address=${router.radius_server} secret="${router.radius_secret}" service=ppp timeout=3s comment="Auto-provisioned RADIUS"`);
    lines.push('/ppp aaa set use-radius=yes');
    lines.push('');
  }

  // PPPoE Server
  if (router.pppoe_enabled) {
    lines.push('# PPPoE Server');
    const pppoeIface = router.pppoe_interface || 'ether2';
    const serviceName = router.pppoe_service_name || 'Auto-PPPoE';
    lines.push(`/interface pppoe-server server add service-name="${serviceName}" interface=${pppoeIface} max-mtu=1492 max-mru=1492 disabled=no comment="Auto-provisioned PPPoE"`);
    lines.push('/ip pool add name=pppoe_pool ranges=10.10.0.100-10.10.0.200');
    lines.push('/ppp profile add name=pppoe_default local-address=10.10.0.1 remote-address=pppoe_pool rate-limit=10M/10M change-tcp-mss=yes comment="Auto PPPoE profile"');
    lines.push('');
  }

  // Hotspot
  if (router.hotspot_enabled) {
    lines.push('# Hotspot Setup');
    lines.push('/ip hotspot setup interface=bridge1 address=192.168.90.1/24 mask=24 local-address=192.168.90.1 dns-name=login.local');
    lines.push('');
  }

  // Disable insecure services
  lines.push('# Disable Insecure Services');
  lines.push('/ip service set telnet disabled=yes');
  lines.push('/ip service set ftp disabled=yes');
  lines.push('/ip service set www disabled=yes');
  lines.push('/ip service set api disabled=yes');
  lines.push('/ip service set api-ssl disabled=no');
  lines.push('/ip service set ssh disabled=no');
  lines.push('/ip service set winbox disabled=no');
  lines.push('');

  // Auto-sync script from server (re-provisioning)
  lines.push('# Auto-sync Scheduler (optional re-provision)');
  lines.push('/system script add name=auto-sync source="/tool fetch mode=https url=\\"https://MYDOMAIN.com/mikrotik/provision/TOKEN\\" dst-path=auto-sync.rsc; :delay 2s; /import auto-sync.rsc;"');
  lines.push('/system scheduler add name=weekly-sync on-event=auto-sync start-time=03:00:00 interval=7d comment="Weekly config sync"');
  lines.push('');

  // Callback to mark provisioned
  lines.push('# Callback to provisioning server');
  lines.push(`/tool fetch mode=https url="https://MYDOMAIN.com/mikrotik/provision/callback/${router.provision_token}" keep-result=no`);
  lines.push('');

  lines.push('#############################################');
  lines.push('# End of Auto-Provisioning Script');
  lines.push('#############################################');

  return lines.join('\n');
}

module.exports = {
  extendStore: () => store,
  generateToken,
  logProvision,
  generateProvisionScript,

  _updateRouterStatus(routerId, status) {
    const router = store.routers.find(r => r.id === routerId);
    if (router) {
      router.provision_status = status;
      router.last_provisioned_at = new Date().toISOString();
      router.provision_attempts = (router.provision_attempts || 0) + 1;
      router.updated_at = new Date().toISOString();
    }
  },

  _regenerateToken(routerId) {
    const router = store.routers.find(r => r.id === routerId);
    if (router) {
      router.provision_token = generateToken();
      router.provision_status = 'pending';
      router.updated_at = new Date().toISOString();
    }
    return router;
  },

  query: async (text, params) => {
    const lowerText = text.toLowerCase();

    // SELECT routers
    if (lowerText.includes('select') && lowerText.includes('from routers')) {
      if (lowerText.includes('where provision_token')) {
        const router = store.routers.find(r => r.provision_token === params[0]);
        return { rows: router ? [router] : [] };
      }
      if (lowerText.includes('where id')) {
        const router = store.routers.find(r => r.id === params[0]);
        return { rows: router ? [router] : [] };
      }
      if (lowerText.includes('where project_id')) {
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
        identity: params[3] || params[2],
        model: params[4] || '',
        mac_address: params[5] || '',
        ip_address: params[6] || '',
        wan_interface: params[7] || 'ether1',
        lan_interface: params[8] || 'bridge1',
        provision_token: params[9] || generateToken(),
        provision_status: params[10] || 'pending',
        last_provisioned_at: null,
        provision_attempts: 0,
        dns_servers: params[11] || ['8.8.8.8', '8.8.4.4'],
        ntp_servers: params[12] || ['pool.ntp.org'],
        radius_server: params[13] || '',
        radius_secret: params[14] || '',
        radius_port: params[15] || 1812,
        hotspot_enabled: params[16] || false,
        pppoe_enabled: params[17] || false,
        pppoe_interface: params[18] || '',
        pppoe_service_name: params[19] || '',
        mgmt_port: params[20] || 8728,
        notes: params[21] || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.routers.push(router);
      return { rows: [router] };
    }

    // UPDATE routers
    if (lowerText.includes('update routers') && lowerText.includes('set')) {
      // Find router by id (params vary based on what's being updated)
      const idIdx = params.findIndex(p => typeof p === 'string' && p.startsWith('router-') || (typeof p === 'string' && p.length > 20));
      // Simpler: pass id as last param for SET WHERE id = $N
      // Actually let's handle this differently - the route will construct the query
      // For now, handle the pattern from the routes file
      return { rows: [] };
    }

    // UPDATE routers (specific patterns)
    if (lowerText.includes('update routers')) {
      if (lowerText.includes('provision_token') && lowerText.includes('where id')) {
        const router = store.routers.find(r => r.id === params[0]);
        if (router) {
          router.provision_token = params[1];
          router.updated_at = new Date().toISOString();
          return { rows: [router] };
        }
      }
      if (lowerText.includes('provision_status') && lowerText.includes('where id')) {
        const router = store.routers.find(r => r.id === params[0]);
        if (router) {
          router.provision_status = params[1];
          router.last_provisioned_at = new Date().toISOString();
          router.provision_attempts = (router.provision_attempts || 0) + 1;
          router.updated_at = new Date().toISOString();
          return { rows: [router] };
        }
      }
      // Generic update
      if (lowerText.includes('where id =')) {
        const idParam = params[params.length - 1];
        const router = store.routers.find(r => r.id === idParam);
        if (router) {
          const fields = ['name', 'identity', 'model', 'mac_address', 'ip_address', 'wan_interface', 'lan_interface', 'dns_servers', 'ntp_servers', 'radius_server', 'radius_secret', 'radius_port', 'hotspot_enabled', 'pppoe_enabled', 'pppoe_interface', 'pppoe_service_name', 'mgmt_port', 'notes'];
          fields.forEach((field, idx) => {
            if (params[idx] !== undefined && params[idx] !== null) {
              router[field] = params[idx];
            }
          });
          router.updated_at = new Date().toISOString();
          return { rows: [router] };
        }
      }
      return { rows: [] };
    }

    // DELETE routers
    if (lowerText.includes('delete from routers')) {
      const idx = store.routers.findIndex(r => r.id === params[0]);
      if (idx === -1) return { rows: [] };
      return { rows: store.routers.splice(idx, 1) };
    }

    // UPDATE routers - specific patterns first
    if (lowerText.includes('update routers') && lowerText.includes('provision_status')) {
      const idParam = params[params.length - 1];
      console.log('[STORE] provision_status update, idParam:', idParam, 'all params:', JSON.stringify(params));
      const router = store.routers.find(r => r.id === idParam);
      console.log('[STORE] Found router:', !!router);
      if (!router) return { rows: [] };
      router.provision_status = params[0];
      router.last_provisioned_at = new Date().toISOString();
      router.provision_attempts = (router.provision_attempts || 0) + 1;
      router.updated_at = new Date().toISOString();
      console.log('[STORE] Updated router status to:', router.provision_status);
      return { rows: [router] };
    }

    // UPDATE routers - token regen
    if (lowerText.includes('update routers') && lowerText.includes('provision_token')) {
      const idParam = params[params.length - 1];
      const router = store.routers.find(r => r.id === idParam);
      if (!router) return { rows: [] };
      router.provision_token = params[0];
      router.provision_status = 'pending';
      router.updated_at = new Date().toISOString();
      return { rows: [router] };
    }

    // UPDATE routers - generic SET with WHERE id
    if (lowerText.includes('update routers')) {
      const idParam = params[params.length - 1];
      const router = store.routers.find(r => r.id === idParam);
      if (!router) return { rows: [] };

      // Map the SET fields from the devices route
      const fieldNames = ['name', 'identity', 'model', 'mac_address', 'ip_address',
        'wan_interface', 'lan_interface', 'dns_servers', 'ntp_servers',
        'radius_server', 'radius_secret', 'radius_port',
        'hotspot_enabled', 'pppoe_enabled', 'pppoe_interface', 'pppoe_service_name',
        'mgmt_port', 'notes'];
      
      fieldNames.forEach((field, idx) => {
        if (params[idx] !== undefined && params[idx] !== null) {
          router[field] = params[idx];
        }
      });
      router.updated_at = new Date().toISOString();
      return { rows: [router] };
    }

    // SELECT provision_logs
    if (lowerText.includes('select') && lowerText.includes('from provision_logs')) {
      if (lowerText.includes('where router_id')) {
        const logs = store.provision_logs.filter(l => l.router_id === params[0]);
        return { rows: logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) };
      }
      if (lowerText.includes('where token')) {
        const logs = store.provision_logs.filter(l => l.token === params[0]);
        return { rows: logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) };
      }
      return { rows: store.provision_logs };
    }

    // INSERT provision_logs
    if (lowerText.includes('insert into provision_logs')) {
      const log = {
        id: params[0],
        token: params[1],
        router_id: params[2] || null,
        ip_address: params[3] || 'unknown',
        user_agent: params[4] || 'unknown',
        action: params[5],
        status: params[6],
        details: params[7] || '',
        created_at: new Date().toISOString(),
      };
      store.provision_logs.push(log);
      return { rows: [log] };
    }

    // SELECT provision_events
    if (lowerText.includes('select') && lowerText.includes('from provision_events')) {
      if (lowerText.includes('where router_id')) {
        const events = store.provision_events.filter(e => e.router_id === params[0]);
        return { rows: events.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) };
      }
      return { rows: store.provision_events };
    }

    // INSERT provision_events
    if (lowerText.includes('insert into provision_events')) {
      const event = {
        id: params[0],
        router_id: params[1],
        event_type: params[2],
        script_content: params[3] || '',
        created_at: new Date().toISOString(),
      };
      store.provision_events.push(event);
      return { rows: [event] };
    }

    return { rows: [] };
  },
};
