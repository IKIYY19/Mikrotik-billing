import React, { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import axios from "axios";
import { useBranding } from "../contexts/BrandingContext";
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
  Star,
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
  Webhook,
  User,
  Key,
  Radio,
  Gauge,
  Router,
  GitMerge,
  Building2,
  Sun,
  Moon,
  Upload,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { clearAuth } from "../lib/auth";
import { SearchButton } from "./GlobalSearch";
import { useTheme } from "../contexts/ThemeContext";
import { canAccessFeature, ROLES } from "../lib/permissions";

const API = import.meta.env.VITE_API_URL || "/api";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", feature: "dashboard" },
  {
    to: "/integrations",
    icon: Key,
    label: "Integrations",
    feature: "integrations",
  },
  {
    to: "/routers",
    icon: Router,
    label: "Routers",
    feature: "settings",
  },
];

const billingItems = [
  { to: "/billing", icon: DollarSign, label: "Overview", feature: "billing" },
  {
    to: "/billing-customers",
    icon: Users,
    label: "Customers",
    feature: "customers",
  },
  { to: "/billing-plans", icon: Package, label: "Plans", feature: "plans" },
  {
    to: "/billing-subscriptions",
    icon: Activity,
    label: "Subscriptions",
    feature: "subscriptions",
  },
  {
    to: "/billing-reconcile",
    icon: Link,
    label: "Reconcile",
    feature: "subscriptions",
  },
  {
    to: "/billing-invoices",
    icon: Receipt,
    label: "Invoices",
    feature: "invoices",
  },
  {
    to: "/billing-payments",
    icon: CreditCard,
    label: "Payments",
    feature: "payments",
  },
  { to: "/billing-wallet", icon: Wallet, label: "Wallet", feature: "wallet" },
  {
    to: "/merge-customers",
    icon: GitMerge,
    label: "Merge Customers",
    feature: "merge-customers",
  },
  {
    to: "/mpesa-reconcile",
    icon: Wallet,
    label: "M-Pesa Reconcile",
    feature: "mpesa-reconcile",
  },
  { to: "/billing-messaging", icon: MessageSquare, label: "Messaging", feature: "sms" },
  {
    to: "/billing-whatsapp",
    icon: MessageCircle,
    label: "WhatsApp",
    feature: "whatsapp",
  },
  {
    to: "/billing-map",
    icon: MapPin,
    label: "Network Map",
    feature: "network-map",
  },
  {
    to: "/billing-monitoring",
    icon: Activity,
    label: "Monitoring",
    feature: "monitoring",
  },
  {
    to: "/billing-agents",
    icon: UserCheck,
    label: "Agents",
    feature: "agents",
  },
  {
    to: "/billing-auto-suspend",
    icon: Shield,
    label: "Auto-Suspend",
    feature: "auto-suspend",
  },
  { to: "/billing-reviews", icon: Star, label: "Reviews", feature: "reviews" },
  {
    to: "/billing-reports",
    icon: FileText2,
    label: "Reports",
    feature: "reports",
  },
  {
    to: "/analytics",
    icon: TrendingUp,
    label: "Analytics",
    feature: "analytics",
  },
  { to: "/pppoe", icon: Network, label: "PPPoE", feature: "pppoe" },
  { to: "/hotspot", icon: Wifi, label: "Hotspot", feature: "hotspot" },
  {
    to: "/hotspot-vouchers",
    icon: Ticket,
    label: "Vouchers",
    feature: "vouchers",
  },
  {
    to: "/ipam",
    icon: Network,
    label: "IPAM",
    feature: "ipam",
  },
  {
    to: "/network-services",
    icon: Server,
    label: "Network",
    feature: "network-services",
  },
  { to: "/olt", icon: Radio, label: "OLT/Fiber", feature: "olt" },
  { to: "/fup", icon: Gauge, label: "FUP Profiles", feature: "fup" },
  { to: "/tr069", icon: Router, label: "TR-069 CPE", feature: "tr069" },
  {
    to: "/speedtest",
    icon: Activity,
    label: "Speed Test",
    feature: "speedtest",
  },
  { to: "/radius", icon: Shield, label: "RADIUS", feature: "radius" },
  {
    to: "/radius-import",
    icon: Upload,
    label: "RADIUS Import",
    feature: "radius",
  },
  { to: "/tickets", icon: LifeBuoy, label: "Support", feature: "tickets" },
  {
    to: "/captive-portal",
    icon: Palette,
    label: "Portal Builder",
    feature: "captive-portal",
  },
  {
    to: "/bandwidth",
    icon: Activity,
    label: "Bandwidth",
    feature: "bandwidth",
  },
  {
    to: "/resellers",
    icon: UserCheck,
    label: "Resellers",
    feature: "resellers",
  },
  {
    to: "/credit-notes",
    icon: FileText2,
    label: "Credit Notes",
    feature: "invoices",
  },
  {
    to: "/billing-backup",
    icon: Database,
    label: "Backups",
    feature: "backups",
  },
  { to: "/inventory", icon: Package, label: "Inventory", feature: "inventory" },
];

export function Sidebar({ onSearchOpen, onCloseMobile }) {
  const [billingOpen, setBillingOpen] = useState(false);
  const [user, setUser] = useState(null);
  const branding = useBranding();
  const navigate = useNavigate();
  const { mode, setMode, eyeFilter, setEyeFilter } = useTheme();

  useEffect(() => {
    try {
      const userData = localStorage.getItem("auth_user");
      if (userData) {
        const parsed = JSON.parse(userData);
        setUser(parsed);
      }
    } catch (err) {
      console.error("Error parsing user data:", err);
    }
  }, []);

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  return (
    <aside
      className="relative z-10 w-64 flex flex-col border-r"
      style={{
        backgroundColor: "var(--sidebar-bg)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderColor: "var(--sidebar-border)",
      }}
    >
      {/* Header */}
      <div
        className="h-16 flex items-center justify-between px-4"
        style={{ borderBottom: `1px solid var(--sidebar-border)` }}
      >
        <NavLink to="/" className="flex items-center gap-3">
          {branding.company_logo ? (
            <img
              src={branding.company_logo}
              alt="Company Logo"
              className="w-8 h-8 rounded-lg object-cover"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: "var(--sidebar-item-active-bg, rgba(79,70,229,0.1))",
                boxShadow: "0 0 12px var(--sidebar-active-glow, rgba(79,70,229,0.2))"
              }}
            >
              <Building2 className="w-4 h-4" style={{ color: "var(--sidebar-icon-color, #fff)" }} />
            </div>
          )}
          <div>
            <div className="text-sm font-semibold text-white truncate max-w-[120px]">
              {branding.appName}
            </div>
            <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
              {branding.company_name ? "NETWORK PLATFORM" : "ISP PLATFORM"}
            </div>
          </div>
        </NavLink>
        <SearchButton onClick={onSearchOpen} />
        <button
          onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--sidebar-item-text, #a1a1aa)" }}
          >
            <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {navItems
          .filter((item) => canAccessFeature(user, item.feature))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={onCloseMobile}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-zinc-800/40"
              style={({ isActive }) =>
                isActive
                  ? { background: "var(--sidebar-item-active-bg)", color: "var(--sidebar-item-active-text)", boxShadow: "0 0 12px var(--sidebar-active-glow)" }
                  : { color: "var(--sidebar-item-text)" }
              }
            >
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}

        {/* Divider - only show if user has billing access */}
        {billingItems.some((item) => canAccessFeature(user, item.feature)) && (
          <div className="flex items-center gap-3 px-3 py-3">
            <div className="h-px flex-1" style={{ background: "var(--sidebar-divider)" }} />
            <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--sidebar-section-label)" }}>
              Billing
            </div>
            <div className="h-px flex-1" style={{ background: "var(--sidebar-divider)" }} />
          </div>
        )}

        {/* Billing items - only show if user has billing access */}
        {billingItems.some((item) => canAccessFeature(user, item.feature)) && (
          <button
            onClick={() => setBillingOpen(!billingOpen)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full transition-all hover:bg-zinc-800/40"
            style={{ color: "var(--sidebar-item-text)" }}
          >
            <DollarSign className="w-[18px] h-[18px] flex-shrink-0" />
            <span className="flex-1 text-left">Billing</span>
            {billingOpen ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
        )}

        {billingOpen && (
          <div className="ml-4 pl-3 space-y-0.5" style={{ borderLeft: `1px solid var(--sidebar-border)` }}>
            {billingItems
              .filter((item) => canAccessFeature(user, item.feature))
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onCloseMobile}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200"
                  style={({ isActive }) =>
                    isActive
                      ? { background: "var(--sidebar-item-active-bg)", color: "var(--sidebar-item-active-text)", fontWeight: 500 }
                      : { color: "#71717a" }
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
      <div className="p-3 flex-shrink-0 space-y-2" style={{ borderTop: `1px solid var(--sidebar-border)` }}>
        {/* Settings section - admin only */}
        {user?.role === "admin" && (
          <>
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="h-px flex-1" style={{ background: "var(--sidebar-divider)" }} />
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--sidebar-section-label)" }}>
                Settings
              </div>
              <div className="h-px flex-1" style={{ background: "var(--sidebar-divider)" }} />
            </div>
            <NavLink
              to="/settings"
              onClick={onCloseMobile}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-zinc-800/40"
              style={({ isActive }) =>
                isActive
                  ? { background: "var(--sidebar-item-active-bg)", color: "var(--sidebar-item-active-text)", boxShadow: "0 0 12px var(--sidebar-active-glow)" }
                  : { color: "var(--sidebar-item-text)" }
              }
            >
              <SettingsIcon className="w-[18px] h-[18px] flex-shrink-0" />
              <span className="truncate">Settings</span>
            </NavLink>
            <NavLink
              to="/tenant-branding"
              onClick={onCloseMobile}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-zinc-800/40"
              style={({ isActive }) =>
                isActive
                  ? { background: "var(--sidebar-item-active-bg)", color: "var(--sidebar-item-active-text)", boxShadow: "0 0 12px var(--sidebar-active-glow)" }
                  : { color: "var(--sidebar-item-text)" }
              }
            >
              <Palette className="w-[18px] h-[18px] flex-shrink-0" />
              <span className="truncate">Tenant Branding</span>
            </NavLink>
            <NavLink
              to="/users"
              onClick={onCloseMobile}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-zinc-800/40"
              style={({ isActive }) =>
                isActive
                  ? { background: "var(--sidebar-item-active-bg)", color: "var(--sidebar-item-active-text)", boxShadow: "0 0 12px var(--sidebar-active-glow)" }
                  : { color: "var(--sidebar-item-text)" }
              }
            >
              <Users className="w-[18px] h-[18px] flex-shrink-0" />
              <span className="truncate">User Management</span>
            </NavLink>
            <NavLink
              to="/audit-logs"
              onClick={onCloseMobile}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-zinc-800/40"
              style={({ isActive }) =>
                isActive
                  ? { background: "var(--sidebar-item-active-bg)", color: "var(--sidebar-item-active-text)", boxShadow: "0 0 12px var(--sidebar-active-glow)" }
                  : { color: "var(--sidebar-item-text)" }
              }
            >
              <FileText2 className="w-[18px] h-[18px] flex-shrink-0" />
              <span className="truncate">Audit Logs</span>
            </NavLink>
            <NavLink
              to="/webhooks"
              onClick={onCloseMobile}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-zinc-800/40"
              style={({ isActive }) =>
                isActive
                  ? { background: "var(--sidebar-item-active-bg)", color: "var(--sidebar-item-active-text)", boxShadow: "0 0 12px var(--sidebar-active-glow)" }
                  : { color: "var(--sidebar-item-text)" }
              }
            >
              <Webhook className="w-[18px] h-[18px] flex-shrink-0" />
              <span className="truncate">Webhooks</span>
            </NavLink>
          </>
        )}

        {user && (
          <div
            className="flex items-center gap-3 p-2 rounded-lg"
            style={{ background: "var(--sidebar-user-bg)" }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                background: "var(--sidebar-item-active-bg)",
                color: "var(--sidebar-item-active-text)",
              }}
            >
              <User className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: "var(--sidebar-item-hover-text, #e4e4e7)" }}>
                {user?.name || "User"}
              </p>
              <p className="text-xs text-zinc-500 truncate">
                {user?.email || ""}
                {user?.role ? ` (${user.role})` : ""}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={() => setMode(mode === "dark" ? "light" : "dark")}
          className="p-2 rounded-lg transition-colors"
          style={{
            color: "var(--sidebar-item-text, #a1a1aa)",
            background: "transparent",
          }}
          title={
            mode === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"
          }
        >
          {mode === "dark" ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>
        <button
          onClick={() => setEyeFilter(!eyeFilter)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
          style={{
            color: eyeFilter ? "#fbbf24" : "var(--sidebar-item-text, #a1a1aa)",
            background: eyeFilter ? "rgba(251, 191, 36, 0.1)" : "transparent",
          }}
          title={eyeFilter ? "Disable Eye Comfort" : "Enable Eye Comfort (Blue Light Filter)"}
        >
          {eyeFilter ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          <span>Eye Comfort</span>
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
