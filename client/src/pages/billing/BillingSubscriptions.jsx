import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, Power, PowerOff, Copy, Terminal, Check, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

const API = import.meta.env.VITE_API_URL || '/api';

export function BillingSubscriptions() {
  const toast = useToast();
  const [subs, setSubs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [devices, setDevices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showScript, setShowScript] = useState(null);
  const [copied, setCopied] = useState(false);
  const [editingSub, setEditingSub] = useState(null);
  const [form, setForm] = useState({ customer_id: '', plan_id: '', router_id: '', pppoe_username: '', pppoe_password: '', start_date: '', billing_cycle: 'monthly', auto_provision: true });

  useEffect(() => {
    fetchSubs();
    axios.get(`${API}/billing/customers`).then(r => setCustomers(r.data));
    axios.get(`${API}/billing/plans`).then(r => setPlans(r.data));
    axios.get(`${API}/devices`).then(r => setDevices(r.data));
  }, []);

  const fetchSubs = async () => {
    try { const { data } = await axios.get(`${API}/billing/subscriptions`); setSubs(data); } catch (error) { console.error('Failed to fetch subscriptions:', error); toast.error('Failed to load subscriptions', error.response?.data?.error || error.message); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingSub) {
      await axios.put(`${API}/billing/subscriptions/${editingSub.id}`, form);
      toast.success('Subscription updated');
    } else {
      const { data } = await axios.post(`${API}/billing/subscriptions`, {
        ...form,
        start_date: form.start_date || new Date().toISOString().split('T')[0],
      });
      if (data.provision_script) {
        setShowScript(data.provision_script);
      }
    }
    setShowForm(false);
    setEditingSub(null);
    setForm({ customer_id: '', plan_id: '', router_id: '', pppoe_username: '', pppoe_password: '', start_date: '', billing_cycle: 'monthly', auto_provision: true });
    fetchSubs();
  };

  const handleEdit = (sub) => {
    setEditingSub(sub);
    setForm({
      customer_id: sub.customer_id,
      plan_id: sub.plan_id,
      router_id: sub.router_id || '',
      pppoe_username: sub.pppoe_username || '',
      pppoe_password: sub.pppoe_password || '',
      start_date: sub.start_date,
      billing_cycle: sub.billing_cycle,
      auto_provision: sub.auto_provision,
    });
    setShowForm(true);
  };

  const handleDelete = async (sub) => {
    if (!confirm(`Are you sure you want to delete subscription for ${sub.customer?.name}?`)) return;
    await axios.delete(`${API}/billing/subscriptions/${sub.id}`);
    toast.success('Subscription deleted');
    fetchSubs();
  };

  const toggleStatus = async (sub) => {
    const { data } = await axios.post(`${API}/billing/subscriptions/${sub.id}/toggle`);
    fetchSubs();
    if (data.provision_script) {
      setShowScript(data.provision_script);
    }
  };

  const copyScript = (script) => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Subscriptions ({subs.length})</h2>
        <button onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Subscription
        </button>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="text-left p-3">Customer</th>
              <th className="text-left p-3">Plan</th>
              <th className="text-left p-3">PPPoE</th>
              <th className="text-left p-3">Router</th>
              <th className="text-left p-3">Started</th>
              <th className="text-left p-3">Cycle</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subs.map(sub => (
              <tr key={sub.id} className="border-t border-slate-700 hover:bg-slate-700/50">
                <td className="p-3 text-white">{sub.customer?.name || 'Unknown'}</td>
                <td className="p-3">
                  <div className="text-white">{sub.plan?.name || 'No plan'}</div>
                  {sub.plan && <div className="text-slate-500 text-xs">{sub.plan.speed_up}/{sub.plan.speed_down} — ${sub.plan.price}/mo</div>}
                </td>
                <td className="p-3">
                  {sub.pppoe_username ? (
                    <div className="text-blue-400 font-mono text-xs">{sub.pppoe_username}</div>
                  ) : <span className="text-slate-500 text-xs">—</span>}
                </td>
                <td className="p-3 text-slate-400 text-xs">{sub.router?.name || '—'}</td>
                <td className="p-3 text-slate-400 text-xs">{sub.start_date}</td>
                <td className="p-3 text-slate-400 text-xs capitalize">{sub.billing_cycle}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    sub.status === 'active' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
                  }`}>{sub.status}</span>
                </td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => handleEdit(sub)}
                      className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center gap-1">
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button onClick={() => handleDelete(sub)}
                      className="px-2 py-1.5 rounded text-xs bg-red-600/20 text-red-400 hover:bg-red-600/30 flex items-center gap-1">
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <button onClick={() => toggleStatus(sub)}
                      className={`px-3 py-1.5 rounded text-xs flex items-center gap-1 ${
                        sub.status === 'active'
                          ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                          : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                      }`}>
                      {sub.status === 'active' ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
                      {sub.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {subs.length === 0 && <div className="text-center py-8 text-slate-500">No subscriptions yet</div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg w-full max-w-lg">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-white font-semibold">{editingSub ? 'Edit Subscription' : 'New Subscription'}</h3>
              <button onClick={() => { setShowForm(false); setEditingSub(null); }} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Customer *</label>
                <select required value={form.customer_id} onChange={e => setForm({...form, customer_id: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white">
                  <option value="">Select customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Service Plan *</label>
                <select required value={form.plan_id} onChange={e => setForm({...form, plan_id: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white">
                  <option value="">Select plan</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name} — ${p.price}/mo</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Router/Device (optional)</label>
                <select value={form.router_id} onChange={e => setForm({...form, router_id: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white">
                  <option value="">No device linked</option>
                  {devices.map(d => <option key={d.id} value={d.id}>{d.name} ({d.provision_status})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">PPPoE Username</label>
                  <input value={form.pppoe_username} onChange={e => setForm({...form, pppoe_username: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" placeholder="customer01" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">PPPoE Password</label>
                  <input value={form.pppoe_password} onChange={e => setForm({...form, pppoe_password: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" placeholder="••••••••" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Start Date</label>
                  <input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Billing Cycle</label>
                  <select value={form.billing_cycle} onChange={e => setForm({...form, billing_cycle: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white">
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-slate-300">
                <input type="checkbox" checked={form.auto_provision} onChange={e => setForm({...form, auto_provision: e.target.checked})} />
                Auto-provision MikroTik PPPoE on activate
              </label>
              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <button type="button" onClick={() => { setShowForm(false); setEditingSub(null); }} className="flex-1 px-4 py-2 bg-slate-700 text-white rounded">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded">{editingSub ? 'Update Subscription' : 'Create Subscription'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MikroTik Script Modal */}
      {showScript && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg w-3/4 max-w-4xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Terminal className="w-5 h-5 text-green-500" />
                MikroTik Provisioning Script
              </h3>
              <div className="flex gap-2">
                <button onClick={() => copyScript(showScript)}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1">
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button onClick={() => setShowScript(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="bg-yellow-600/20 border border-yellow-600/50 rounded p-3 mb-4">
                <p className="text-yellow-400 text-sm">⚠️ Paste this into your MikroTik terminal to apply the provisioning changes.</p>
              </div>
              <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">{showScript}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
