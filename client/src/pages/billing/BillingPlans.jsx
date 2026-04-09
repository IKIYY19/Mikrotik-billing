import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Zap } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

const API = import.meta.env.VITE_API_URL || '/api';

export function BillingPlans() {
  const toast = useToast();
  const [plans, setPlans] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', speed_up: '10M', speed_down: '10M', price: 25, quota_gb: '', priority: 8, description: '' });

  useEffect(() => { fetchPlans(); }, []);
  const fetchPlans = async () => {
    try { const { data } = await axios.get(`${API}/billing/plans`); setPlans(data); } catch (error) { console.error('Failed to fetch plans:', error); toast.error('Failed to load plans', error.response?.data?.error || error.message); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editing) {
      await axios.put(`${API}/billing/plans/${editing.id}`, form);
    } else {
      await axios.post(`${API}/billing/plans`, form);
    }
    setShowForm(false); setEditing(null);
    setForm({ name: '', speed_up: '10M', speed_down: '10M', price: 25, quota_gb: '', priority: 8, description: '' });
    fetchPlans();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this plan?')) return;
    await axios.delete(`${API}/billing/plans/${id}`);
    fetchPlans();
  };

  const speeds = ['1M', '2M', '5M', '10M', '15M', '20M', '25M', '50M', '100M', '200M', '500M', '1G'];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">Service Plans ({plans.length})</h2>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm({ name: '', speed_up: '10M', speed_down: '10M', price: 25, quota_gb: '', priority: 8, description: '' }); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map(plan => (
          <div key={plan.id} className="bg-slate-800 border border-slate-700 rounded-lg p-5 relative group">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <h3 className="text-white font-semibold">{plan.name}</h3>
              </div>
              <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                <button onClick={() => { setEditing(plan); setForm({ name: plan.name, speed_up: plan.speed_up, speed_down: plan.speed_down, price: plan.price, quota_gb: plan.quota_gb, priority: plan.priority, description: plan.description }); setShowForm(true); }}
                  className="text-slate-400 hover:text-blue-400"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(plan.id)} className="text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>

            <p className="text-sm text-slate-400 mb-4">{plan.description}</p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-700 rounded p-2 text-center">
                <div className="text-xs text-slate-400">Speed</div>
                <div className="text-white font-bold">{plan.speed_up}/{plan.speed_down}</div>
              </div>
              <div className="bg-slate-700 rounded p-2 text-center">
                <div className="text-xs text-slate-400">Price</div>
                <div className="text-green-400 font-bold">${plan.price}/mo</div>
              </div>
              <div className="bg-slate-700 rounded p-2 text-center">
                <div className="text-xs text-slate-400">Quota</div>
                <div className="text-white font-bold">{plan.quota_gb ? `${plan.quota_gb}GB` : 'Unlimited'}</div>
              </div>
              <div className="bg-slate-700 rounded p-2 text-center">
                <div className="text-xs text-slate-400">Priority</div>
                <div className="text-white font-bold">{plan.priority}</div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">{plan.active_subscribers} active subscriber{plan.active_subscribers !== 1 ? 's' : ''}</span>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg w-full max-w-lg">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-white font-semibold">{editing ? 'Edit Plan' : 'New Plan'}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Plan Name *</label>
                <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" placeholder="Gold 25M" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Upload Speed</label>
                  <select value={form.speed_up} onChange={e => setForm({...form, speed_up: e.target.value})} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white">
                    {speeds.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Download Speed</label>
                  <select value={form.speed_down} onChange={e => setForm({...form, speed_down: e.target.value})} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white">
                    {speeds.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Monthly Price ($)</label>
                  <input type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price: parseFloat(e.target.value)})} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Quota (GB, blank=unlimited)</label>
                  <input type="number" value={form.quota_gb || ''} onChange={e => setForm({...form, quota_gb: e.target.value ? parseInt(e.target.value) : null})} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Priority (1=highest, 8=lowest)</label>
                <input type="number" min="1" max="8" value={form.priority} onChange={e => setForm({...form, priority: parseInt(e.target.value)})} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows="2" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" />
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 bg-slate-700 text-white rounded">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded">{editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
