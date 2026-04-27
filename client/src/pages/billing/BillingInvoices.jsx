import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Download, CreditCard, Receipt, FileText, X, Send } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useToast } from '../../hooks/useToast';

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
  const toast = useToast();
  const [paymentPromptModal, setPaymentPromptModal] = useState(false);
  const [sendingPrompt, setSendingPrompt] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

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

  const sendPaymentPrompt = async (invoice) => {
    setSelectedInvoice(invoice);
    setSendingPrompt(true);
    try {
      const { data } = await axios.post(`${API}/billing/customers/${invoice.customer_id}/payment-prompt`, {
        amount: invoice.balance,
        invoice_id: invoice.id
      });
      toast.success('Payment prompt sent successfully');
    } catch (e) {
      toast.error('Failed to send payment prompt', e.response?.data?.error || e.message);
    } finally {
      setSendingPrompt(false);
    }
  };

  const filtered = filter === 'all' ? invoices : invoices.filter(i => i.status === filter);
  const totalOutstanding = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + (i.total - (i.paid_amount || 0)), 0);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white gradient-text">Invoices ({invoices.length})</h2>
          <p className="text-slate-400 mt-1">
            Outstanding: <span className="text-amber-400 font-semibold">KES {totalOutstanding.toFixed(2)}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={generateMonthly} className="btn-gradient-success flex items-center gap-2">
            <Plus className="w-4 h-4" /> Generate Monthly
          </Button>
          <Button onClick={() => setShowForm(true)} className="btn-gradient-primary flex items-center gap-2">
            <Receipt className="w-4 h-4" /> New Invoice
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {['all', 'pending', 'paid', 'partial'].map(f => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className="capitalize">
            {f}
          </Button>
        ))}
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="p-6 space-y-3">{[1,2,3,4].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-500 text-lg">No invoices found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map(inv => (
            <Card key={inv.id} className="card-gradient overflow-hidden">
              <CardHeader className="border-b border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800/50 flex items-center justify-center">
                      <FileText className="w-3.5 h-3.5 text-zinc-500" />
                    </div>
                    <div>
                      <CardTitle className="text-sm text-blue-400 font-mono">{inv.invoice_number}</CardTitle>
                      <p className="text-xs text-zinc-500">{inv.customer?.name || 'Unknown'}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    inv.status === 'paid' ? 'bg-green-600/20 text-green-400' : inv.status === 'partial' ? 'bg-blue-600/20 text-blue-400' : inv.status === 'overdue' ? 'bg-red-600/20 text-red-400' : 'bg-amber-600/20 text-amber-400'
                  }`}>
                    {inv.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-2 gap-3 text-sm border-t border-zinc-800">
                <div className="text-zinc-400">Total: <span className="text-white">KES {inv.total.toFixed(2)}</span></div>
                <div className="text-zinc-400">Paid: <span className="text-emerald-400">KES {(inv.paid_amount || 0).toFixed(2)}</span></div>
                <div className="text-zinc-400">Balance: <span className={`font-semibold ${inv.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>KES {inv.balance.toFixed(2)}</span></div>
                <div className="text-zinc-400">Due: <span className="text-white">{inv.due_date}</span></div>
              </CardContent>
              <CardContent className="p-4 border-t border-zinc-800">
                {inv.status !== 'paid' && (
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => sendPaymentPrompt(inv)}
                      disabled={sendingPrompt}
                      className="flex-1 flex items-center justify-center gap-2"
                    >
                      <Send className="w-3 h-3" /> {sendingPrompt ? 'Sending...' : 'Send Prompt'}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => navigate(`/pay/${inv.id}`)} 
                      className="flex-1 flex items-center justify-center gap-2"
                    >
                      <CreditCard className="w-3 h-3" /> Pay
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="card-glow w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>New Invoice</CardTitle>
                  <p className="text-sm text-zinc-400 mt-0.5">Bill a customer for their service</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}><X className="w-5 h-5" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4 pt-6">
                <div>
                  <Label htmlFor="customer">Customer *</Label>
                  <select id="customer" required value={form.customer_id} onChange={e => setForm({...form, customer_id: e.target.value})} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
                    <option value="">Select customer</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="plan">Plan (auto-fills price)</Label>
                  <select id="plan" onChange={e => {
                    const plan = plans.find(p => p.id === e.target.value);
                    if (plan) setForm({...form, amount: plan.price.toString()});
                  }} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
                    <option value="">Select plan</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.name} — ${p.price}/mo</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount">Amount</Label>
                    <Input id="amount" type="number" step="0.01" required value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
                  </div>
                  <div>
                    <Label htmlFor="tax">Tax</Label>
                    <Input id="tax" type="number" step="0.01" value={form.tax} onChange={e => setForm({...form, tax: e.target.value})} />
                  </div>
                </div>
                <div className="flex gap-3 pt-4 border-t border-zinc-800">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancel</Button>
                  <Button type="submit" className="btn-gradient-primary flex-1">Create Invoice</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
