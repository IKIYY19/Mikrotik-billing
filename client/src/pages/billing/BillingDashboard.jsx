import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  DollarSign, Users, Package, FileText, CreditCard, TrendingUp,
  AlertTriangle, Clock, ArrowRight, Activity, Plus, UserPlus, Receipt
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '/api';

/* ─── Stat Card with Sparkline ─── */
function StatCard({ label, value, icon: Icon, gradient, bg, ring, textColor, sub, trend }) {
  const numValue = typeof value === 'number' ? value : parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
  return (
    <div className="glass rounded-2xl p-5 card-hover group">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${bg} ring-1 ${ring} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`w-5 h-5 ${textColor}`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            <TrendingUp className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className={`stat-value ${textColor}`}>
        {typeof value === 'string' ? value : <AnimatedNumber value={numValue} prefix={value < 0 ? '-' : ''} />}
      </div>
      <div className="flex items-center justify-between mt-1">
        <div className="text-sm text-zinc-400">{label}</div>
        {sub && <div className="text-xs text-zinc-500">{sub}</div>}
      </div>
    </div>
  );
}

/* ─── Animated Number ─── */
function AnimatedNumber({ value, prefix = '' }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 600;
    const steps = 25;
    const stepTime = duration / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += value / steps;
      setDisplay(Math.round(current * 100) / 100);
      if (current >= value) { clearInterval(timer); setDisplay(value); }
    }, stepTime);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{prefix}{typeof value === 'number' && value % 1 !== 0 ? display.toFixed(2) : Math.round(display)}</span>;
}

/* ─── Skeleton ─── */
function SkeletonRow() {
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-800/30">
      <div className="flex items-center gap-3">
        <div className="skeleton w-9 h-9 rounded-xl" />
        <div>
          <div className="skeleton w-28 h-4 rounded mb-1.5" />
          <div className="skeleton w-20 h-3 rounded" />
        </div>
      </div>
      <div className="skeleton w-16 h-5 rounded-full" />
    </div>
  );
}

export function BillingDashboard() {
  const [stats, setStats] = useState(null);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/billing/dashboard`),
      axios.get(`${API}/billing/invoices`),
      axios.get(`${API}/billing/payments`),
    ]).then(([s, i, p]) => {
      setStats(s.data);
      setRecentInvoices((i.data.data || i.data).slice(0, 5));
      setRecentPayments((p.data.data || p.data).slice(0, 5));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 animate-fade-in">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Monthly Revenue', value: stats.monthly_revenue, icon: DollarSign, gradient: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20', textColor: 'text-emerald-400', prefix: '$' },
    { label: 'MRR', value: stats.mrr, icon: TrendingUp, gradient: 'from-blue-500 to-blue-600', bg: 'bg-blue-500/10', ring: 'ring-blue-500/20', textColor: 'text-blue-400', prefix: '$' },
    { label: 'ARPU', value: stats.arpu, icon: Activity, gradient: 'from-violet-500 to-violet-600', bg: 'bg-violet-500/10', ring: 'ring-violet-500/20', textColor: 'text-violet-400', prefix: '$' },
    { label: 'Active Customers', value: stats.active_customers, icon: Users, gradient: 'from-cyan-500 to-cyan-600', bg: 'bg-cyan-500/10', ring: 'ring-cyan-500/20', textColor: 'text-cyan-400', sub: `of ${stats.total_customers}` },
    { label: 'Active Subs', value: stats.active_subscriptions, icon: Package, gradient: 'from-green-500 to-green-600', bg: 'bg-green-500/10', ring: 'ring-green-500/20', textColor: 'text-green-400', sub: `of ${stats.total_subscriptions}` },
    { label: 'Suspended', value: stats.suspended_subscriptions, icon: Clock, gradient: 'from-red-500 to-red-600', bg: 'bg-red-500/10', ring: 'ring-red-500/20', textColor: 'text-red-400' },
    { label: 'Outstanding', value: stats.total_outstanding, icon: AlertTriangle, gradient: 'from-amber-500 to-amber-600', bg: 'bg-amber-500/10', ring: 'ring-amber-500/20', textColor: 'text-amber-400', prefix: '$' },
    { label: 'Overdue Invoices', value: stats.overdue_invoices, icon: FileText, gradient: 'from-orange-500 to-orange-600', bg: 'bg-orange-500/10', ring: 'ring-orange-500/20', textColor: 'text-orange-400' },
  ];

  return (
    <div className="relative min-h-full p-8 animate-fade-in">
      <div className="absolute inset-0 bg-mesh" />
      <div className="absolute inset-0 bg-noise" />

      {/* Header */}
      <div className="relative mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Billing Dashboard</h1>
        <p className="text-zinc-400 mt-1">Manage customers, invoices, payments and revenue</p>
      </div>

      {/* Stats Grid */}
      <div className="relative grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map((card, i) => (
          <StatCard key={i} {...card} trend={i === 0 ? 12 : undefined} />
        ))}
      </div>

      {/* Quick Actions */}
      <div className="relative glass rounded-2xl p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-zinc-300">Quick Actions</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => navigate('/billing-customers')} className="btn-secondary">
            <UserPlus className="w-4 h-4" /> New Customer
          </button>
          <button onClick={() => navigate('/billing-invoices')} className="btn-primary">
            <Receipt className="w-4 h-4" /> Generate Invoices
          </button>
          <button onClick={() => navigate('/billing-payments')} className="btn-success">
            <CreditCard className="w-4 h-4" /> Record Payment
          </button>
          <button onClick={() => navigate('/billing-wallet')} className="btn-secondary">
            <DollarSign className="w-4 h-4" /> Top Up Wallet
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <FileText className="w-4 h-4 text-zinc-500" /> Recent Invoices
            </h3>
            <button onClick={() => navigate('/billing-invoices')} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {recentInvoices.length === 0 ? (
            <div className="py-8 text-center">
              <div className="empty-state-icon">
                <FileText className="w-6 h-6 text-zinc-600" />
              </div>
              <div className="empty-state-desc">No invoices yet</div>
            </div>
          ) : (
            <div className="space-y-0">
              {recentInvoices.map((inv, i) => (
                <div key={inv.id} className="flex items-center justify-between py-3 border-b border-zinc-800/30 last:border-0 animate-slide-in-right" style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-zinc-800/50 flex items-center justify-center">
                      <span className="text-xs font-semibold text-zinc-400">{inv.invoice_number?.slice(-2) || '??'}</span>
                    </div>
                    <div>
                      <div className="text-sm text-white font-medium">{inv.customer?.name || 'Unknown'}</div>
                      <div className="text-xs text-zinc-500">{inv.invoice_number}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-white font-semibold">${inv.total.toFixed(2)}</div>
                    <span className={`badge ${inv.status === 'paid' ? 'badge-green' : inv.status === 'partial' ? 'badge-blue' : 'badge-amber'}`}>{inv.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Payments */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-zinc-500" /> Recent Payments
            </h3>
            <button onClick={() => navigate('/billing-payments')} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {recentPayments.length === 0 ? (
            <div className="py-8 text-center">
              <div className="empty-state-icon">
                <CreditCard className="w-6 h-6 text-zinc-600" />
              </div>
              <div className="empty-state-desc">No payments recorded</div>
            </div>
          ) : (
            <div className="space-y-0">
              {recentPayments.map((pay, i) => (
                <div key={pay.id} className="flex items-center justify-between py-3 border-b border-zinc-800/30 last:border-0 animate-slide-in-right" style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-sm text-white font-medium">{pay.customer?.name || 'Unknown'}</div>
                      <div className="text-xs text-zinc-500 capitalize">{pay.method?.replace('_', ' ')} • {pay.receipt_number}</div>
                    </div>
                  </div>
                  <div className="text-emerald-400 font-semibold text-sm">+${pay.amount.toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
