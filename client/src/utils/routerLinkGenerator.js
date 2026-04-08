/**
 * Router Link Generator
 * Generates MikroTik scripts to link multiple routers together
 */

export class RouterLinkGenerator {
  constructor(routers, method) {
    this.routers = routers;
    this.method = method;
    this.scripts = [];
  }

  generate() {
    switch (this.method) {
      case 'ospf': return this.generateOSPF();
      case 'bgp': return this.generateBGP();
      case 'gre': return this.generateGRE();
      case 'wireguard': return this.generateWireGuard();
      case 'vrrp': return this.generateVRRP();
      case 'eoip': return this.generateEoIP();
      case 'management': return this.generateManagement();
      default: return this.generateOSPF();
    }
  }

  generateOSPF() {
    this.scripts = this.routers.map(router => {
      const lines = [];
      lines.push('#############################################');
      lines.push(`# OSPF Configuration for ${router.name}`);
      lines.push(`# Generated: ${new Date().toISOString()}`);
      lines.push('#############################################');
      lines.push('');
      
      lines.push('# System identity');
      lines.push(`/system identity set name="${router.identity}"`);
      lines.push('');

      // Interface IPs
      lines.push('# Interface addresses');
      router.interfaces.forEach(iface => {
        if (iface.ip) {
          lines.push(`/ip address add address=${iface.ip} interface=${iface.name} comment="${router.name} ${iface.name}"`);
        }
      });
      lines.push('');

      // OSPF Instance
      lines.push('# OSPF Instance');
      lines.push(`/routing ospf instance add name=default router-id=${router.routerId}`);
      lines.push('');

      // OSPF Areas
      lines.push('# OSPF Area');
      lines.push('/routing ospf area add name=backbone area-id=0.0.0.0');
      lines.push('');

      // OSPF Networks - advertise all interfaces
      lines.push('# OSPF Networks');
      router.interfaces.forEach(iface => {
        if (iface.ip) {
          const network = iface.ip.split('/')[0].split('.').slice(0, 3).join('.') + '.0/24';
          lines.push(`/routing ospf network add network=${network} area=backbone comment="${router.name} ${iface.name}"`);
        }
      });
      lines.push('');

      // OSPF Interfaces
      lines.push('# OSPF Interfaces');
      router.interfaces.forEach(iface => {
        const networkType = iface.type === 'wan' || iface.type === 'link' ? 'point-to-point' : 'broadcast';
        lines.push(`/routing ospf interface add interface=${iface.name} network-type=${networkType} comment="${router.name} ${iface.name}"`);
      });
      lines.push('');

      // Neighbors (point-to-point)
      const otherRouters = this.routers.filter(r => r.id !== router.id);
      if (otherRouters.length > 0) {
        lines.push('# OSPF Neighbors');
        otherRouters.forEach(other => {
          const linkIface = other.interfaces.find(i => i.type === 'link' || i.type === 'wan');
          if (linkIface && linkIface.ip) {
            const neighborIP = linkIface.ip.split('/')[0];
            lines.push(`# Neighbor: ${other.name} (${neighborIP})`);
          }
        });
        lines.push('');
      }

      // Default route originating router
      if (router.role === 'core') {
        lines.push('# Default route (originating to OSPF)');
        lines.push('/routing ospf set [find default=yes] originate-default=yes');
        lines.push('');
      }

      // Inter-router firewall
      lines.push('# Allow OSPF between routers');
      lines.push('/ip firewall filter add chain=input protocol=ospf action=accept comment="Allow OSPF"');
      lines.push('/ip firewall filter add chain=input protocol=89 action=accept comment="Allow OSPF protocol 89"');
      lines.push('');

      lines.push('#############################################');
      lines.push('# End of OSPF Configuration');
      lines.push('#############################################');

      return {
        name: `${router.name}_ospf.rsc`,
        description: `OSPF linking for ${router.name} (Router ID: ${router.routerId})`,
        content: lines.join('\n'),
      };
    });

    return this.scripts;
  }

  generateBGP() {
    this.scripts = this.routers.map(router => {
      const lines = [];
      lines.push('#############################################');
      lines.push(`# BGP Configuration for ${router.name}`);
      lines.push(`# AS: ${router.asn} | Router ID: ${router.routerId}`);
      lines.push(`# Generated: ${new Date().toISOString()}`);
      lines.push('#############################################');
      lines.push('');
      
      lines.push('# System identity');
      lines.push(`/system identity set name="${router.identity}"`);
      lines.push('');

      // Interface IPs
      lines.push('# Interface addresses');
      router.interfaces.forEach(iface => {
        if (iface.ip) {
          lines.push(`/ip address add address=${iface.ip} interface=${iface.name} comment="${router.name} ${iface.name}"`);
        }
      });
      lines.push('');

      // BGP Instance
      lines.push('# BGP Instance');
      lines.push(`/routing/bgp/instance set default as=${router.asn} router-id=${router.routerId} client-to-client-reflection=yes`);
      lines.push('');

      // BGP Peers
      const otherRouters = this.routers.filter(r => r.id !== router.id);
      lines.push('# BGP Peers');
      otherRouters.forEach(other => {
        const linkIface = other.interfaces.find(i => i.type === 'link' || i.type === 'wan');
        if (linkIface && linkIface.ip) {
          const peerIP = linkIface.ip.split('/')[0];
          lines.push(`/routing/bgp/peer add name="peer_${other.name}" remote-as=${other.asn} remote-address=${peerIP} update-source=${router.routerId} comment="BGP peer to ${other.name} (AS${other.asn})"`);
        }
      });
      lines.push('');

      // BGP Networks - advertise local networks
      lines.push('# Advertise local networks');
      router.interfaces.filter(i => i.type === 'lan' && i.ip).forEach(iface => {
        const network = iface.ip.split('/')[0].split('.').slice(0, 3).join('.') + '.0/24';
        lines.push(`/routing/bgp/network add network=${network} comment="Advertise ${router.name} ${iface.name}"`);
      });
      lines.push('');

      // Inter-router firewall
      lines.push('# Allow BGP between routers');
      lines.push('/ip firewall filter add chain=input protocol=tcp dst-port=179 action=accept comment="Allow BGP"');
      lines.push('');

      lines.push('#############################################');
      lines.push('# End of BGP Configuration');
      lines.push('#############################################');

      return {
        name: `${router.name}_bgp.rsc`,
        description: `BGP peering for ${router.name} (AS${router.asn})`,
        content: lines.join('\n'),
      };
    });

    return this.scripts;
  }

  generateGRE() {
    this.scripts = this.routers.map(router => {
      const lines = [];
      lines.push('#############################################');
      lines.push(`# GRE Tunnels for ${router.name}`);
      lines.push(`# Generated: ${new Date().toISOString()}`);
      lines.push('#############################################');
      lines.push('');
      
      lines.push('# System identity');
      lines.push(`/system identity set name="${router.identity}"`);
      lines.push('');

      // Interface IPs
      lines.push('# Interface addresses');
      router.interfaces.forEach(iface => {
        if (iface.ip) {
          lines.push(`/ip address add address=${iface.ip} interface=${iface.name} comment="${router.name} ${iface.name}"`);
        }
      });
      lines.push('');

      // GRE Tunnels to other routers
      const otherRouters = this.routers.filter(r => r.id !== router.id);
      lines.push('# GRE Tunnels');
      otherRouters.forEach((other, idx) => {
        const tunnelName = `gre-${other.name.toLowerCase()}`;
        const localIface = router.interfaces.find(i => i.type === 'wan' || i.type === 'link');
        const remoteIface = other.interfaces.find(i => i.type === 'wan' || i.type === 'link');
        
        if (localIface && remoteIface && localIface.ip && remoteIface.ip) {
          const localIP = localIface.ip.split('/')[0];
          const remoteIP = remoteIface.ip.split('/')[0];
          const tunnelIP = `10.255.${idx + 1}.${router.id.split('-')[1]}/30`;
          
          lines.push(`# GRE Tunnel to ${other.name}`);
          lines.push(`/interface gre add name=${tunnelName} local-address=${localIP} remote-address=${remoteIP} mtu=1476 comment="GRE to ${other.name}"`);
          lines.push(`/ip address add address=${tunnelIP} interface=${tunnelName} comment="GRE tunnel IP to ${other.name}"`);
          
          // Static route over GRE
          const otherNetwork = other.interfaces.find(i => i.type === 'lan' && i.ip);
          if (otherNetwork) {
            const otherLAN = otherNetwork.ip.split('/')[0].split('.').slice(0, 3).join('.') + '.0/24';
            lines.push(`/ip route add dst-address=${otherLAN} gateway=${remoteIP} comment="Route to ${other.name} via GRE"`);
          }
          lines.push('');
        }
      });

      // OSPF over GRE (optional)
      lines.push('# OSPF over GRE tunnels');
      lines.push('/routing ospf instance add name=default router-id=' + router.routerId);
      lines.push('/routing ospf area add name=backbone area-id=0.0.0.0');
      otherRouters.forEach((other, idx) => {
        const tunnelName = `gre-${other.name.toLowerCase()}`;
        lines.push(`/routing ospf interface add interface=${tunnelName} network-type=point-to-point comment="OSPF over GRE to ${other.name}"`);
      });
      lines.push('');

      lines.push('#############################################');
      lines.push('# End of GRE Configuration');
      lines.push('#############################################');

      return {
        name: `${router.name}_gre.rsc`,
        description: `GRE tunnels for ${router.name}`,
        content: lines.join('\n'),
      };
    });

    return this.scripts;
  }

  generateWireGuard() {
    this.scripts = this.routers.map(router => {
      const lines = [];
      lines.push('#############################################');
      lines.push(`# WireGuard Mesh for ${router.name}`);
      lines.push(`# Generated: ${new Date().toISOString()}`);
      lines.push('#############################################');
      lines.push('');
      
      lines.push('# System identity');
      lines.push(`/system identity set name="${router.identity}"`);
      lines.push('');

      // Interface IPs
      lines.push('# Interface addresses');
      router.interfaces.forEach(iface => {
        if (iface.ip) {
          lines.push(`/ip address add address=${iface.ip} interface=${iface.name} comment="${router.name} ${iface.name}"`);
        }
      });
      lines.push('');

      // WireGuard Interface
      lines.push('# WireGuard Interface');
      lines.push(`/interface wireguard add name=wg-mesh private-key="${router.wgPrivateKey || '(generate-new-key)'}" listen-port=${router.wgPort} comment="WireGuard mesh interface"`);
      lines.push('');

      // WireGuard Peers (all other routers)
      const otherRouters = this.routers.filter(r => r.id !== router.id);
      lines.push('# WireGuard Peers');
      otherRouters.forEach((other, idx) => {
        const peerIP = `10.200.0.${router.id.split('-')[1] * 10 + idx + 1}/32`;
        const allowedIPs = other.interfaces
          .filter(i => i.ip && (i.type === 'lan' || i.type === 'link'))
          .map(i => i.ip)
          .join(',');
        
        lines.push(`# Peer: ${other.name}`);
        lines.push(`/interface wireguard peers add interface=wg-mesh public-key="(public-key-of-${other.name})" allowed-address=${allowedIPs || '10.0.0.0/8'} endpoint=${other.interfaces.find(i=>i.type==='wan')?.ip?.split('/')[0] || '0.0.0.0'}:${other.wgPort} persistent-keepalive=25 comment="WG peer to ${other.name}"`);
        lines.push('');
      });

      // Static routes through WireGuard
      lines.push('# Routes through WireGuard');
      otherRouters.forEach(other => {
        const otherLANs = other.interfaces.filter(i => i.ip && i.type === 'lan');
        otherLANs.forEach(lan => {
          lines.push(`/ip route add dst-address=${lan.ip} gateway=wg-mesh comment="Route to ${other.name} via WireGuard"`);
        });
      });
      lines.push('');

      lines.push('#############################################');
      lines.push('# End of WireGuard Configuration');
      lines.push('#############################################');

      return {
        name: `${router.name}_wireguard.rsc`,
        description: `WireGuard mesh for ${router.name}`,
        content: lines.join('\n'),
      };
    });

    return this.scripts;
  }

  generateVRRP() {
    // VRRP is between 2 routers for redundancy
    const [primary, backup] = this.routers;
    if (!primary || !backup) return [];

    this.scripts = this.routers.map(router => {
      const lines = [];
      const isPrimary = router.id === primary.id;
      lines.push('#############################################');
      lines.push(`# VRRP Configuration for ${router.name} (${isPrimary ? 'PRIMARY' : 'BACKUP'})`);
      lines.push(`# Generated: ${new Date().toISOString()}`);
      lines.push('#############################################');
      lines.push('');
      
      lines.push('# System identity');
      lines.push(`/system identity set name="${router.identity}"`);
      lines.push('');

      // Interface IPs
      lines.push('# Interface addresses');
      router.interfaces.forEach(iface => {
        if (iface.ip) {
          lines.push(`/ip address add address=${iface.ip} interface=${iface.name} comment="${router.name} ${iface.name}"`);
        }
      });
      lines.push('');

      // VRRP on LAN interfaces
      lines.push('# VRRP Configuration');
      const lanIfaces = router.interfaces.filter(i => i.type === 'lan' && i.ip);
      lanIfaces.forEach((iface, idx) => {
        const vrrpIP = iface.ip.split('/')[0].split('.').slice(0, 3).join('.') + '.254';
        const priority = isPrimary ? 200 - idx : 100 - idx;
        
        lines.push(`# VRRP on ${iface.name}`);
        lines.push(`/ip address add address=${vrrpIP}/24 interface=${iface.name} comment="VRRP virtual IP"`);
        lines.push(`/interface vrrp add interface=${iface.name} vrid=${idx + 1} priority=${priority} authentication=none comment="VRRP ${router.name} ${iface.name}"`);
        lines.push('');
      });

      // Default route
      lines.push('# Default route');
      if (isPrimary) {
        lines.push('/ip route add dst-address=0.0.0.0/0 gateway=WAN_GATEWAY distance=1 comment="Primary default route"');
      } else {
        lines.push('/ip route add dst-address=0.0.0.0/0 gateway=BACKUP_GATEWAY distance=2 comment="Backup default route"');
      }
      lines.push('');

      // Sync VRRP with routing
      lines.push('# Track VRRP state for routing');
      lines.push('/ip route add dst-address=0.0.0.0/0 gateway=VRRP_MASTER distance=1 check-gateway=ping comment="Track master"');
      lines.push('');

      lines.push('#############################################');
      lines.push('# End of VRRP Configuration');
      lines.push('#############################################');

      return {
        name: `${router.name}_vrrp.rsc`,
        description: `VRRP ${isPrimary ? 'PRIMARY' : 'BACKUP'} for ${router.name}`,
        content: lines.join('\n'),
      };
    });

    return this.scripts;
  }

  generateEoIP() {
    this.scripts = this.routers.map(router => {
      const lines = [];
      lines.push('#############################################');
      lines.push(`# EoIP Bridge for ${router.name}`);
      lines.push(`# Generated: ${new Date().toISOString()}`);
      lines.push('#############################################');
      lines.push('');
      
      lines.push('# System identity');
      lines.push(`/system identity set name="${router.identity}"`);
      lines.push('');

      // Interface IPs
      lines.push('# Interface addresses');
      router.interfaces.forEach(iface => {
        if (iface.ip) {
          lines.push(`/ip address add address=${iface.ip} interface=${iface.name} comment="${router.name} ${iface.name}"`);
        }
      });
      lines.push('');

      // Create bridge
      lines.push('# Bridge for EoIP');
      lines.push('/interface bridge add name=bridge-eoip vlan-filtering=no comment="EoIP bridge"');
      lines.push('');

      // EoIP tunnels to other routers
      const otherRouters = this.routers.filter(r => r.id !== router.id);
      lines.push('# EoIP Tunnels');
      otherRouters.forEach((other, idx) => {
        const tunnelName = `eoip-${other.name.toLowerCase()}`;
        const localIface = router.interfaces.find(i => i.type === 'wan' || i.type === 'link');
        const remoteIface = other.interfaces.find(i => i.type === 'wan' || i.type === 'link');
        
        if (localIface && remoteIface && localIface.ip && remoteIface.ip) {
          const localIP = localIface.ip.split('/')[0];
          const remoteIP = remoteIface.ip.split('/')[0];
          
          lines.push(`# EoIP Tunnel to ${other.name}`);
          lines.push(`/interface eoip add name=${tunnelName} local-address=${localIP} remote-address=${remoteIP} tunnel-id=${idx + 1} comment="EoIP to ${other.name}"`);
          lines.push(`/interface bridge port add bridge=bridge-eoip interface=${tunnelName} comment="Bridge EoIP to ${other.name}"`);
          lines.push('');
        }
      });

      // Add LAN interfaces to bridge
      router.interfaces.filter(i => i.type === 'lan').forEach(iface => {
        lines.push(`/interface bridge port add bridge=bridge-eoip interface=${iface.name} comment="Bridge LAN ${iface.name}"`);
      });
      lines.push('');

      lines.push('#############################################');
      lines.push('# End of EoIP Configuration');
      lines.push('#############################################');

      return {
        name: `${router.name}_eoip.rsc`,
        description: `EoIP bridge for ${router.name}`,
        content: lines.join('\n'),
      };
    });

    return this.scripts;
  }

  generateManagement() {
    this.scripts = this.routers.map(router => {
      const lines = [];
      lines.push('#############################################');
      lines.push(`# Inter-Router Management for ${router.name}`);
      lines.push(`# Generated: ${new Date().toISOString()}`);
      lines.push('#############################################');
      lines.push('');
      
      lines.push('# System identity');
      lines.push(`/system identity set name="${router.identity}"`);
      lines.push('');

      // Interface IPs
      lines.push('# Interface addresses');
      router.interfaces.forEach(iface => {
        if (iface.ip) {
          lines.push(`/ip address add address=${iface.ip} interface=${iface.name} comment="${router.name} ${iface.name}"`);
        }
      });
      lines.push('');

      // Allow management from other routers
      const otherRouters = this.routers.filter(r => r.id !== router.id);
      lines.push('# Allow management from other routers');
      otherRouters.forEach(other => {
        other.interfaces.filter(i => i.ip).forEach(iface => {
          const otherIP = iface.ip.split('/')[0];
          lines.push(`/ip firewall filter add chain=input src-address=${otherIP}/32 action=accept comment="Allow management from ${other.name}"`);
        });
      });
      lines.push('');

      // Enable secure services
      lines.push('# Enable secure management services');
      lines.push('/ip service set ssh disabled=no port=22');
      lines.push('/ip service set api disabled=no port=8728');
      lines.push('/ip service set api-ssl disabled=no port=8729');
      lines.push('/ip service set winbox disabled=no port=8291');
      lines.push('');

      // Disable insecure services
      lines.push('# Disable insecure services');
      lines.push('/ip service set telnet disabled=yes');
      lines.push('/ip service set ftp disabled=yes');
      lines.push('/ip service set www disabled=yes');
      lines.push('');

      // Create API user for management
      lines.push('# API user for inter-router management');
      lines.push('/user add name=api-manager password=CHANGE_ME group=full comment="API management user"');
      lines.push('');

      // NTP sync between routers
      lines.push('# NTP client (sync from other routers)');
      lines.push('/system ntp client set enabled=yes');
      otherRouters.forEach(other => {
        const ntpIface = other.interfaces.find(i => i.ip);
        if (ntpIface) {
          lines.push(`/system ntp client set primary-ntp=${ntpIface.ip.split('/')[0]}`);
        }
      });
      lines.push('');

      // Logging to central router
      lines.push('# Send logs to central router');
      const centralRouter = this.routers.find(r => r.role === 'core') || this.routers[0];
      if (centralRouter) {
        const centralIface = centralRouter.interfaces.find(i => i.ip);
        if (centralIface) {
          lines.push('/system logging action add name=remote-syslog target=remote remote-address=' + centralIface.ip.split('/')[0]);
          lines.push('/system logging add topics=info,error action=remote-syslog comment="Send logs to ' + centralRouter.name + '"');
        }
      }
      lines.push('');

      // SNMP for monitoring
      lines.push('# SNMP for monitoring');
      lines.push('/snmp set enabled=yes contact="admin" location="' + router.name + '"');
      lines.push('/snmp community set [find] name=monitor_ro addresses=' + this.routers.map(r => {
        const i = r.interfaces.find(x => x.ip);
        return i ? i.ip : null;
      }).filter(Boolean).join(',') + ' security=authorized');
      lines.push('');

      // Schedule backups
      lines.push('# Schedule automatic backups');
      lines.push('/system script add name=auto-backup source=":local backupName (\"backup_\" . [/system identity get name] . \"_\" . [:pick [:tostr [/system clock get date]] 0 10]); /system backup save name=$backupName;"');
      lines.push('/system scheduler add name=daily-backup on-event=auto-backup start-time=02:00:00 interval=1d comment="Daily backup"');
      lines.push('');

      lines.push('#############################################');
      lines.push('# End of Management Configuration');
      lines.push('#############################################');

      return {
        name: `${router.name}_management.rsc`,
        description: `Inter-router management for ${router.name}`,
        content: lines.join('\n'),
      };
    });

    return this.scripts;
  }
}
