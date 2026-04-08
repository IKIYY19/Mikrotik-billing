import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Search, ExternalLink, UserPlus, Trash2, Pencil, ChevronRight, Wifi, Zap, ArrowUpRight, ArrowDownRight, Clock, RefreshCw } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '/api';

/* ─── Online Status Badge ─── */
function OnlineStatus({ customer, connections, selectedConnection, onConnectionChange }) {
  const [status, setStatus] = useState(null); // null = unknown, 'online' = online, 'offline' = offline

  useEffect(() => {
    if (!selectedConnection || !customer) { setStatus(null); return; }
    const check = async () => {
      try {
        const { data } = await axios.get(`${API}/billing/customers/online-status?connection_id=${selectedConnection}`);
        if (data.online?.[customer.id]) {
          setStatus(data.online[customer.id]);
        } else {
          setStatus('offline');
        }
      } catch (e) { setStatus(null); }
    };
    check();
    const interval = setInterval(check, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [customer?.id, selectedConnection]);

  if (!selectedConnection) return null;
  if (status === null) return <span className="text-xs text-zinc-600">—</span>;
  if (status === 'offline') return <span className="text-xs text-zinc-600">Offline</span>;

  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-emerald-400 status-dot" />
      <span className="text-xs text-emerald-400 font-medium">Online</span>
      <span className="text-[10px] text-zinc-500">{status.uptime || '—'}</span>
      {status.type === 'pppoe' && <Wifi className="w-3 h-3 text-blue-400" />}
      {status.type === 'hotspot' && <Zap className="w-3 h-3 text-amber-400" />}
    </div>
  );
}

export function BillingCustomers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', city: '', country: '', id_number: '', status: 'active', notes: '' });
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState('');
  const [onlineData, setOnlineData] = useState({});
  const [onlineLoading, setOnlineLoading] = useState(false);

  useEffect(() => { fetchCustomers(); fetchConnections(); }, []);
  useEffect(() => { if (selectedConnection) fetchOnlineStatus(); }, [selectedConnection]);

  const fetchCustomers = async () => {
    setLoading(true);
    try { const { data } = await axios.get(`${API}/billing/customers`); setCustomers(data); } catch (e) {}
    setLoading(false);
  };

  const fetchConnections = async () => {
    try { const { data } = await axios.get(`${API}/mikrotik`); setConnections(data); } catch (e) {}
  };

  const fetchOnlineStatus = async () => {
    setOnlineLoading(true);
    try {
      const { data } = await axios.get(`${API}/billing/customers/online-status?connection_id=${selectedConnection}`);
      setOnlineData(data.online || {});
    } catch (e) { setOnlineData({}); }
    setOnlineLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editing) await axios.put(`${API}/billing/customers/${editing.id}`, form);
    else await axios.post(`${API}/billing/customers`, form);
    setShowForm(false); setEditing(null);
    setForm({ name: '', email: '', phone: '', address: '', city: '', country: '', id_number: '', status: 'active', notes: '' });
    fetchCustomers();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this customer?')) return;
    await axios.delete(`${API}/billing/customers/${id}`);
    fetchCustomers();
  };

  const editCustomer = (c) => {
    setEditing(c);
    setForm({ name: c.name, email: c.email || '', phone: c.phone || '', address: c.address || '', city: c.city || '', country: c.country || '', id_number: c.id_number || '', status: c.status, notes: c.notes || '' });
    setShowForm(true);
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
    (c.phone && c.phone.includes(search))
  );

  return (
    <div className="relative min-h-full p-8 animate-fade-in">
      <div className="absolute inset-0 bg-mesh" />
      <div className="absolute inset-0 bg-noise" />

      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Customers</h1>
          <p className="text-zinc-400 mt-1">{customers.length} total • {filtered.length} shown</p>
          {selectedConnection && onlineData && (
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-sm text-emerald-400">{Object.keys(onlineData).length} online</span>
              <span className="text-sm text-zinc-500">•</span>
              <span className="text-sm text-zinc-500">{customers.length - Object.keys(onlineData).length} offline</span>
              {onlineLoading && <RefreshCw className="w-3 h-3 text-zinc-500 animate-spin" />}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {connections.length > 0 && (
            <select value={selectedConnection} onChange={e => { setSelectedConnection(e.target.value); }} className="modern-input text-sm py-2">
              <option value="">No Router (Offline)</option>
              {connections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button onClick={() => { setEditing(null); setForm({ name: '', email: '', phone: '', address: '', city: '', country: '', id_number: '', status: 'active', notes: '' }); setShowForm(true); }}
            className="btn-primary">
            <UserPlus className="w-4 h-4" /> Add Customer
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, or phone..."
          className="modern-input pl-10 max-w-md" />
      </div>

      {/* Table */}
      <div className="relative glass rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}
          </div>
        ) : (
          <table className="modern-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th>Location</th>
                <th>Subs</th>
                <th>Balance</th>
                {selectedConnection && <th>Online</th>}
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                        onlineData[c.id] ? 'bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 ring-1 ring-emerald-500/20 text-emerald-400' : 'bg-gradient-to-br from-blue-500/20 to-violet-500/20 ring-1 ring-blue-500/10 text-blue-400'
                      }`}>
                        {c.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <button onClick={() => navigate(`/portal/${c.id}`)} className="text-white font-medium hover:text-blue-400 transition-colors truncate block">{c.name}</button>
                        {c.id_number && <div className="text-[11px] text-zinc-500">ID: {c.id_number}</div>}
                        {onlineData[c.id] && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span className="text-[10px] text-emerald-400">{onlineData[c.id].uptime || 'Online'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    {c.email && <div className="text-sm text-zinc-300 truncate max-w-[160px]">{c.email}</div>}
                    {c.phone && <div className="text-xs text-zinc-500">{c.phone}</div>}
                  </td>
                  <td className="text-sm text-zinc-400">{[c.city, c.country].filter(Boolean).join(', ') || <span className="text-zinc-600">—</span>}</td>
                  <td><span className="badge badge-blue">{c.subscription_count}</span></td>
                  <td className={`font-semibold tabular-nums ${c.outstanding_balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>${c.outstanding_balance.toFixed(2)}</td>
                  {selectedConnection && (
                    <td>
                      {onlineData[c.id] ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-emerald-400 status-dot" />
                          <span className="text-xs text-emerald-400 font-medium">Online</span>
                          {onlineData[c.id].type === 'pppoe' ? <Wifi className="w-3 h-3 text-blue-400" /> : <Zap className="w-3 h-3 text-amber-400" />}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-600">Offline</span>
                      )}
                    </td>
                  )}
                  <td><span className={`badge ${c.status === 'active' ? 'badge-green' : 'badge-red'}`}>{c.status}</span></td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => navigate(`/portal/${c.id}`)} className="btn-ghost p-2" title="Portal"><ExternalLink className="w-4 h-4" /></button>
                      <button onClick={() => editCustomer(c)} className="btn-ghost p-2" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(c.id)} className="btn-ghost p-2 text-zinc-500 hover:text-rose-400" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon"><UserPlus className="w-6 h-6 text-zinc-600" /></div>
            <div className="empty-state-title">{search ? 'No results found' : 'No customers yet'}</div>
            <div className="empty-state-desc">{search ? 'Try a different search term' : 'Add your first customer to get started'}</div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="glass-strong rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in-scale" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-800/50 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-white">{editing ? 'Edit Customer' : 'New Customer'}</h3>
                <p className="text-sm text-zinc-400 mt-0.5">{editing ? 'Update customer details' : 'Add a new subscriber to your network'}</p>
              </div>
              <button onClick={() => setShowForm(false)} className="btn-ghost p-2 flex-shrink-0">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Name *</label>
                  <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="modern-input" placeholder="John Kamau" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="modern-input" placeholder="john@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Phone</label>
                  <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="modern-input" placeholder="+254712345678" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">ID Number</label>
                  <input value={form.id_number} onChange={e => setForm({...form, id_number: e.target.value})} className="modern-input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">City</label>
                  <input value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="modern-input" placeholder="Nairobi" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Country</label>
                  <input value={form.country} onChange={e => setForm({...form, country: e.target.value})} className="modern-input" placeholder="Kenya" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Address</label>
                  <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="modern-input" placeholder="Street address" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Status</label>
                  <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="modern-input">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows="2" className="modern-input resize-none" placeholder="Internal notes about this customer..." />
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t border-zinc-800/50">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">{editing ? 'Update Customer' : 'Create Customer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
