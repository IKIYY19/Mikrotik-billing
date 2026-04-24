import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Search, ExternalLink, UserPlus, Trash2, Pencil, ChevronRight, Wifi, Zap, ArrowUpRight, ArrowDownRight, Clock, RefreshCw, X } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

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
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', city: '', country: '', id_number: '', status: 'active', notes: '', account_number: '' });
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState('');
  const [onlineData, setOnlineData] = useState({});
  const [onlineLoading, setOnlineLoading] = useState(false);

  // Auto-generate account number from company name
  const generateAccountNumber = (companyName, existingCustomers) => {
    if (!companyName) return '';
    // Extract first 3 letters of company name, uppercase
    const prefix = companyName.trim().substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
    // Get next sequential number
    const nextNum = (existingCustomers?.length || 0) + 1;
    return `${prefix}-${String(nextNum).padStart(4, '0')}`;
  };

  useEffect(() => { fetchCustomers(); fetchConnections(); }, []);
  useEffect(() => { if (selectedConnection) fetchOnlineStatus(); }, [selectedConnection]);

  const fetchCustomers = async () => {
    setLoading(true);
    try { const { data } = await axios.get(`${API}/billing/customers`); setCustomers(data); } catch (error) { console.error('Failed to fetch customers:', error); toast.error('Failed to load customers', error.response?.data?.error || error.message); }
    setLoading(false);
  };

  const fetchConnections = async () => {
    try { const { data } = await axios.get(`${API}/mikrotik`); setConnections(data); } catch (error) { console.error('Failed to fetch connections:', error); toast.error('Failed to load connections', error.response?.data?.error || error.message); }
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
    try {
      const submitData = { ...form };
      // Auto-generate account number if not provided
      if (!submitData.account_number && !editing) {
        submitData.account_number = generateAccountNumber(submitData.name, customers);
      }
      
      if (editing) {
        await axios.put(`${API}/billing/customers/${editing.id}`, submitData);
        toast.success('Customer updated successfully');
      } else {
        const { data } = await axios.post(`${API}/billing/customers`, submitData);
        toast.success(`Customer created: ${data.account_number || data.name}`);
      }
      setShowForm(false);
      setEditing(null);
      setForm({ name: '', email: '', phone: '', address: '', city: '', country: '', id_number: '', status: 'active', notes: '', account_number: '' });
      fetchCustomers();
    } catch (error) {
      console.error('Failed to save customer:', error);
      toast.error('Failed to save customer', error.response?.data?.error || error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this customer?')) return;
    try {
      await axios.delete(`${API}/billing/customers/${id}`);
      toast.success('Customer deleted');
      fetchCustomers();
    } catch (error) {
      console.error('Failed to delete customer:', error);
      toast.error('Failed to delete customer', error.response?.data?.error || error.message);
    }
  };

  const editCustomer = (c) => {
    setEditing(c);
    setForm({ name: c.name, email: c.email || '', phone: c.phone || '', address: c.address || '', city: c.city || '', country: c.country || '', id_number: c.id_number || '', status: c.status, notes: c.notes || '', account_number: c.account_number || '' });
    setShowForm(true);
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
    (c.phone && c.phone.includes(search))
  );

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white gradient-text">Customers ({customers.length})</h2>
          <p className="text-slate-400 mt-1">Manage customer accounts and contact info</p>
        </div>
        <div className="flex items-center gap-3">
          {connections.length > 0 && (
            <select value={selectedConnection} onChange={e => { setSelectedConnection(e.target.value); }} className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
              <option value="">No Router (Offline)</option>
              {connections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <Button onClick={() => { setEditing(null); setForm({ name: '', email: '', phone: '', address: '', city: '', country: '', id_number: '', status: 'active', notes: '' }); setShowForm(true); }} className="btn-gradient-primary flex items-center gap-2">
            <UserPlus className="w-5 h-5" /> Add Customer
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, or phone..." className="pl-10 max-w-md" />
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="p-6 space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-500 text-lg">{search ? 'No results found' : 'No customers yet. Add your first customer.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map(c => (
            <Card key={c.id} className="card-gradient overflow-hidden">
              <CardHeader className="border-b border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold ${
                      onlineData[c.id] ? 'bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 ring-1 ring-emerald-500/20 text-emerald-400' : 'bg-gradient-to-br from-blue-500/20 to-violet-500/20 ring-1 ring-blue-500/10 text-blue-400'
                    }`}>
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{c.name}</CardTitle>
                      {c.account_number && <p className="text-[11px] text-zinc-500 font-mono">{c.account_number}</p>}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    c.status === 'active' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
                  }`}>
                    {c.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-2 gap-3 text-sm border-t border-zinc-800">
                <div className="text-zinc-400">Email: <span className="text-white truncate block">{c.email || '—'}</span></div>
                <div className="text-zinc-400">Phone: <span className="text-white">{c.phone || '—'}</span></div>
                <div className="text-zinc-400">Location: <span className="text-white">{[c.city, c.country].filter(Boolean).join(', ') || '—'}</span></div>
                <div className="text-zinc-400">Subs: <span className="text-white">{c.subscription_count}</span></div>
                <div className="text-zinc-400">Balance: <span className={`font-semibold ${c.outstanding_balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>${c.outstanding_balance.toFixed(2)}</span></div>
                {selectedConnection && (
                  <div className="text-zinc-400">
                    {onlineData[c.id] ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 status-dot" />
                        <span className="text-emerald-400 font-medium">Online</span>
                        {onlineData[c.id].type === 'pppoe' ? <Wifi className="w-3 h-3 text-blue-400" /> : <Zap className="w-3 h-3 text-amber-400" />}
                      </div>
                    ) : (
                      <span className="text-zinc-600">Offline</span>
                    )}
                  </div>
                )}
              </CardContent>
              <CardContent className="p-4 border-t border-zinc-800 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate(`/portal/${c.id}`)} className="flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Portal
                </Button>
                <Button variant="outline" size="sm" onClick={() => editCustomer(c)} className="flex items-center gap-1">
                  <Pencil className="w-3 h-3" /> Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(c.id)} className="flex items-center gap-1 text-red-400 ml-auto">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="card-glow w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{editing ? 'Edit Customer' : 'New Customer'}</CardTitle>
                  <p className="text-sm text-zinc-400 mt-0.5">{editing ? 'Update customer details' : 'Add a new subscriber to your network'}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}><X className="w-5 h-5" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4 pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customer-name">Name *</Label>
                    <Input id="customer-name" required value={form.name} onChange={e => {
                      const newName = e.target.value;
                      if (!editing && !form.account_number) {
                        const newAccountNum = generateAccountNumber(newName, customers);
                        setForm({...form, name: newName, account_number: newAccountNum});
                      } else {
                        setForm({...form, name: newName});
                      }
                    }} placeholder="John Kamau" />
                  </div>
                  <div>
                    <Label htmlFor="account-number">Account Number</Label>
                    <Input id="account-number" value={form.account_number || generateAccountNumber(form.name, customers)} onChange={e => setForm({...form, account_number: e.target.value})} className="font-mono" placeholder="Auto-generated" />
                    <p className="text-xs text-zinc-500 mt-1">Auto-generated from name</p>
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="john@example.com" />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+254712345678" />
                  </div>
                  <div>
                    <Label htmlFor="id-number">ID Number</Label>
                    <Input id="id-number" value={form.id_number} onChange={e => setForm({...form, id_number: e.target.value})} />
                  </div>
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input id="city" value={form.city} onChange={e => setForm({...form, city: e.target.value})} placeholder="Nairobi" />
                  </div>
                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Input id="country" value={form.country} onChange={e => setForm({...form, country: e.target.value})} placeholder="Kenya" />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Street address" />
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <select id="status" value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="notes">Notes</Label>
                    <textarea id="notes" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows="2" className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background resize-none" placeholder="Internal notes about this customer..." />
                  </div>
                </div>
                <div className="flex gap-3 pt-4 border-t border-zinc-800">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancel</Button>
                  <Button type="submit" className="btn-gradient-primary flex-1">{editing ? 'Update Customer' : 'Create Customer'}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
