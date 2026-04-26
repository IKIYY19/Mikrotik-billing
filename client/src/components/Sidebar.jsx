import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
  Settings as SettingsIcon,
  TrendingUp,
  Wifi,
  Ticket,
  LifeBuoy,
  Palette,
  LogOut,
  User,
  Key,
  Radio,
  Gauge,
  Router,
} from 'lucide-react';
import { clearAuth } from '../lib/auth';
import { SearchButton } from './GlobalSearch';
import { canAccessFeature, ROLES } from '../lib/permissions';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', feature: 'dashboard' },
  { to: '/topology', icon: Network, label: 'Topology', feature: 'topology' },
  { to: '/router-linking', icon: Link, label: 'Router Linking', feature: 'router-linking' },
  { to: '/devices', icon: HardDrive, label: 'Provisioning', feature: 'devices' },
  { to: '/templates', icon: FileCode, label: 'Templates', feature: 'templates' },
  { to: '/mikrotik-api', icon: Server, label: 'MikroTik API', feature: 'mikrotik-api' },
  { to: '/integrations', icon: Key, label: 'Integrations', feature: 'integrations' },
  { to: '/settings', icon: SettingsIcon, label: 'Settings', feature: 'settings' },
];

const billingItems = [
  { to: '/billing', icon: DollarSign, label: 'Overview', feature: 'billing' },
  { to: '/billing-customers', icon: Users, label: 'Customers', feature: 'customers' },
  { to: '/billing-plans', icon: Package, label: 'Plans', feature: 'plans' },
  { to: '/billing-subscriptions', icon: Activity, label: 'Subscriptions', feature: 'subscriptions' },
  { to: '/billing-invoices', icon: Receipt, label: 'Invoices', feature: 'invoices' },
  { to: '/billing-payments', icon: CreditCard, label: 'Payments', feature: 'payments' },
  { to: '/billing-wallet', icon: Wallet, label: 'Wallet', feature: 'wallet' },
  { to: '/billing-sms', icon: MessageSquare, label: 'SMS', feature: 'sms' },
  { to: '/billing-whatsapp', icon: MessageCircle, label: 'WhatsApp', feature: 'whatsapp' },
  { to: '/billing-map', icon: MapPin, label: 'Network Map', feature: 'network-map' },
  { to: '/billing-monitoring', icon: Activity, label: 'Monitoring', feature: 'monitoring' },
  { to: '/billing-agents', icon: UserCheck, label: 'Agents', feature: 'agents' },
  { to: '/billing-auto-suspend', icon: Shield, label: 'Auto-Suspend', feature: 'auto-suspend' },
  { to: '/billing-reports', icon: FileText2, label: 'Reports', feature: 'reports' },
  { to: '/analytics', icon: TrendingUp, label: 'Analytics', feature: 'analytics' },
  { to: '/pppoe', icon: Network, label: 'PPPoE', feature: 'pppoe' },
  { to: '/hotspot', icon: Wifi, label: 'Hotspot', feature: 'hotspot' },
  { to: '/hotspot-vouchers', icon: Ticket, label: 'Vouchers', feature: 'vouchers' },
  { to: '/network-services', icon: Server, label: 'Network', feature: 'network-services' },
  { to: '/olt', icon: Radio, label: 'OLT/Fiber', feature: 'olt' },
  { to: '/fup', icon: Gauge, label: 'FUP Profiles', feature: 'fup' },
  { to: '/tr069', icon: Router, label: 'TR-069 CPE', feature: 'tr069' },
  { to: '/speedtest', icon: Activity, label: 'Speed Test', feature: 'speedtest' },
  // { to: '/alerts', icon: AlertTriangle, label: 'Alerts', feature: 'alerts' },
  // { to: '/monitoring', icon: AlertTriangle, label: 'Monitoring', feature: 'monitoring' },
  { to: '/radius', icon: Shield, label: 'RADIUS', feature: 'radius' },
  { to: '/tickets', icon: LifeBuoy, label: 'Support', feature: 'tickets' },
  { to: '/captive-portal', icon: Palette, label: 'Portal Builder', feature: 'captive-portal' },
  { to: '/bandwidth', icon: Activity, label: 'Bandwidth', feature: 'bandwidth' },
  { to: '/resellers', icon: UserCheck, label: 'Resellers', feature: 'resellers' },
  { to: '/billing-backup', icon: Database, label: 'Backups', feature: 'backups' },
  { to: '/inventory', icon: Package, label: 'Inventory', feature: 'inventory' },
];

export function Sidebar({ onSearchOpen }) {
  const [billingOpen, setBillingOpen] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const userData = localStorage.getItem('auth_user');
      if (userData) {
        const parsed = JSON.parse(userData);
        setUser(parsed);
      }
    } catch (err) {
      console.error('Failed to parse user data:', err);
      setUser(null);
    }
  }, []);

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <aside className="relative z-10 w-64 flex flex-col bg-[#09090b]/95 backdrop-blur-xl border-r border-zinc-800/50">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-800/50">
        <NavLink to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <SettingsIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">MTK Builder</div>
            <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">ISP Platform</div>
          </div>
        </NavLink>
        <SearchButton onClick={onSearchOpen} />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {navItems.filter(item => canAccessFeature(user, item.feature)).map((item) => (
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

        {/* Divider - only show if user has billing access */}
        {billingItems.some(item => canAccessFeature(user, item.feature)) && (
          <div className="flex items-center gap-3 px-3 py-3">
            <div className="h-px flex-1 bg-zinc-800/60" />
            <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Billing</div>
            <div className="h-px flex-1 bg-zinc-800/60" />
          </div>
        )}

        {/* Billing items - only show if user has billing access */}
        {billingItems.some(item => canAccessFeature(user, item.feature)) && (
          <button
            onClick={() => setBillingOpen(!billingOpen)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 w-full transition-all"
          >
            <DollarSign className="w-[18px] h-[18px] flex-shrink-0" />
            <span className="flex-1 text-left">All Billing</span>
            {billingOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        )}

        {billingOpen && (
          <div className="ml-4 pl-3 border-l border-zinc-800/50 space-y-0.5">
            {billingItems.filter(item => canAccessFeature(user, item.feature)).map((item) => (
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
      <div className="p-4 border-t border-zinc-800/50 space-y-3">
        {/* Settings section - admin only */}
        {user?.role === 'admin' && (
          <>
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="h-px flex-1 bg-zinc-800/60" />
              <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Settings</div>
              <div className="h-px flex-1 bg-zinc-800/60" />
            </div>
            <NavLink
              to="/users"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`
              }
            >
              <Users className="w-[18px] h-[18px] flex-shrink-0" />
              <span className="truncate">User Management</span>
            </NavLink>
          </>
        )}

        {user && (
          <div className="flex items-center gap-3 p-2 bg-zinc-800/30 rounded-lg">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-zinc-300 truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-zinc-500 truncate">{user?.email || ''}{user?.role ? ` (${user.role})` : ''}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
