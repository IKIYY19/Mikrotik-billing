import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Download, CreditCard, Receipt, FileText } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '/api';

export function BillingInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ customer_id: '', subscription_id: '', amount: '', tax: '' });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/billing/invoices`),
      axios.get(`${API}/billing/customers`),
      axios.get(`${API}/billing/plans`),
    ]).then(([i, c, p]) => {
      setInvoices(i.data);
      setCustomers(c.data);
      setPlans(p.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await axios.post(`${API}/billing/invoices`, { ...form, amount: parseFloat(form.amount), tax: parseFloat(form.tax || 0) });
    setShowForm(false); setForm({ customer_id: '', subscription_id: '', amount: '', tax: '' });
    const { data } = await axios.get(`${API}/billing/invoices`); setInvoices(data);
  };

  const generateMonthly = async () => {
    if (!confirm('Generate invoices for all active subscriptions?')) return;
    await axios.post(`${API}/billing/invoices/generate-monthly`);
    const { data } = await axios.get(`${API}/billing/invoices`); setInvoices(data);
  };

  const filtered = filter === 'all' ? invoices : invoices.filter(i => i.status === filter);
  const totalOutstanding = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + (i.total - (i.paid_amount || 0)), 0);

  return (
    <div className="relative min-h-full p-8 animate-fade-in">
      <div className="absolute inset-0 bg-mesh" />
      <div className="absolute inset-0 bg-noise" />

      {/* Header */}
      <div className="relative flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Invoices</h1>
          <p className="text-zinc-400 mt-1">
            {invoices.length} total • Outstanding: <span className="text-amber-400 font-semibold">${totalOutstanding.toFixed(2)}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={generateMonthly} className="btn-success">
            <Plus className="w-4 h-4" /> Generate Monthly
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Receipt className="w-4 h-4" /> New Invoice
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="relative flex gap-2 mb-6">
        {['all', 'pending', 'paid', 'partial'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 capitalize ${
              filter === f ? 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}>
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="relative glass rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[1,2,3,4].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
        ) : (
          <table className="modern-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Due Date</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800/50 flex items-center justify-center">
                        <FileText className="w-3.5 h-3.5 text-zinc-500" />
                      </div>
                      <span className="text-blue-400 font-mono text-xs">{inv.invoice_number}</span>
                    </div>
                  </td>
                  <td className="text-white font-medium">{inv.customer?.name || 'Unknown'}</td>
                  <td className="text-white tabular-nums">KES {inv.total.toFixed(2)}</td>
                  <td className="text-emerald-400 tabular-nums">KES {(inv.paid_amount || 0).toFixed(2)}</td>
                  <td className={`font-semibold tabular-nums ${inv.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>KES {inv.balance.toFixed(2)}</td>
                  <td className="text-zinc-400 text-sm">{inv.due_date}</td>
                  <td><span className={`badge ${inv.status === 'paid' ? 'badge-green' : inv.status === 'partial' ? 'badge-blue' : inv.status === 'overdue' ? 'badge-red' : 'badge-amber'}`}>{inv.status}</span></td>
                  <td className="text-right">
                    {inv.status !== 'paid' && (
                      <button onClick={() => navigate(`/pay/${inv.id}`)} className="btn-primary text-xs px-3 py-1.5">
                        <CreditCard className="w-3 h-3" /> Pay
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon"><Receipt className="w-6 h-6 text-zinc-600" /></div>
            <div className="empty-state-title">No invoices found</div>
            <div className="empty-state-desc">{filter !== 'all' ? 'No invoices match this filter' : 'Generate monthly invoices or create one manually'}</div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="glass-strong rounded-2xl w-full max-w-lg animate-fade-in-scale" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-800/50 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-white">New Invoice</h3>
                <p className="text-sm text-zinc-400 mt-0.5">Bill a customer for their service</p>
              </div>
              <button onClick={() => setShowForm(false)} className="btn-ghost p-2">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Customer *</label>
                <select required value={form.customer_id} onChange={e => setForm({...form, customer_id: e.target.value})} className="modern-input">
                  <option value="">Select customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Plan (auto-fills price)</label>
                <select onChange={e => {
                  const plan = plans.find(p => p.id === e.target.value);
                  if (plan) setForm({...form, amount: plan.price.toString()});
                }} className="modern-input">
                  <option value="">Select plan</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name} — ${p.price}/mo</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Amount</label>
                  <input type="number" step="0.01" required value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="modern-input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Tax</label>
                  <input type="number" step="0.01" value={form.tax} onChange={e => setForm({...form, tax: e.target.value})} className="modern-input" />
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t border-zinc-800/50">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Create Invoice</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
