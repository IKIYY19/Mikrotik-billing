import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Network,
  Link,
  HardDrive,
  FileCode,
  Server,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Users,
  Package,
  CreditCard,
  Receipt,
  MessageSquare,
  MessageCircle,
  MapPin,
  Wallet,
  Activity,
  UserCheck,
  Shield,
  FileText as FileText2,
  Database,
  Settings,
  TrendingUp,
  Wifi,
  Ticket,
  LifeBuoy,
  Palette,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/topology', icon: Network, label: 'Topology' },
  { to: '/router-linking', icon: Link, label: 'Router Linking' },
  { to: '/devices', icon: HardDrive, label: 'Provisioning' },
  { to: '/templates', icon: FileCode, label: 'Templates' },
  { to: '/mikrotik-api', icon: Server, label: 'MikroTik API' },
];

const billingItems = [
  { to: '/billing', icon: DollarSign, label: 'Overview' },
  { to: '/billing-customers', icon: Users, label: 'Customers' },
  { to: '/billing-plans', icon: Package, label: 'Plans' },
  { to: '/billing-subscriptions', icon: Activity, label: 'Subscriptions' },
  { to: '/billing-invoices', icon: Receipt, label: 'Invoices' },
  { to: '/billing-payments', icon: CreditCard, label: 'Payments' },
  { to: '/billing-wallet', icon: Wallet, label: 'Wallet' },
  { to: '/billing-sms', icon: MessageSquare, label: 'SMS' },
  { to: '/billing-whatsapp', icon: MessageCircle, label: 'WhatsApp' },
  { to: '/billing-map', icon: MapPin, label: 'Network Map' },
  { to: '/billing-monitoring', icon: Activity, label: 'Monitoring' },
  { to: '/billing-agents', icon: UserCheck, label: 'Agents' },
  { to: '/billing-auto-suspend', icon: Shield, label: 'Auto-Suspend' },
  { to: '/billing-reports', icon: FileText2, label: 'Reports' },
  { to: '/analytics', icon: TrendingUp, label: 'Analytics' },
  { to: '/pppoe', icon: Network, label: 'PPPoE' },
  { to: '/hotspot', icon: Wifi, label: 'Hotspot' },
  { to: '/hotspot-vouchers', icon: Ticket, label: 'Vouchers' },
  { to: '/network-services', icon: Server, label: 'Network' },
  { to: '/radius', icon: Shield, label: 'RADIUS' },
  { to: '/tickets', icon: LifeBuoy, label: 'Support' },
  { to: '/captive-portal', icon: Palette, label: 'Portal Builder' },
  { to: '/bandwidth', icon: Activity, label: 'Bandwidth' },
  { to: '/resellers', icon: UserCheck, label: 'Resellers' },
  { to: '/billing-backup', icon: Database, label: 'Backups' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
];

export function Sidebar() {
  const [billingOpen, setBillingOpen] = useState(false);

  return (
    <aside className="relative z-10 w-64 flex flex-col bg-[#09090b]/95 backdrop-blur-xl border-r border-zinc-800/50">
      {/* Header */}
      <div className="h-16 flex items-center px-4 border-b border-zinc-800/50">
        <NavLink to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Settings className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">MTK Builder</div>
            <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">ISP Platform</div>
          </div>
        </NavLink>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`
            }
          >
            <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}

        {/* Divider */}
        <div className="flex items-center gap-3 px-3 py-3">
          <div className="h-px flex-1 bg-zinc-800/60" />
          <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Billing</div>
          <div className="h-px flex-1 bg-zinc-800/60" />
        </div>

        {/* Billing items */}
        <button
          onClick={() => setBillingOpen(!billingOpen)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 w-full transition-all"
        >
          <DollarSign className="w-[18px] h-[18px] flex-shrink-0" />
          <span className="flex-1 text-left">All Billing</span>
          {billingOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>

        {billingOpen && (
          <div className="ml-4 pl-3 border-l border-zinc-800/50 space-y-0.5">
            {billingItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                    isActive ? 'bg-blue-500/10 text-blue-400 font-medium' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
                  }`
                }
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-zinc-800/50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-zinc-500 font-medium">v1.0 • Online</span>
        </div>
      </div>
    </aside>
  );
}
