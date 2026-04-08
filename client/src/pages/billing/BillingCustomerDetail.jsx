import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, User, Package, FileText, CreditCard, Activity, MapPin, Mail, Phone, Hash } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '/api';

export function BillingCustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchCustomer(); }, [id]);

  const fetchCustomer = async () => {
    try {
      const { data } = await axios.get(`${API}/billing/customers/${id}`);
      setCustomer(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  if (loading) return <div className="p-8 text-white">Loading...</div>;
  if (!customer) return <div className="p-8 text-white">Customer not found</div>;

  const totalBilled = customer.invoices?.reduce((s, i) => s + i.total, 0) || 0;
  const totalPaid = customer.payments?.reduce((s, p) => s + p.amount, 0) || 0;
  const outstanding = totalBilled - totalPaid;

  const statusColor = (s) => {
    const map = { paid: 'bg-green-600/20 text-green-400', pending: 'bg-amber-600/20 text-amber-400', partial: 'bg-blue-600/20 text-blue-400' };
    return map[s] || 'bg-slate-600/20 text-slate-400';
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/billing-customers')} className="text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-lg font-bold">{customer.name.charAt(0)}</div>
          <div>
            <h2 className="text-2xl font-bold text-white">{customer.name}</h2>
            <p className="text-sm text-slate-400">Customer since {new Date(customer.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <span className={`ml-auto px-3 py-1 rounded text-sm ${customer.status === 'active' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
          {customer.status}
        </span>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1"><Mail className="w-4 h-4" /> Email</div>
          <div className="text-white">{customer.email || '—'}</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1"><Phone className="w-4 h-4" /> Phone</div>
          <div className="text-white">{customer.phone || '—'}</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1"><MapPin className="w-4 h-4" /> Location</div>
          <div className="text-white">{[customer.address, customer.city, customer.country].filter(Boolean).join(', ') || '—'}</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1"><Hash className="w-4 h-4" /> ID Number</div>
          <div className="text-white">{customer.id_number || '—'}</div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 text-center">
          <div className="text-sm text-slate-400 mb-1">Total Billed</div>
          <div className="text-2xl font-bold text-white">${totalBilled.toFixed(2)}</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 text-center">
          <div className="text-sm text-slate-400 mb-1">Total Paid</div>
          <div className="text-2xl font-bold text-green-400">${totalPaid.toFixed(2)}</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 text-center">
          <div className="text-sm text-slate-400 mb-1">Outstanding</div>
          <div className={`text-2xl font-bold ${outstanding > 0 ? 'text-red-400' : 'text-green-400'}`}>${outstanding.toFixed(2)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscriptions */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-white font-semibold flex items-center gap-2"><Package className="w-4 h-4" /> Subscriptions ({customer.subscriptions?.length || 0})</h3>
          </div>
          <div className="p-4">
            {customer.subscriptions?.length === 0 ? <p className="text-slate-500 text-sm">No subscriptions</p> : (
              <div className="space-y-3">
                {customer.subscriptions?.map(sub => (
                  <div key={sub.id} className="bg-slate-700 rounded p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-medium">{sub.plan?.name || 'No plan'}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${sub.status === 'active' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>{sub.status}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {sub.pppoe_username && <span>PPPoE: {sub.pppoe_username} | </span>}
                      {sub.plan && <span>{sub.plan.speed_up}/{sub.plan.speed_down} — ${sub.plan.price}/mo</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-white font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> Invoices</h3>
            <button onClick={() => navigate('/billing-invoices')} className="text-blue-400 text-xs hover:text-blue-300">View all</button>
          </div>
          <div className="p-4">
            {customer.invoices?.length === 0 ? <p className="text-slate-500 text-sm">No invoices</p> : (
              <div className="space-y-2">
                {customer.invoices?.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between text-sm py-2 border-b border-slate-700 last:border-0">
                    <div>
                      <div className="text-white font-mono text-xs">{inv.invoice_number}</div>
                      <div className="text-slate-500 text-xs">{inv.due_date}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-semibold">${inv.total.toFixed(2)}</div>
                      <span className={`text-xs px-2 py-0.5 rounded ${statusColor(inv.status)}`}>{inv.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payments History */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg mt-6">
        <div className="p-4 border-b border-slate-700 flex items-center gap-2">
          <CreditCard className="w-4 h-4" />
          <h3 className="text-white font-semibold">Payment History ({customer.payments?.length || 0})</h3>
        </div>
        {customer.payments?.length === 0 ? <div className="p-4 text-slate-500 text-sm">No payments recorded</div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="text-left p-3">Receipt</th>
                <th className="text-left p-3">Amount</th>
                <th className="text-left p-3">Method</th>
                <th className="text-left p-3">Reference</th>
                <th className="text-left p-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {customer.payments?.map(pay => (
                <tr key={pay.id} className="border-t border-slate-700">
                  <td className="p-3 text-blue-400 font-mono text-xs">{pay.receipt_number}</td>
                  <td className="p-3 text-green-400 font-semibold">+${pay.amount.toFixed(2)}</td>
                  <td className="p-3 text-slate-300 capitalize">{pay.method.replace('_', ' ')}</td>
                  <td className="p-3 text-slate-400 text-xs">{pay.reference || '—'}</td>
                  <td className="p-3 text-slate-400 text-xs">{new Date(pay.received_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Notes */}
      {customer.notes && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg mt-6 p-4">
          <h3 className="text-white font-semibold mb-2">Notes</h3>
          <p className="text-slate-400 text-sm">{customer.notes}</p>
        </div>
      )}
    </div>
  );
}
