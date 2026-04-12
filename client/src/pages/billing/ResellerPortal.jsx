import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  UserCheck, Users, DollarSign, Package, FileText, TrendingUp, Plus, Search,
  Pencil, Trash2, ExternalLink, RefreshCw, Shield, Activity, AlertTriangle
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '/api';

function StatCard({ title, value, icon: Icon, bg, ring, textColor, sub }) {
  return (
    <div className="glass rounded-2xl p-5 card-hover group">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${bg} ring-1 ${ring} flex items-center justify-center group-hover:scale-110 transition-transform`}>
          <Icon className={`w-5 h-5 ${textColor}`} />
        </div>
      </div>
      <div className={`stat-value ${textColor}`}>{value}</div>
      <div className="text-sm text-zinc-400 mt-1">{title}</div>
      {sub && <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export function ResellerPortal() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [resellers, setResellers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchResellers(); }, []);

  const fetchResellers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(`${API}/resellers`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setResellers(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      console.error('Failed to fetch resellers:', e);
      setError('Failed to load resellers. Please refresh the page.');
      setResellers([]);
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      if (editing && editing.id) {
        await axios.put(`${API}/resellers/${editing.id}`, editing, { headers });
      } else {
        await axios.post(`${API}/resellers`, editing || {}, { headers });
      }
      
      setShowForm(false);
      setEditing(null);
      await fetchResellers();
    } catch (e) {
      console.error('Failed to save reseller:', e);
      const errorMsg = e.response?.data?.error || e.message || 'Failed to save reseller';
      setError(errorMsg);
      alert(`Error: ${errorMsg}`);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this reseller?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/resellers/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      await fetchResellers();
    } catch (e) {
      console.error('Failed to delete reseller:', e);
      alert('Failed to delete reseller');
    }
  };

  const filtered = resellers.filter(r => r.name?.toLowerCase().includes(search.toLowerCase()));
  const totalRevenue = resellers.reduce((s, r) => s + (r.total_revenue || 0), 0);
  const totalCustomers = resellers.reduce((s, r) => s + (r.customer_count || 0), 0);
  const activeResellers = resellers.filter(r => r.status === 'active').length;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'resellers', label: 'Resellers', icon: UserCheck },
  ];

  return (
    <div className="relative min-h-full p-8 animate-fade-in">
      <div className="absolute inset-0 bg-mesh" />
      <div className="absolute inset-0 bg-noise" />

      {/* Header */}
      <div className="relative flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <UserCheck className="w-4 h-4 text-white" />
            </div>
            Reseller Management
          </h1>
          <p className="text-zinc-400 mt-1">Multi-tenant reseller dashboards with commission tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchResellers} className="btn-ghost"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => { setEditing({ name: '', company: '', email: '', phone: '', commission_rate: 10, status: 'active', credit_limit: 0 }); setShowForm(true); }} className="btn-primary">
            <Plus className="w-4 h-4" /> New Reseller
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="relative mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300 flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">×</button>
        </div>
      )}

      {/* Stats */}
      <div className="relative grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Resellers" value={resellers.length} icon={UserCheck} bg="bg-indigo-500/10" ring="ring-indigo-500/20" textColor="text-indigo-400" sub={`${activeResellers} active`} />
        <StatCard title="Total Revenue" value={`KES ${totalRevenue.toFixed(2)}`} icon={DollarSign} bg="bg-emerald-500/10" ring="ring-emerald-500/20" textColor="text-emerald-400" />
        <StatCard title="Total Customers" value={totalCustomers} icon={Users} bg="bg-blue-500/10" ring="ring-blue-500/20" textColor="text-blue-400" />
        <StatCard title="Avg Commission" value={`${resellers.length > 0 ? (resellers.reduce((s, r) => s + (r.commission_rate || 0), 0) / resellers.length).toFixed(1) : 0}%`} icon={Package} bg="bg-amber-500/10" ring="ring-amber-500/20" textColor="text-amber-400" />
      </div>

      {/* Tabs */}
      <div className="relative flex gap-2 mb-6">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700/60'
            }`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search resellers..."
          className="modern-input pl-10 max-w-md" />
      </div>

      {/* Resellers Table */}
      {activeTab === 'resellers' && (
        <div className="relative glass rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">{[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
          ) : (
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Reseller</th>
                  <th>Contact</th>
                  <th>Commission</th>
                  <th>Customers</th>
                  <th>Revenue</th>
                  <th>Credit Limit</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 ring-1 ring-indigo-500/20 flex items-center justify-center text-sm font-semibold text-indigo-400 flex-shrink-0">
                          {r.name?.charAt(0) || 'R'}
                        </div>
                        <div>
                          <div className="text-white font-medium">{r.name}</div>
                          {r.company && <div className="text-xs text-zinc-500">{r.company}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      {r.email && <div className="text-sm text-zinc-300">{r.email}</div>}
                      {r.phone && <div className="text-xs text-zinc-500">{r.phone}</div>}
                    </td>
                    <td><span className="badge badge-emerald">{r.commission_rate}%</span></td>
                    <td><span className="badge badge-blue">{r.customer_count || 0}</span></td>
                    <td className="text-sm text-emerald-400 font-semibold">KES {r.total_revenue?.toFixed(2) || '0.00'}</td>
                    <td className="text-sm text-zinc-300">KES {r.credit_limit?.toFixed(2) || '0.00'}</td>
                    <td><span className={`badge ${r.status === 'active' ? 'badge-green' : 'badge-red'}`}>{r.status}</span></td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditing(r); setShowForm(true); }} className="btn-ghost p-2"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(r.id)} className="btn-ghost p-2 text-zinc-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && filtered.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon"><UserCheck className="w-6 h-6 text-zinc-600" /></div>
              <div className="empty-state-title">{search ? 'No resellers found' : 'No resellers yet'}</div>
              <div className="empty-state-desc">Add your first reseller to enable multi-tenant management</div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Resellers */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-base font-semibold text-white mb-4">Top Resellers by Revenue</h3>
            {resellers.length === 0 ? (
              <div className="text-center text-zinc-500 py-8">No resellers yet</div>
            ) : (
              <div className="space-y-3">
                {resellers.sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0)).slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-500 font-mono text-sm w-6">#{i + 1}</span>
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-semibold text-xs">{r.name?.charAt(0)}</div>
                      <span className="text-sm text-white">{r.name}</span>
                    </div>
                    <span className="text-sm text-emerald-400 font-semibold">KES {r.total_revenue?.toFixed(2) || '0.00'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Commission Summary */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-base font-semibold text-white mb-4">Commission Overview</h3>
            <div className="space-y-4">
              {resellers.filter(r => r.total_revenue > 0).map((r, i) => {
                const commission = (r.total_revenue || 0) * (r.commission_rate || 0) / 100;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-300">{r.name}</span>
                      <span className="text-sm text-zinc-400">{r.commission_rate}%</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${Math.min(100, (commission / Math.max(totalRevenue * 0.1, 1)) * 100)}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Commission: KES {commission.toFixed(2)}</span>
                      <span className="text-zinc-500">Revenue: KES {r.total_revenue?.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
              {resellers.filter(r => r.total_revenue > 0).length === 0 && (
                <div className="text-center text-zinc-500 py-8">No commission data yet</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reseller Form Modal */}
      {showForm && editing && (
        <div className="modal-backdrop" onClick={() => { setShowForm(false); setEditing(null); }}>
          <div className="glass-strong rounded-2xl w-full max-w-lg animate-fade-in-scale" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-800/50">
              <h3 className="text-lg font-semibold text-white">{editing.id ? 'Edit Reseller' : 'New Reseller'}</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Name *</label>
                  <input required value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} className="modern-input" placeholder="John Kamau" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Company</label>
                  <input value={editing.company || ''} onChange={e => setEditing({ ...editing, company: e.target.value })} className="modern-input" placeholder="Kamau ISP" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email</label>
                  <input type="email" value={editing.email || ''} onChange={e => setEditing({ ...editing, email: e.target.value })} className="modern-input" placeholder="john@kamau.co.ke" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Phone</label>
                  <input value={editing.phone || ''} onChange={e => setEditing({ ...editing, phone: e.target.value })} className="modern-input" placeholder="+254..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Commission Rate (%)</label>
                  <input type="number" value={editing.commission_rate || 10} onChange={e => setEditing({ ...editing, commission_rate: parseFloat(e.target.value) })} className="modern-input" min="0" max="100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Credit Limit</label>
                  <input type="number" value={editing.credit_limit || 0} onChange={e => setEditing({ ...editing, credit_limit: parseFloat(e.target.value) })} className="modern-input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Status</label>
                  <select value={editing.status || 'active'} onChange={e => setEditing({ ...editing, status: e.target.value })} className="modern-input">
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t border-zinc-800/50">
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary flex-1" disabled={formLoading}>Cancel</button>
                <button type="submit" className="btn-primary flex-1" disabled={formLoading}>
                  {formLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </span>
                  ) : (editing.id ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
