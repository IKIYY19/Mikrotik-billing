import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Tag, Plus, Edit3, Trash2, Ticket, Percent, DollarSign, Clock, CheckCircle, XCircle, Copy } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

const API = import.meta.env.VITE_API_URL || '/api';

export function PromoCampaigns() {
  const toast = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '', code: '', description: '', type: 'percentage', value: '',
    max_uses: '', max_uses_per_customer: 1, min_invoice_amount: '',
    applies_to: 'all', starts_at: '', ends_at: '', status: 'active',
  });
  const [showRedemptions, setShowRedemptions] = useState(null);
  const [redemptions, setRedemptions] = useState([]);

  useEffect(() => { fetchCampaigns(); }, []);

  const fetchCampaigns = async () => {
    try {
      const { data } = await axios.get(`${API}/promos/campaigns`);
      setCampaigns(data);
    } catch (err) {
      toast.error('Failed to load promo campaigns', err.response?.data?.error || err.message);
    }
  };

  const resetForm = () => {
    setForm({
      name: '', code: '', description: '', type: 'percentage', value: '',
      max_uses: '', max_uses_per_customer: 1, min_invoice_amount: '',
      applies_to: 'all', starts_at: '', ends_at: '', status: 'active',
    });
    setEditing(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        value: parseFloat(form.value) || 0,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        max_uses_per_customer: parseInt(form.max_uses_per_customer) || 1,
        min_invoice_amount: form.min_invoice_amount ? parseFloat(form.min_invoice_amount) : null,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : undefined,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      };
      if (editing) {
        await axios.put(`${API}/promos/campaigns/${editing.id}`, payload);
        toast.success('Campaign updated');
      } else {
        await axios.post(`${API}/promos/campaigns`, payload);
        toast.success('Campaign created');
      }
      fetchCampaigns();
      setShowForm(false);
      resetForm();
    } catch (err) {
      toast.error('Failed to save campaign', err.response?.data?.error || err.message);
    }
  };

  const handleEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name || '', code: c.code || '', description: c.description || '',
      type: c.type || 'percentage', value: String(c.value || ''),
      max_uses: c.max_uses ? String(c.max_uses) : '',
      max_uses_per_customer: c.max_uses_per_customer || 1,
      min_invoice_amount: c.min_invoice_amount ? String(c.min_invoice_amount) : '',
      applies_to: c.applies_to || 'all',
      starts_at: c.starts_at ? new Date(c.starts_at).toISOString().slice(0, 16) : '',
      ends_at: c.ends_at ? new Date(c.ends_at).toISOString().slice(0, 16) : '',
      status: c.status || 'active',
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this promo campaign? This cannot be undone.')) return;
    try {
      await axios.delete(`${API}/promos/campaigns/${id}`);
      toast.success('Campaign deleted');
      fetchCampaigns();
    } catch (err) {
      toast.error('Failed to delete campaign', err.response?.data?.error || err.message);
    }
  };

  const fetchRedemptions = async (campaignId) => {
    try {
      const { data } = await axios.get(`${API}/promos/campaigns/${campaignId}/redemptions`);
      setRedemptions(data);
      setShowRedemptions(campaignId);
    } catch (err) {
      toast.error('Failed to load redemptions', err.response?.data?.error || err.message);
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };

  const isExpired = (c) => c.ends_at && new Date(c.ends_at) < new Date();
  const isUpcoming = (c) => new Date(c.starts_at) > new Date();

  const getStatusBadge = (c) => {
    if (c.status !== 'active') return <span className="px-2 py-0.5 rounded-full text-xs bg-slate-600 text-slate-200">Inactive</span>;
    if (isExpired(c)) return <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">Expired</span>;
    if (isUpcoming(c)) return <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400">Upcoming</span>;
    if (c.max_uses && c.used_count >= c.max_uses) return <span className="px-2 py-0.5 rounded-full text-xs bg-orange-500/20 text-orange-400">Maxed Out</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">Active</span>;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Tag className="w-6 h-6 text-emerald-400" /> Promo Campaigns
          </h2>
          <p className="text-sm text-slate-400">Discount codes and seasonal promotions</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">{editing ? 'Edit Campaign' : 'Create Promo Campaign'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Campaign Name *</label>
                  <input
                    type="text" required value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Promo Code (leave blank to auto-generate)</label>
                  <input
                    type="text" value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="AUTO"
                    className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-emerald-500 outline-none uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-1 block">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Discount Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-emerald-500 outline-none"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">
                    {form.type === 'percentage' ? 'Discount %' : 'Discount Amount'} *
                  </label>
                  <input
                    type="number" required step="0.01" value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Max Total Uses (blank = unlimited)</label>
                  <input
                    type="number" value={form.max_uses}
                    onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                    className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Max Uses Per Customer</label>
                  <input
                    type="number" value={form.max_uses_per_customer}
                    onChange={(e) => setForm({ ...form, max_uses_per_customer: e.target.value })}
                    className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-1 block">Minimum Invoice Amount (blank = none)</label>
                <input
                  type="number" step="0.01" value={form.min_invoice_amount}
                  onChange={(e) => setForm({ ...form, min_invoice_amount: e.target.value })}
                  className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Start Date</label>
                  <input
                    type="datetime-local" value={form.starts_at}
                    onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                    className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">End Date (blank = no expiry)</label>
                  <input
                    type="datetime-local" value={form.ends_at}
                    onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                    className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-1 block">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-emerald-500 outline-none"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="expired">Expired</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors">
                  {editing ? 'Update' : 'Create'} Campaign
                </button>
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRedemptions && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowRedemptions(null)}>
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto border border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Redemption History</h3>
            {redemptions.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No redemptions yet</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-slate-400 text-sm border-b border-slate-700">
                    <th className="text-left pb-2">Customer ID</th>
                    <th className="text-right pb-2">Discount</th>
                    <th className="text-right pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {redemptions.map((r) => (
                    <tr key={r.id} className="border-b border-slate-700/50">
                      <td className="py-2 text-slate-300 text-sm">{r.customer_id ? r.customer_id.substring(0, 8) + '...' : 'Anonymous'}</td>
                      <td className="py-2 text-right text-green-400 text-sm">${parseFloat(r.discount_amount).toFixed(2)}</td>
                      <td className="py-2 text-right text-slate-400 text-sm">{new Date(r.redeemed_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button onClick={() => setShowRedemptions(null)} className="mt-4 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg">Close</button>
          </div>
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="text-center py-20">
          <Ticket className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No promo campaigns yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => (
            <div key={c.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 hover:border-emerald-600/50 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-white text-lg">{c.name}</h3>
                  <div className="flex items-center gap-1 mt-1">
                    <code className="text-emerald-400 font-mono text-sm bg-emerald-500/10 px-2 py-0.5 rounded">{c.code}</code>
                    <button onClick={() => copyCode(c.code)} className="text-slate-500 hover:text-emerald-400 transition-colors">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {getStatusBadge(c)}
              </div>

              {c.description && <p className="text-slate-400 text-sm mb-3">{c.description}</p>}

              <div className="flex items-center gap-2 mb-3">
                {c.type === 'percentage' ? (
                  <Percent className="w-4 h-4 text-emerald-400" />
                ) : (
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                )}
                <span className="text-2xl font-bold text-white">
                  {c.type === 'percentage' ? `${c.value}%` : `$${parseFloat(c.value).toFixed(2)}`}
                </span>
                <span className="text-slate-500 text-sm">off</span>
              </div>

              <div className="space-y-1.5 text-sm text-slate-400">
                <div className="flex justify-between">
                  <span>Used</span>
                  <span className="text-slate-300">{c.used_count || 0}{c.max_uses ? ` / ${c.max_uses}` : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span>Per customer</span>
                  <span className="text-slate-300">{c.max_uses_per_customer}x</span>
                </div>
                {c.min_invoice_amount && (
                  <div className="flex justify-between">
                    <span>Min invoice</span>
                    <span className="text-slate-300">${parseFloat(c.min_invoice_amount).toFixed(2)}</span>
                  </div>
                )}
                {c.ends_at && (
                  <div className="flex justify-between">
                    <span>Ends</span>
                    <span className="text-slate-300">{new Date(c.ends_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4 pt-3 border-t border-slate-700/50">
                <button onClick={() => fetchRedemptions(c.id)} className="text-slate-400 hover:text-cyan-400 text-sm flex items-center gap-1 transition-colors">
                  <Ticket className="w-3.5 h-3.5" /> Redemptions
                </button>
                <button onClick={() => handleEdit(c)} className="text-slate-400 hover:text-blue-400 text-sm flex items-center gap-1 transition-colors ml-auto">
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => handleDelete(c.id)} className="text-slate-400 hover:text-red-400 text-sm flex items-center gap-1 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
