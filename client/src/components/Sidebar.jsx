import React, { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { useBranding } from "../contexts/BrandingContext";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
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
  Zap,
  BarChart2,
  Globe,
} from "lucide-react";
import { clearAuth } from "../lib/auth";
import { SearchButton } from "./GlobalSearch";
import { canAccessFeature, ROLES } from "../lib/permissions";

const API = import.meta.env.VITE_API_URL || "/api";

// ─── Nav Group Definitions ───────────────────────────────────────────────────
const mainNavItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", feature: "dashboard" },
  { to: "/routers", icon: Router, label: "Routers", feature: "settings" },
  { to: "/integrations", icon: Key, label: "Integrations", feature: "integrations" },
];

const navGroups = [
  {
    id: "billing",
    label: "Billing",
    icon: DollarSign,
    color: "emerald",
    items: [
      { to: "/billing", icon: LayoutDashboard, label: "Overview", feature: "billing" },
      { to: "/billing-customers", icon: Users, label: "Customers", feature: "customers" },
      { to: "/billing-plans", icon: Package, label: "Plans", feature: "plans" },
      { to: "/billing-subscriptions", icon: Activity, label: "Subscriptions", feature: "subscriptions" },
      { to: "/billing-invoices", icon: Receipt, label: "Invoices", feature: "invoices" },
      { to: "/billing-payments", icon: CreditCard, label: "Payments", feature: "payments" },
      { to: "/billing-wallet", icon: Wallet, label: "Wallet", feature: "wallet" },
      { to: "/billing-reconcile", icon: Link, label: "Reconcile", feature: "subscriptions" },
      { to: "/merge-customers", icon: GitMerge, label: "Merge Customers", feature: "merge-customers" },
      { to: "/mpesa-reconcile", icon: Wallet, label: "M-Pesa Reconcile", feature: "mpesa-reconcile" },
      { to: "/credit-notes", icon: FileText2, label: "Credit Notes", feature: "invoices" },
    ],
  },
  {
    id: "network",
    label: "Network",
    icon: Network,
    color: "blue",
    items: [
      { to: "/pppoe", icon: Network, label: "PPPoE", feature: "pppoe" },
      { to: "/hotspot", icon: Wifi, label: "Hotspot", feature: "hotspot" },
      { to: "/hotspot-vouchers", icon: Ticket, label: "Vouchers", feature: "vouchers" },
      { to: "/ipam", icon: Network, label: "IPAM", feature: "ipam" },
      { to: "/network-services", icon: Server, label: "Network Services", feature: "network-services" },
      { to: "/olt", icon: Radio, label: "OLT / Fiber", feature: "olt" },
      { to: "/fup", icon: Gauge, label: "FUP Profiles", feature: "fup" },
      { to: "/tr069", icon: Router, label: "TR-069 CPE", feature: "tr069" },
      { to: "/radius", icon: Shield, label: "RADIUS", feature: "radius" },
      { to: "/radius-import", icon: Upload, label: "RADIUS Import", feature: "radius" },
      { to: "/bandwidth", icon: Activity, label: "Bandwidth", feature: "bandwidth" },
      { to: "/speedtest", icon: Zap, label: "Speed Test", feature: "speedtest" },
    ],
  },
  {
    id: "messaging",
    label: "Messaging",
    icon: MessageSquare,
    color: "violet",
    items: [
      { to: "/billing-messaging", icon: MessageSquare, label: "SMS", feature: "sms" },
      { to: "/billing-whatsapp", icon: MessageCircle, label: "WhatsApp", feature: "whatsapp" },
      { to: "/captive-portal", icon: Palette, label: "Portal Builder", feature: "captive-portal" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: Activity,
    color: "amber",
    items: [
      { to: "/billing-monitoring", icon: Activity, label: "Monitoring", feature: "monitoring" },
      { to: "/billing-map", icon: MapPin, label: "Network Map", feature: "network-map" },
      { to: "/billing-auto-suspend", icon: Shield, label: "Auto-Suspend", feature: "auto-suspend" },
      { to: "/billing-agents", icon: UserCheck, label: "Agents", feature: "agents" },
      { to: "/resellers", icon: UserCheck, label: "Resellers", feature: "resellers" },
      { to: "/inventory", icon: Package, label: "Inventory", feature: "inventory" },
      { to: "/billing-backup", icon: Database, label: "Backups", feature: "backups" },
      { to: "/tickets", icon: LifeBuoy, label: "Support", feature: "tickets" },
      { to: "/billing-reviews", icon: Star, label: "Reviews", feature: "reviews" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart2,
    color: "cyan",
    items: [
      { to: "/billing-reports", icon: FileText2, label: "Financial Reports", feature: "reports" },
      { to: "/analytics", icon: TrendingUp, label: "Analytics", feature: "analytics" },
    ],
  },
];

const adminNavItems = [
  { to: "/settings", icon: SettingsIcon, label: "Settings" },
  { to: "/tenant-branding", icon: Palette, label: "Tenant Branding" },
  { to: "/users", icon: Users, label: "User Management" },
  { to: "/audit-logs", icon: FileText2, label: "Audit Logs" },
  { to: "/webhooks", icon: Webhook, label: "Webhooks" },
];

// ─── Color map for group icons ────────────────────────────────────────────────
const groupColors = {
  emerald: { text: "#34d399", bg: "rgba(16,185,129,0.1)", glow: "rgba(16,185,129,0.2)" },
  blue: { text: "#60a5fa", bg: "rgba(59,130,246,0.1)", glow: "rgba(59,130,246,0.2)" },
  violet: { text: "#a78bfa", bg: "rgba(139,92,246,0.1)", glow: "rgba(139,92,246,0.2)" },
  amber: { text: "#fbbf24", bg: "rgba(245,158,11,0.1)", glow: "rgba(245,158,11,0.2)" },
  cyan: { text: "#22d3ee", bg: "rgba(6,182,212,0.1)", glow: "rgba(6,182,212,0.2)" },
};

// ─── NavItem Component ────────────────────────────────────────────────────────
function NavItem({ to, icon: Icon, label, end = false, onClick, indent = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg text-sm transition-all duration-200"
      style={({ isActive }) => ({
        padding: indent ? "0.4rem 0.75rem" : "0.5rem 0.75rem",
        background: isActive ? "var(--sidebar-item-active-bg)" : "transparent",
        color: isActive ? "var(--sidebar-item-active-text)" : "var(--sidebar-item-text)",
        fontWeight: isActive ? 600 : 450,
        boxShadow: isActive ? "0 0 12px var(--sidebar-active-glow)" : "none",
      })}
    >
      <Icon className="flex-shrink-0" style={{ width: indent ? 14 : 16, height: indent ? 14 : 16 }} />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

// ─── NavGroup Component (collapsible) ────────────────────────────────────────
function NavGroup({ group, user, onCloseMobile, defaultOpen = false }) {
  const location = useLocation();
  const hasActive = group.items.some(item => location.pathname.startsWith(item.to));
  const [open, setOpen] = useState(defaultOpen || hasActive);
  const colors = groupColors[group.color] || groupColors.blue;

  const visibleItems = group.items.filter(item => canAccessFeature(user, item.feature));
  if (visibleItems.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200"
        style={{
          color: open || hasActive ? colors.text : "var(--sidebar-item-text)",
          background: open || hasActive ? colors.bg : "transparent",
        }}
      >
        <div className="w-5 h-5 flex-shrink-0 rounded flex items-center justify-center" style={{ background: colors.bg }}>
          <group.icon style={{ width: 12, height: 12, color: colors.text }} />
        </div>
        <span className="flex-1 text-left">{group.label}</span>
        {open
          ? <ChevronDown className="w-3 h-3 opacity-60" />
          : <ChevronRight className="w-3 h-3 opacity-60" />
        }
      </button>

      {open && (
        <div
          className="mt-0.5 ml-3 pl-3 space-y-0.5"
          style={{ borderLeft: `1px solid var(--sidebar-divider)` }}
        >
          {visibleItems.map(item => (
            <NavItem
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              onClick={onCloseMobile}
              indent
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section Divider ─────────────────────────────────────────────────────────
function SectionLabel({ label }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 mt-1">
      <div className="h-px flex-1" style={{ background: "var(--sidebar-divider)" }} />
      <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--sidebar-section-label)" }}>
        {label}
      </span>
      <div className="h-px flex-1" style={{ background: "var(--sidebar-divider)" }} />
    </div>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────
export function Sidebar({ onSearchOpen, onCloseMobile }) {
  const [user, setUser] = useState(null);
  const branding = useBranding();
  const navigate = useNavigate();
  const { mode, setMode, eyeFilter, setEyeFilter, eyeIntensity, setEyeIntensity } = useTheme();
  const { t, i18n } = useTranslation();
  const [showLang, setShowLang] = useState(false);

  useEffect(() => {
    try {
      const userData = localStorage.getItem("auth_user");
      if (userData) setUser(JSON.parse(userData));
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
      className="relative z-10 w-60 flex flex-col border-r"
      style={{
        backgroundColor: "var(--sidebar-bg)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderColor: "var(--sidebar-border)",
      }}
    >
      {/* ── Logo ── */}
      <div
        className="h-14 flex items-center justify-between px-4 flex-shrink-0"
        style={{ borderBottom: `1px solid var(--sidebar-border)` }}
      >
        <NavLink to="/" className="flex items-center gap-2.5 min-w-0">
          {branding.company_logo ? (
            <img src={branding.company_logo} alt="Logo" className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--sidebar-item-active-bg)", boxShadow: "0 0 10px var(--sidebar-active-glow)" }}
            >
              <Building2 className="w-3.5 h-3.5" style={{ color: "var(--sidebar-icon-color, #fff)" }} />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate leading-tight">{branding.appName}</div>
            <div className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: "var(--sidebar-section-label)" }}>
              ISP Platform
            </div>
          </div>
        </NavLink>
        <div className="flex items-center gap-1 flex-shrink-0">
          <SearchButton onClick={onSearchOpen} />
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1 rounded-md transition-colors"
            style={{ color: "var(--sidebar-item-text)" }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {/* Main */}
        {mainNavItems
          .filter(item => canAccessFeature(user, item.feature))
          .map(item => (
            <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} end={item.to === "/"} onClick={onCloseMobile} />
          ))}

        {/* Feature Groups */}
        <SectionLabel label="Features" />
        <div className="space-y-0.5">
          {navGroups.map(group => (
            <NavGroup
              key={group.id}
              group={group}
              user={user}
              onCloseMobile={onCloseMobile}
            />
          ))}
        </div>

        {/* Admin section */}
        {user?.role === "admin" && (
          <>
            <SectionLabel label="Admin" />
            {adminNavItems.map(item => (
              <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} onClick={onCloseMobile} />
            ))}
          </>
        )}
      </nav>

      {/* ── Footer ── */}
      <div className="p-2 flex-shrink-0 space-y-1" style={{ borderTop: `1px solid var(--sidebar-border)` }}>
        {/* User info */}
        {user && (
          <div
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg mb-1"
            style={{ background: "var(--sidebar-user-bg)" }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--sidebar-item-active-bg)", color: "var(--sidebar-item-active-text)" }}
            >
              <User className="w-3 h-3" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: "var(--sidebar-item-hover-text, #e4e4e7)" }}>
                {user?.name || "User"}
              </p>
              <p className="text-[10px] truncate" style={{ color: "var(--sidebar-section-label)" }}>
                {user?.role || ""}
              </p>
            </div>
          </div>
        )}

        {/* Controls row */}
        <div className="flex items-center gap-1">
          {/* Dark/Light toggle */}
          <button
            onClick={() => setMode(mode === "dark" ? "light" : "dark")}
            className="flex-1 flex items-center justify-center gap-1.5 p-1.5 rounded-lg text-xs transition-all"
            style={{ color: "var(--sidebar-item-text)", background: "transparent" }}
            title={mode === "dark" ? "Light Mode" : "Dark Mode"}
          >
            {mode === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span className="text-[10px]">{mode === "dark" ? "Light" : "Dark"}</span>
          </button>

          {/* Eye comfort toggle */}
          <button
            onClick={() => setEyeFilter(!eyeFilter)}
            className="flex-1 flex items-center justify-center gap-1.5 p-1.5 rounded-lg text-xs transition-all"
            style={{
              color: eyeFilter ? "#fbbf24" : "var(--sidebar-item-text)",
              background: eyeFilter ? "rgba(251,191,36,0.08)" : "transparent",
            }}
            title={eyeFilter ? "Eye Comfort ON" : "Eye Comfort OFF"}
          >
            {eyeFilter ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="text-[10px]">Eye</span>
          </button>
        </div>

        {/* Eye comfort intensity */}
        {eyeFilter && (
          <div className="px-2 pb-1">
            <input
              type="range"
              min="10"
              max="100"
              value={eyeIntensity}
              onChange={e => setEyeIntensity(parseInt(e.target.value))}
              className="w-full h-1 rounded-full appearance-none cursor-pointer"
              style={{
                accentColor: "#fbbf24",
                background: `linear-gradient(to right, #fbbf24 0%, #fbbf24 ${eyeIntensity}%, #3f3f46 ${eyeIntensity}%, #3f3f46 100%)`,
              }}
            />
          </div>
        )}

        {/* Language Selector */}
        <button
          onClick={() => setShowLang(!showLang)}
          className="flex-1 flex items-center justify-center gap-1.5 p-1.5 rounded-lg text-xs transition-all"
          style={{ color: "var(--sidebar-item-text, #a1a1aa)", background: "transparent" }}
        >
          <Globe className="w-3.5 h-3.5" />
          <span className="text-[10px]">{i18n.language?.toUpperCase() || "EN"}</span>
        </button>
        {showLang && (
          <div className="px-2 pb-1 space-y-0.5">
            {["en","fr","es","sw","ar"].map(l => (
              <button key={l} onClick={() => { i18n.changeLanguage(l); setShowLang(false); }}
                className={`w-full text-left px-2 py-1 rounded text-[10px] transition-all ${i18n.language === l ? "text-amber-400 bg-amber-500/10" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                {t(`language.${l}`)}
              </button>
            ))}
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all"
          style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.2)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
