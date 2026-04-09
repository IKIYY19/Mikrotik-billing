import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, DollarSign } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

const API = import.meta.env.VITE_API_URL || '/api';

export function BillingPayments() {
  const toast = useToast();
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ invoice_id: '', customer_id: '', amount: '', method: 'cash', reference: '', notes: '' });

  useEffect(() => {
    fetchPayments();
    axios.get(`${API}/billing/invoices`).then(r => setInvoices(r.data.filter(i => i.status !== 'paid')));
    axios.get(`${API}/billing/customers`).then(r => setCustomers(r.data));
  }, []);

  const fetchPayments = async () => {
    try { const { data } = await axios.get(`${API}/billing/payments`); setPayments(data); } catch (error) { console.error('Failed to fetch payments:', error); toast.error('Failed to load payments', error.response?.data?.error || error.message); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const inv = invoices.find(i => i.id === form.invoice_id);
    await axios.post(`${API}/billing/payments`, {
      invoice_id: form.invoice_id,
      customer_id: inv?.customer_id || form.customer_id,
      amount: parseFloat(form.amount),
      method: form.method,
      reference: form.reference,
      notes: form.notes,
    });
    setShowForm(false);
    setForm({ invoice_id: '', customer_id: '', amount: '', method: 'cash', reference: '', notes: '' });
    fetchPayments();
  };

  const totalReceived = payments.reduce((s, p) => s + p.amount, 0);

  const methodColors = { cash: 'text-green-400', bank: 'text-blue-400', mobile_money: 'text-purple-400', card: 'text-amber-400', other: 'text-slate-400' };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Payments ({payments.length})</h2>
          <p className="text-sm text-slate-400">Total received: <span className="text-green-400 font-semibold">${totalReceived.toFixed(2)}</span></p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          <Plus className="w-4 h-4" /> Record Payment
        </button>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="text-left p-3">Receipt</th>
              <th className="text-left p-3">Customer</th>
              <th className="text-left p-3">Invoice</th>
              <th className="text-left p-3">Amount</th>
              <th className="text-left p-3">Method</th>
              <th className="text-left p-3">Reference</th>
              <th className="text-left p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {payments.map(pay => (
              <tr key={pay.id} className="border-t border-slate-700 hover:bg-slate-700/50">
                <td className="p-3 text-blue-400 font-mono text-xs">{pay.receipt_number}</td>
                <td className="p-3 text-white">{pay.customer?.name || 'Unknown'}</td>
                <td className="p-3 text-slate-400 text-xs">{pay.invoice?.invoice_number || '-'}</td>
                <td className="p-3 text-green-400 font-semibold">+${pay.amount.toFixed(2)}</td>
                <td className={`p-3 capitalize ${methodColors[pay.method] || ''}`}>{pay.method.replace('_', ' ')}</td>
                <td className="p-3 text-slate-400 text-xs">{pay.reference || '-'}</td>
                <td className="p-3 text-slate-400 text-xs">{new Date(pay.received_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && <div className="text-center py-8 text-slate-500">No payments recorded</div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg w-full max-w-lg">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-white font-semibold flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-400" /> Record Payment</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Invoice *</label>
                <select required value={form.invoice_id} onChange={e => {
                  const inv = invoices.find(i => i.id === e.target.value);
                  setForm({...form, invoice_id: e.target.value, amount: inv ? (inv.total - (inv.paid_amount || 0)).toFixed(2) : ''});
                }} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white">
                  <option value="">Select outstanding invoice</option>
                  {invoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {inv.customer?.name} — Balance: ${(inv.total - (inv.paid_amount || 0)).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Amount *</label>
                <input type="number" step="0.01" required value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Payment Method</label>
                <select value={form.method} onChange={e => setForm({...form, method: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white">
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Reference / Transaction ID</label>
                <input value={form.reference} onChange={e => setForm({...form, reference: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" placeholder="Optional" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows="2"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" />
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 bg-slate-700 text-white rounded">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-green-600 text-white rounded">Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
