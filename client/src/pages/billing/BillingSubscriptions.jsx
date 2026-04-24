import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, Power, PowerOff, Copy, Terminal, Check, Pencil, Trash2, X } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

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
    console.log('Deleting subscription:', sub.id);
    try {
      await axios.delete(`${API}/billing/subscriptions/${sub.id}`);
      toast.success('Subscription deleted');
      fetchSubs();
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete subscription');
    }
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
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Subscriptions ({subs.length})</h2>
          <p className="text-slate-400 mt-1">Manage customer subscriptions and plans</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
          <Plus className="w-5 h-5" /> New Subscription
        </Button>
      </div>

      {subs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-500 text-lg">No subscriptions yet. Create your first subscription.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {subs.map(sub => (
            <Card key={sub.id} className="overflow-hidden">
              <CardHeader className="border-b border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{sub.customer?.name || 'Unknown'}</CardTitle>
                    <p className="text-slate-400 text-sm">{sub.plan?.name || 'No plan'}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    sub.status === 'active' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
                  }`}>
                    {sub.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-2 gap-3 text-sm border-t border-zinc-800">
                <div className="text-zinc-400">Plan: <span className="text-white">{sub.plan?.speed_up}/{sub.plan?.speed_down}</span></div>
                <div className="text-zinc-400">Price: <span className="text-white">${sub.plan?.price}/mo</span></div>
                <div className="text-zinc-400">PPPoE: <span className="text-white font-mono">{sub.pppoe_username || '—'}</span></div>
                <div className="text-zinc-400">Router: <span className="text-white">{sub.router?.name || '—'}</span></div>
                <div className="text-zinc-400">Started: <span className="text-white">{sub.start_date}</span></div>
                <div className="text-zinc-400">Cycle: <span className="text-white capitalize">{sub.billing_cycle}</span></div>
              </CardContent>
              <CardContent className="p-4 border-t border-zinc-800 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleEdit(sub)} className="flex items-center gap-1">
                  <Pencil className="w-3 h-3" /> Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(sub)} className="flex items-center gap-1 text-red-400">
                  <Trash2 className="w-3 h-3" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => toggleStatus(sub)} className={`flex items-center gap-1 ml-auto ${
                  sub.status === 'active' ? 'text-red-400' : 'text-green-400'
                }`}>
                  {sub.status === 'active' ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
                  {sub.status === 'active' ? 'Suspend' : 'Activate'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <CardTitle>{editingSub ? 'Edit Subscription' : 'New Subscription'}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setEditingSub(null); }}><X className="w-5 h-5" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4 pt-6">
                <div>
                  <Label htmlFor="customer">Customer *</Label>
                  <select id="customer" required value={form.customer_id} onChange={e => setForm({...form, customer_id: e.target.value})}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
                    <option value="">Select customer</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="plan">Service Plan *</Label>
                  <select id="plan" required value={form.plan_id} onChange={e => setForm({...form, plan_id: e.target.value})}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
                    <option value="">Select plan</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.name} — ${p.price}/mo</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="router">Router/Device (optional)</Label>
                  <select id="router" value={form.router_id} onChange={e => setForm({...form, router_id: e.target.value})}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
                    <option value="">No device linked</option>
                    {devices.map(d => <option key={d.id} value={d.id}>{d.name} ({d.provision_status})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pppoe-username">PPPoE Username</Label>
                    <Input id="pppoe-username" value={form.pppoe_username} onChange={e => setForm({...form, pppoe_username: e.target.value})} placeholder="customer01" />
                  </div>
                  <div>
                    <Label htmlFor="pppoe-password">PPPoE Password</Label>
                    <Input id="pppoe-password" type="password" value={form.pppoe_password} onChange={e => setForm({...form, pppoe_password: e.target.value})} placeholder="••••••••" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input id="start-date" type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
                  </div>
                  <div>
                    <Label htmlFor="billing-cycle">Billing Cycle</Label>
                    <select id="billing-cycle" value={form.billing_cycle} onChange={e => setForm({...form, billing_cycle: e.target.value})}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-4 border-t border-zinc-800">
                  <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingSub(null); }} className="flex-1">Cancel</Button>
                  <Button type="submit" className="flex-1">{editingSub ? 'Update Subscription' : 'Create Subscription'}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MikroTik Script Modal */}
      {showScript && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="w-3/4 max-w-4xl max-h-[80vh] flex flex-col">
            <CardHeader className="border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-green-500" />
                  MikroTik Provisioning Script
                </CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => copyScript(showScript)} className="flex items-center gap-1">
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowScript(null)}><X className="w-5 h-5" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-6">
              <div className="bg-yellow-600/20 border border-yellow-600/50 rounded p-3 mb-4">
                <p className="text-yellow-400 text-sm">⚠️ Paste this into your MikroTik terminal to apply the provisioning changes.</p>
              </div>
              <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">{showScript}</pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
