import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  FolderPlus,
  TrendingUp,
  Users,
  UserCheck,
  AlertTriangle,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  FileCode,
  Router,
  Settings,
  Network,
  Plus,
  Clock,
  FolderOpen,
  Trash2,
  Sparkles,
  Shield,
  MapPin,
  Activity,
  UserPlus,
  Key,
  Wifi,
  MessageSquare,
  CreditCard,
  Link,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { useStore } from "../store";

const API_URL = import.meta.env.VITE_API_URL || "/api";

/* ─── Animated Counter ─── */
function AnimatedNumber({ value, prefix = "", suffix = "" }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 800;
    const steps = 30;
    const stepTime = duration / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += (value - 0) / steps;
      setDisplay(Math.round(current * 100) / 100);
      if (current >= value) {
        clearInterval(timer);
        setDisplay(value);
      }
    }, stepTime);
    return () => clearInterval(timer);
  }, [value]);
  return (
    <span>
      {prefix}
      {typeof value === "number" && value % 1 !== 0
        ? display.toFixed(2)
        : Math.round(display)}
      {suffix}
    </span>
  );
}

/* ─── Stat Card ─── */
function StatCard({
  icon: Icon,
  label,
  value,
  prefix,
  suffix,
  trend,
  color,
  onClick,
}) {
  const colorMap = {
    blue: "from-blue-500 to-cyan-500",
    emerald: "from-emerald-500 to-teal-500",
    violet: "from-violet-500 to-purple-500",
    amber: "from-amber-500 to-orange-500",
    red: "from-red-500 to-rose-500",
    green: "from-green-500 to-emerald-500",
  };

  return (
    <div
      onClick={onClick}
      className={`surface-card p-6 ${onClick ? "cursor-pointer hover:shadow-lg" : ""}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorMap[color]} flex items-center justify-center`}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend !== undefined && (
          <div
            className={`flex items-center gap-1 text-sm ${trend >= 0 ? "text-green-400" : "text-red-400"}`}
          >
            {trend >= 0 ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="text-3xl font-bold text-white mb-1">
        <AnimatedNumber value={value} prefix={prefix} suffix={suffix} />
      </div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  );
}

/* ─── Quick Action Button ─── */
function QuickAction({ icon: Icon, label, color, onClick }) {
  const colorMap = {
    blue: "hover:bg-blue-500/20 hover:border-blue-500/30 text-blue-400",
    emerald:
      "hover:bg-emerald-500/20 hover:border-emerald-500/30 text-emerald-400",
    violet: "hover:bg-violet-500/20 hover:border-violet-500/30 text-violet-400",
    amber: "hover:bg-amber-500/20 hover:border-amber-500/30 text-amber-400",
    cyan: "hover:bg-cyan-500/20 hover:border-cyan-500/30 text-cyan-400",
    orange: "hover:bg-orange-500/20 hover:border-orange-500/30 text-orange-400",
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 transition-all ${colorMap[color]}`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium text-sm">{label}</span>
    </button>
  );
}

/* ─── Feature Card ─── */
function FeatureCard({ to, icon: Icon, label, desc, color, bg, ring }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(to)}
      className="surface-card p-6 cursor-pointer group"
    >
      <div
        className={`w-12 h-12 rounded-xl ${bg} ring-1 ${ring} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">{label}</h3>
      <p className="text-sm text-gray-400">{desc}</p>
    </div>
  );
}

const featureCards = [
  {
    to: "/billing",
    icon: DollarSign,
    label: "ISP Billing",
    desc: "Manage customers & revenue",
    color: "from-emerald-500 to-teal-500",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/20",
  },
  {
    to: "/billing-map",
    icon: MapPin,
    label: "Network Map",
    desc: "GIS customer locations",
    color: "from-amber-500 to-orange-500",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/20",
  },
];

/* ─── Main Dashboard ─── */
export function Dashboard() {
  const {
    projects,
    fetchProjects,
    createProject,
    deleteProject,
    loading: storeLoading,
  } = useStore();
  const [stats, setStats] = useState(null);
  const [quickActions, setQuickActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    routeros_version: "v7",
  });
  const [currencySymbol, setCurrencySymbol] = useState("KES");
  const navigate = useNavigate();
  const toast = useToast();

  const fetchDashboardData = async () => {
    try {
      const [statsRes, actionsRes, settingsRes] = await Promise.all([
        axios.get(`${API_URL}/dashboard/stats`),
        axios.get(`${API_URL}/dashboard/quick-actions`),
        axios.get(`${API_URL}/settings`).catch(() => ({ data: {} })),
      ]);

      // Read currency symbol from settings
      const settings = settingsRes.data?.settings || settingsRes.data || {};
      setCurrencySymbol(settings.currency_symbol || settings.currency || "KES");

      if (statsRes.data.success) {
        setStats(statsRes.data.stats || {});
      }
      if (actionsRes.data.success && Array.isArray(actionsRes.data.actions)) {
        setQuickActions(actionsRes.data.actions);
      } else {
        setQuickActions([]);
      }

      setLastRefresh(new Date());
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    fetchDashboardData();
    fetchProjects();
    toast.success("Dashboard refreshed");
  };

  const handleQuickAction = (action) => {
    if (action.id === "new-project") {
      setShowCreate(true);
    } else {
      navigate(action.route);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const project = await createProject(newProject);
    if (project) {
      setShowCreate(false);
      navigate(`/project/${project.id}`);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (window.confirm("Delete this project?")) {await deleteProject(id);}
  };

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-full animate-fade-in">
      {/* Background */}
      <div className="absolute inset-0 bg-mesh" />
      <div className="absolute inset-0 bg-noise" />

      {/* Header */}
      <div className="relative border-b border-white/10">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                  <span className="text-sm font-semibold text-blue-400 uppercase tracking-wider">
                    ISP Billing Platform
                  </span>
              </div>
              <h1 className="text-3xl font-bold text-white mb-1">Dashboard</h1>
              <p className="text-gray-400">
                {lastRefresh &&
                  `Last updated: ${lastRefresh.toLocaleTimeString()}`}
              </p>
            </div>

            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-8 py-8 space-y-8">
        {/* Revenue Overview */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div
              className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-2xl p-5 hover:border-emerald-500/30 transition-all cursor-pointer"
              onClick={() => navigate("/billing-reports")}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Today's Revenue
                </span>
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {currencySymbol} {stats.todayRevenue?.toLocaleString() || "0"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {stats.todayPayments || 0} payments today
              </div>
            </div>

            <div
              className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-2xl p-5 hover:border-blue-500/30 transition-all cursor-pointer"
              onClick={() => navigate("/billing-reports")}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                  This Month
                </span>
                <TrendingUp className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {currencySymbol} {stats.monthRevenue?.toLocaleString() || "0"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {stats.revenueChange > 0 ? "\u2191" : "\u2193"}{" "}
                {Math.abs(stats.revenueChange || 0)}% vs last month
              </div>
            </div>

            <div
              className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-2xl p-5 hover:border-amber-500/30 transition-all cursor-pointer"
              onClick={() => navigate("/billing-invoices")}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  Outstanding
                </span>
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {currencySymbol}{" "}
                {stats.outstandingBalance?.toLocaleString() || "0"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {stats.overdueInvoices || 0} overdue invoices
              </div>
            </div>

            <div
              className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border border-violet-500/20 rounded-2xl p-5 hover:border-violet-500/30 transition-all cursor-pointer"
              onClick={() => navigate("/billing")}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">
                  Active Subs
                </span>
                <Users className="w-5 h-5 text-violet-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {stats.activeSubscriptions || 0}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {stats.activeCustomers || 0} active customers
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="surface-card p-4 hover:shadow-lg cursor-pointer" onClick={() => navigate("/billing-customers")}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Active Customers</span>
                <Users className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white">{stats.activeCustomers || 0}</div>
              <div className="text-xs text-zinc-500 mt-1">+{stats.recentCustomers || 0} this week</div>
            </div>
            <div className="surface-card p-4 hover:shadow-lg cursor-pointer" onClick={() => navigate("/radius")}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Online Sessions</span>
                <Wifi className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white">{stats.activeRadiusSessions || 0}</div>
              <div className="text-xs text-zinc-500 mt-1">RADIUS active</div>
            </div>
            <div className="surface-card p-4 hover:shadow-lg cursor-pointer" onClick={() => navigate("/billing-invoices")}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Overdue</span>
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div className="text-2xl font-bold text-white">{stats.overdueInvoices || 0}</div>
              <div className="text-xs text-zinc-500 mt-1">{stats.outstandingBalance?.toLocaleString() || 0} KES outstanding</div>
            </div>
            <div className="surface-card p-4 hover:shadow-lg cursor-pointer" onClick={() => navigate("/analytics")}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Churn Rate</span>
                <TrendingUp className="w-5 h-5 text-violet-400" />
              </div>
              <div className="text-2xl font-bold text-white">{stats.suspendedCustomers || 0}</div>
              <div className="text-xs text-zinc-500 mt-1">{stats.activeSubscriptions || 0} active subs</div>
            </div>
          </div>
        )}

        {/* Recent Payments Feed */}
        {stats?.recentPayments?.length > 0 && (
          <div className="surface-card p-4 mb-6">
            <h2 className="text-sm font-semibold text-zinc-400 mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-400" /> Recent Payments
            </h2>
            <div className="space-y-0">
              {stats.recentPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-zinc-800/30 last:border-0">
                  <div>
                    <p className="text-sm text-white">{p.customer_name || "Unknown"}</p>
                    <p className="text-xs text-zinc-500">{p.method || "payment"} &middot; {p.received_at ? new Date(p.received_at).toLocaleDateString() : ""}</p>
                  </div>
                  <span className="text-sm font-semibold text-green-400">+{(p.amount || 0).toLocaleString()} KES</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {quickActions.map((action) => {
            const iconMap = { UserPlus, MessageSquare, CreditCard, Link };
            const Icon = iconMap[action.icon] || UserPlus;
            return (
              <div key={action.id} onClick={() => navigate(action.route)} className="surface-card p-4 cursor-pointer text-center hover:shadow-lg">
                <div className={`w-10 h-10 rounded-xl bg-${action.color}-500/10 flex items-center justify-center mx-auto mb-2`}>
                  <Icon className={`w-5 h-5 text-${action.color}-400`} />
                </div>
                <p className="text-sm font-medium text-white">{action.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
