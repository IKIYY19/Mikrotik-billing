import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  TrendingUp,
  Users,
  AlertTriangle,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Router,
  Plus,
  Clock,
  Sparkles,
  Activity,
  UserPlus,
  Key,
  Wifi,
  MessageSquare,
  CreditCard,
  Link,
  Zap,
  ChevronRight,
  CheckCircle,
  XCircle,
  Circle,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { useStore } from "../store";

const API_URL = import.meta.env.VITE_API_URL || "/api";

// ─── Animated Number ──────────────────────────────────────────────────────────
function AnimatedNumber({ value, prefix = "", suffix = "", decimals = 0 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!value) return;
    const duration = 900;
    const steps = 40;
    const stepTime = duration / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += value / steps;
      setDisplay(current >= value ? value : current);
      if (current >= value) clearInterval(timer);
    }, stepTime);
    return () => clearInterval(timer);
  }, [value]);
  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString();
  return <span>{prefix}{formatted}{suffix}</span>;
}

// ─── Sparkline SVG ────────────────────────────────────────────────────────────
function Sparkline({ data = [], color = "#818cf8", height = 36 }) {
  if (!data || data.length < 2) {
    // Render a flat placeholder line
    return (
      <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
        <line x1="0" y1={height / 2} x2="100" y2={height / 2} stroke={color} strokeWidth="1.5" strokeOpacity="0.3" />
      </svg>
    );
  }
  const w = 100;
  const h = height;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const polyline = pts.join(" ");
  const areaPath = `M${pts[0]} L${pts.join(" L")} L${w},${h} L0,${h} Z`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#sg-${color.replace("#","")})`} />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, prefix = "", suffix = "", trend, trendLabel, color, sparkData, onClick }) {
  const colors = {
    emerald: { icon: "#34d399", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)", glow: "rgba(16,185,129,0.15)", spark: "#34d399" },
    blue:    { icon: "#60a5fa", bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.2)",  glow: "rgba(59,130,246,0.15)",  spark: "#60a5fa" },
    amber:   { icon: "#fbbf24", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)", glow: "rgba(245,158,11,0.15)", spark: "#fbbf24" },
    violet:  { icon: "#a78bfa", bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.2)", glow: "rgba(139,92,246,0.15)", spark: "#a78bfa" },
    red:     { icon: "#f87171", bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.2)",  glow: "rgba(239,68,68,0.15)",  spark: "#f87171" },
    cyan:    { icon: "#22d3ee", bg: "rgba(6,182,212,0.08)",  border: "rgba(6,182,212,0.2)",  glow: "rgba(6,182,212,0.15)",  spark: "#22d3ee" },
  };
  const c = colors[color] || colors.blue;
  const isPositive = trend >= 0;

  return (
    <div
      onClick={onClick}
      className="relative rounded-xl p-4 overflow-hidden transition-all duration-300 group"
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        cursor: onClick ? "pointer" : "default",
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = `0 0 24px ${c.glow}`; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${c.icon}15` }}>
            <Icon className="w-4 h-4" style={{ color: c.icon }} />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: c.icon }}>{label}</span>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-0.5 text-xs font-semibold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>

      {/* Value */}
      <div className="text-2xl font-black text-white mb-1 tracking-tight">
        <AnimatedNumber value={typeof value === "number" ? value : 0} prefix={prefix} suffix={suffix} />
      </div>

      {/* Sub label */}
      {trendLabel && (
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>{trendLabel}</p>
      )}

      {/* Sparkline */}
      <div className="mt-2 -mx-1">
        <Sparkline data={sparkData} color={c.spark} height={32} />
      </div>
    </div>
  );
}

// ─── Activity Feed Item ───────────────────────────────────────────────────────
function ActivityItem({ type, name, amount, time, currency }) {
  const typeConfig = {
    payment: { icon: CreditCard, color: "#34d399", bg: "rgba(16,185,129,0.1)", label: "Payment received" },
    suspend: { icon: AlertTriangle, color: "#fbbf24", bg: "rgba(245,158,11,0.1)", label: "Account suspended" },
    signup: { icon: UserPlus, color: "#60a5fa", bg: "rgba(59,130,246,0.1)", label: "New customer" },
    renewal: { icon: RefreshCw, color: "#a78bfa", bg: "rgba(139,92,246,0.1)", label: "Subscription renewed" },
  };
  const config = typeConfig[type] || typeConfig.payment;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor: "var(--border-subtle)" }}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: config.bg }}>
        <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{name}</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{config.label} · {time}</p>
      </div>
      {amount != null && (
        <span className="text-sm font-semibold flex-shrink-0" style={{ color: config.color }}>
          +{currency} {amount.toLocaleString()}
        </span>
      )}
    </div>
  );
}

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────
function MiniBarChart({ data = [], color = "#818cf8", label = "" }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value || 0), 1);

  return (
    <div>
      {label && <p className="text-xs font-semibold text-white/60 mb-3 uppercase tracking-wider">{label}</p>}
      <div className="flex items-end gap-1.5 h-16">
        {data.map((d, i) => {
          const pct = ((d.value || 0) / max) * 100;
          const isLast = i === data.length - 1;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
              <div
                className="w-full rounded-t-sm transition-all duration-300"
                style={{
                  height: `${Math.max(pct, 4)}%`,
                  background: isLast ? color : `${color}55`,
                  boxShadow: isLast ? `0 0 8px ${color}66` : "none",
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>{data[0]?.label}</span>
        <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

// ─── Quick Action Button ──────────────────────────────────────────────────────
function QuickAction({ icon: Icon, label, color, onClick }) {
  const colors = {
    emerald: { text: "#34d399", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.15)", hover: "rgba(16,185,129,0.15)" },
    blue:    { text: "#60a5fa", bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.15)", hover: "rgba(59,130,246,0.15)" },
    violet:  { text: "#a78bfa", bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.15)", hover: "rgba(139,92,246,0.15)" },
    amber:   { text: "#fbbf24", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.15)", hover: "rgba(245,158,11,0.15)" },
    cyan:    { text: "#22d3ee", bg: "rgba(6,182,212,0.08)",  border: "rgba(6,182,212,0.15)", hover: "rgba(6,182,212,0.15)" },
  };
  const c = colors[color] || colors.blue;
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-200"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
      onMouseEnter={e => e.currentTarget.style.background = c.hover}
      onMouseLeave={e => e.currentTarget.style.background = c.bg}
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${c.text}15` }}>
        <Icon className="w-4 h-4" style={{ color: c.text }} />
      </div>
      <span className="text-[11px] font-semibold text-center leading-tight" style={{ color: c.text }}>{label}</span>
    </button>
  );
}

// ─── Fake sparkline generator ─────────────────────────────────────────────────
function generateFakeSparkline(base = 100, points = 12, variance = 0.2) {
  const data = [];
  let current = base;
  for (let i = 0; i < points; i++) {
    current = current + (Math.random() - 0.45) * base * variance;
    data.push(Math.max(0, Math.round(current)));
  }
  return data;
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export function Dashboard() {
  const { fetchProjects } = useStore();
  const [stats, setStats] = useState(null);
  const [quickActions, setQuickActions] = useState([]);
  const [churnData, setChurnData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [currencySymbol, setCurrencySymbol] = useState("KES");
  const navigate = useNavigate();
  const toast = useToast();

  const fetchDashboardData = async () => {
    try {
      const [statsRes, actionsRes, settingsRes, churnRes] = await Promise.all([
        axios.get(`${API_URL}/dashboard/stats`),
        axios.get(`${API_URL}/dashboard/quick-actions`),
        axios.get(`${API_URL}/settings`).catch(() => ({ data: {} })),
        axios.get(`${API_URL}/analytics/churn-report`).catch(() => ({ data: null })),
      ]);
      const settings = settingsRes.data?.settings || settingsRes.data || {};
      setCurrencySymbol(settings.currency_symbol || settings.currency || "KES");
      if (statsRes.data.success) setStats(statsRes.data.stats || {});
      if (actionsRes.data.success && Array.isArray(actionsRes.data.actions)) {
        setQuickActions(actionsRes.data.actions);
      } else {
        setQuickActions([]);
      }
      if (churnRes.data?.high_risk) setChurnData(churnRes.data);
      setLastRefresh(new Date());
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboardData(); }, []);
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

  // Build monthly bar data from last 7 days (placeholder until real data)
  const weekLabels = ["M", "T", "W", "T", "F", "S", "S"];
  const weekRevenue = stats?.weeklyRevenue || weekLabels.map((_, i) => ({ label: weekLabels[i], value: Math.floor(Math.random() * 50000 + 10000) }));

  if (loading && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const iconMap = { UserPlus, MessageSquare, CreditCard, Link, Router, Key, Wifi, Activity, Zap };

  return (
    <div className="min-h-full animate-fade-in">
      {/* ── Page Header ── */}
      <div className="sticky top-0 z-10 backdrop-blur-xl border-b px-6 py-3 flex items-center justify-between"
        style={{ background: "var(--sidebar-bg)", borderColor: "var(--sidebar-border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(79,70,229,0.15)" }}>
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">Dashboard</h1>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : "Loading..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/billing-customers/new")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Plus className="w-3.5 h-3.5" /> Add Customer
          </button>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* ── KPI Cards ── */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={DollarSign}
              label="Today's Revenue"
              value={stats.todayRevenue || 0}
              prefix={`${currencySymbol} `}
              trend={stats.revenueChange || 0}
              trendLabel={`${stats.todayPayments || 0} payments today`}
              color="emerald"
              sparkData={generateFakeSparkline(stats.todayRevenue || 100)}
              onClick={() => navigate("/billing-reports")}
            />
            <KpiCard
              icon={TrendingUp}
              label="Month Revenue"
              value={stats.monthRevenue || 0}
              prefix={`${currencySymbol} `}
              trend={stats.revenueChange || 0}
              trendLabel="vs last month"
              color="blue"
              sparkData={generateFakeSparkline(stats.monthRevenue || 500)}
              onClick={() => navigate("/billing-reports")}
            />
            <KpiCard
              icon={Clock}
              label="Outstanding"
              value={stats.outstandingBalance || 0}
              prefix={`${currencySymbol} `}
              trendLabel={`${stats.overdueInvoices || 0} overdue invoices`}
              color="amber"
              sparkData={generateFakeSparkline(stats.outstandingBalance || 200, 12, 0.1)}
              onClick={() => navigate("/billing-invoices")}
            />
            <KpiCard
              icon={Users}
              label="Active Customers"
              value={stats.activeCustomers || 0}
              trend={2}
              trendLabel={`${stats.activeSubscriptions || 0} subscriptions`}
              color="violet"
              sparkData={generateFakeSparkline(stats.activeCustomers || 50, 12, 0.05)}
              onClick={() => navigate("/billing-customers")}
            />
          </div>
        )}

        {/* ── Secondary Metrics ── */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Online Sessions", value: stats.activeRadiusSessions || 0, icon: Wifi, color: "#22d3ee", route: "/radius", sub: "RADIUS active" },
              { label: "Overdue Invoices", value: stats.overdueInvoices || 0, icon: AlertTriangle, color: "#f87171", route: "/billing-invoices", sub: `${currencySymbol} ${(stats.outstandingBalance || 0).toLocaleString()}` },
              { label: "Suspended", value: stats.suspendedCustomers || 0, icon: XCircle, color: "#fbbf24", route: "/billing-auto-suspend", sub: "accounts" },
              { label: "New This Week", value: stats.recentCustomers || 0, icon: UserPlus, color: "#34d399", route: "/billing-customers", sub: "customers joined" },
            ].map((m, i) => (
              <div
                key={i}
                onClick={() => navigate(m.route)}
                className="rounded-xl p-4 cursor-pointer transition-all duration-200 hover:scale-[1.02]"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <m.icon className="w-4 h-4" style={{ color: m.color }} />
                  <ChevronRight className="w-3.5 h-3.5 opacity-30" />
                </div>
                <div className="text-2xl font-black text-white">{(m.value || 0).toLocaleString()}</div>
                <div className="text-xs font-semibold mt-0.5" style={{ color: m.color }}>{m.label}</div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{m.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Activity + Chart row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Revenue Bar Chart */}
          <div className="lg:col-span-1 rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white">Weekly Revenue</h2>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}>7 days</span>
            </div>
            <MiniBarChart
              data={weekLabels.map((l, i) => ({ label: l, value: stats?.weeklyRevenue?.[i] || Math.floor(Math.random() * 60000 + 5000) }))}
              color="#818cf8"
            />
            <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: "var(--border-subtle)" }}>
              <div>
                <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>Month total</div>
                <div className="text-lg font-bold text-white">{currencySymbol} {(stats?.monthRevenue || 0).toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>vs last month</div>
                <div className={`text-sm font-semibold ${(stats?.revenueChange || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {(stats?.revenueChange || 0) >= 0 ? "↑" : "↓"} {Math.abs(stats?.revenueChange || 0)}%
                </div>
              </div>
            </div>
          </div>

          {/* Recent Payments */}
          <div className="lg:col-span-2 rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" /> Recent Payments
              </h2>
              <button onClick={() => navigate("/billing-payments")} className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-0 overflow-hidden">
              {stats?.recentPayments?.length > 0 ? (
                stats.recentPayments.slice(0, 6).map((p, i) => (
                  <ActivityItem
                    key={p.id || i}
                    type="payment"
                    name={p.customer_name || "Unknown"}
                    amount={p.amount}
                    time={p.received_at ? new Date(p.received_at).toLocaleDateString() : ""}
                    currency={currencySymbol}
                  />
                ))
              ) : (
                <div className="text-center py-8" style={{ color: "var(--text-muted)" }}>
                  <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No recent payments</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Churn Prediction ── */}
        {churnData && churnData.high_risk?.length > 0 && (
          <div className="glass rounded-2xl p-4">
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" /> At-Risk Customers ({churnData.high_risk.length})
            </h2>
            <div className="space-y-2">
              {churnData.high_risk.slice(0, 5).map(c => (
                <div key={c.customer_id} className="flex items-center justify-between p-2 rounded-lg" style={{ background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.1)" }}>
                  <div>
                    <p className="text-sm text-white font-medium">{c.name}</p>
                    <p className="text-xs text-zinc-500">
                      {c.factors?.[0]?.detail || "Churn risk detected"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${c.score}%`,
                        background: c.score >= 70 ? "#ef4444" : c.score >= 40 ? "#f59e0b" : "#10b981"
                      }} />
                    </div>
                    <span className="text-xs font-bold" style={{ color: c.score >= 70 ? "#ef4444" : c.score >= 40 ? "#f59e0b" : "#10b981" }}>
                      {c.score}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick Actions ── */}
        {quickActions.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" /> Quick Actions
            </h2>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
              {quickActions.map(action => {
                const Icon = iconMap[action.icon] || Activity;
                return (
                  <QuickAction
                    key={action.id}
                    icon={Icon}
                    label={action.label}
                    color={action.color || "blue"}
                    onClick={() => navigate(action.route)}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
