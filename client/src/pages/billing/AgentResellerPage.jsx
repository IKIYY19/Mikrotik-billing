import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, Tag, Plus, DollarSign, Package, RefreshCw, Copy, Check, UserPlus, Trash2, Edit } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

const API = import.meta.env.VITE_API_URL || '/api';

export function AgentResellerPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('agents');
  const [agents, setAgents] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [branches, setBranches] = useState([]);

  // Agent form
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [agentForm, setAgentForm] = useState({ name: '', phone: '', email: '', branch_id: '', commission_rate: 10 });

  // Voucher generation
  const [showVoucherForm, setShowVoucherForm] = useState(false);
  const [voucherForm, setVoucherForm] = useState({ plan_id: '', agent_id: '', count: 5 });
  const [generatedVouchers, setGeneratedVouchers] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchAgents();
    fetchVouchers();
    axios.get(`${API}/billing/plans`).then(r => setPlans(r.data));
    axios.get(`${API}/features/branches`).then(r => setBranches(r.data));
  }, []);

  const fetchAgents = async () => {
    try { const { data } = await axios.get(`${API}/features/agents`); setAgents(data); } catch (error) { console.error('Failed to fetch agents:', error); toast.error('Failed to fetch agents', error.response?.data?.error || error.message); }
  };

  const fetchVouchers = async () => {
    try { const { data } = await axios.get(`${API}/features/vouchers`); setVouchers(data); } catch (error) { console.error('Failed to fetch vouchers:', error); toast.error('Failed to fetch vouchers', error.response?.data?.error || error.message); }
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    try {
      if (editingAgent) {
        await axios.put(`${API}/features/agents/${editingAgent.id}`, agentForm);
        toast.success('Agent updated successfully');
      } else {
        await axios.post(`${API}/features/agents`, agentForm);
        toast.success('Agent created successfully');
      }
      setShowAgentForm(false);
      setEditingAgent(null);
      setAgentForm({ name: '', phone: '', email: '', branch_id: '', commission_rate: 10 });
      fetchAgents();
    } catch (error) {
      toast.error('Failed to save agent', error.response?.data?.error || error.message);
    }
  };

  const handleEditAgent = (agent) => {
    setEditingAgent(agent);
    setAgentForm({
      name: agent.name,
      phone: agent.phone,
      email: agent.email,
      branch_id: agent.branch_id,
      commission_rate: agent.commission_rate
    });
    setShowAgentForm(true);
  };

  const handleDeleteAgent = async (agentId) => {
    if (!confirm('Are you sure you want to delete this agent?')) return;
    try {
      await axios.delete(`${API}/features/agents/${agentId}`);
      toast.success('Agent deleted successfully');
      fetchAgents();
    } catch (error) {
      toast.error('Failed to delete agent', error.response?.data?.error || error.message);
    }
  };

  const handleGenerateVouchers = async (e) => {
    e.preventDefault();
    const { data } = await axios.post(`${API}/features/vouchers/generate`, voucherForm);
    setGeneratedVouchers(data.generated);
    fetchVouchers();
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(false), 2000);
  };

  const voucherStats = {
    available: vouchers.filter(v => v.status === 'available').length,
    sold: vouchers.filter(v => v.status === 'sold').length,
    redeemed: vouchers.filter(v => v.status === 'redeemed').length,
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-6">Agents & Vouchers</h2>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1"><Users className="w-4 h-4" /> Agents</div>
          <div className="text-2xl font-bold text-white">{agents.length}</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1"><Tag className="w-4 h-4" /> Available</div>
          <div className="text-2xl font-bold text-green-400">{voucherStats.available}</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1"><DollarSign className="w-4 h-4" /> Sold</div>
          <div className="text-2xl font-bold text-blue-400">{voucherStats.sold}</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1"><Check className="w-4 h-4" /> Redeemed</div>
          <div className="text-2xl font-bold text-purple-400">{voucherStats.redeemed}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { id: 'agents', label: 'Agents', icon: Users },
          { id: 'vouchers', label: 'Vouchers', icon: Tag },
          { id: 'generate', label: 'Generate', icon: Package },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
              activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Agents Tab */}
      {activeTab === 'agents' && (
        <div>
          <button onClick={() => setShowAgentForm(true)}
            className="mb-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Add Agent
          </button>
          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="text-left p-3 whitespace-nowrap">Agent</th>
                    <th className="text-left p-3 whitespace-nowrap">Branch</th>
                    <th className="text-left p-3 whitespace-nowrap">Commission</th>
                    <th className="text-left p-3 whitespace-nowrap">Vouchers Sold</th>
                    <th className="text-left p-3 whitespace-nowrap">Revenue</th>
                    <th className="text-left p-3 whitespace-nowrap">Balance</th>
                    <th className="text-left p-3 whitespace-nowrap">Status</th>
                    <th className="text-left p-3 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map(a => (
                    <tr key={a.id} className="border-t border-slate-700 hover:bg-slate-700/50">
                      <td className="p-3 whitespace-nowrap">
                        <div className="text-white font-medium">{a.name}</div>
                        <div className="text-slate-500 text-xs">{a.phone || '—'}</div>
                      </td>
                      <td className="p-3 text-slate-300 whitespace-nowrap">{branches.find(b => b.id === a.branch_id)?.name || '—'}</td>
                      <td className="p-3 text-amber-400 whitespace-nowrap">{a.commission_rate}%</td>
                      <td className="p-3 text-white whitespace-nowrap">{a.vouchers_sold || 0}</td>
                      <td className="p-3 text-green-400 whitespace-nowrap">KES {(parseFloat(a.voucher_revenue) || 0).toFixed(2)}</td>
                      <td className={`p-3 font-semibold whitespace-nowrap ${(parseFloat(a.balance) || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>KES {(parseFloat(a.balance) || 0).toFixed(2)}</td>
                      <td className="p-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-xs ${a.status === 'active' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>{a.status}</span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleEditAgent(a)} className="text-blue-400 hover:text-blue-300 p-1" title="Edit">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteAgent(a.id)} className="text-red-400 hover:text-red-300 p-1" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {agents.length === 0 && <div className="p-8 text-center text-slate-500">No agents yet</div>}
          </div>
        </div>
      )}

      {/* Vouchers Tab */}
      {activeTab === 'vouchers' && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="text-left p-3">Code</th>
                <th className="text-left p-3">Plan</th>
                <th className="text-left p-3">Price</th>
                <th className="text-left p-3">Sold By</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map(v => (
                <tr key={v.id} className="border-t border-slate-700 hover:bg-slate-700/50">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400 font-mono">{v.code}</span>
                      <button onClick={() => copyCode(v.code)} className="text-slate-400 hover:text-white">
                        {copied === v.code ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </td>
                  <td className="p-3 text-white">{v.plan_name}</td>
                  <td className="p-3 text-green-400">KES {v.price}</td>
                  <td className="p-3 text-slate-300">{agents.find(a => a.id === v.sold_by)?.name || '—'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      v.status === 'available' ? 'bg-green-600/20 text-green-400' :
                      v.status === 'sold' ? 'bg-blue-600/20 text-blue-400' :
                      'bg-purple-600/20 text-purple-400'
                    }`}>{v.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {vouchers.length === 0 && <div className="p-8 text-center text-slate-500">No vouchers generated</div>}
        </div>
      )}

      {/* Generate Tab */}
      {activeTab === 'generate' && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h3 className="text-white font-semibold mb-4">Generate Vouchers</h3>
          <form onSubmit={handleGenerateVouchers} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Plan *</label>
              <select required value={voucherForm.plan_id} onChange={e => setVoucherForm({...voucherForm, plan_id: e.target.value})}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white">
                <option value="">Select plan</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name} — KES {p.price}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Agent (optional)</label>
              <select value={voucherForm.agent_id} onChange={e => setVoucherForm({...voucherForm, agent_id: e.target.value})}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white">
                <option value="">None (available)</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Quantity</label>
              <input type="number" min="1" max="100" value={voucherForm.count} onChange={e => setVoucherForm({...voucherForm, count: parseInt(e.target.value)})}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" />
            </div>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center gap-2">
              <Package className="w-4 h-4" /> Generate Vouchers
            </button>
          </form>

          {generatedVouchers && (
            <div className="mt-6">
              <h4 className="text-white font-semibold mb-2">Generated {generatedVouchers.length} Vouchers</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {generatedVouchers.map(v => (
                  <div key={v.id} className="bg-slate-700 rounded p-3 flex items-center justify-between">
                    <span className="text-blue-400 font-mono text-sm">{v.code}</span>
                    <button onClick={() => copyCode(v.code)} className="text-slate-400 hover:text-white">
                      {copied === v.code ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Agent Form Modal */}
      {showAgentForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg w-full max-w-lg p-6">
            <h3 className="text-white font-semibold mb-4">{editingAgent ? 'Edit Agent' : 'Add Agent'}</h3>
            <form onSubmit={handleCreateAgent} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Agent Name *</label>
                <input required value={agentForm.name} onChange={e => setAgentForm({...agentForm, name: e.target.value})}
                  placeholder="Agent name" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Phone</label>
                <input value={agentForm.phone} onChange={e => setAgentForm({...agentForm, phone: e.target.value})}
                  placeholder="Phone" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Email</label>
                <input type="email" value={agentForm.email} onChange={e => setAgentForm({...agentForm, email: e.target.value})}
                  placeholder="Email" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Branch</label>
                <select value={agentForm.branch_id} onChange={e => setAgentForm({...agentForm, branch_id: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white">
                  <option value="">Select branch</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Commission Rate (%)</label>
                <input type="number" min="0" max="100" value={agentForm.commission_rate} onChange={e => setAgentForm({...agentForm, commission_rate: parseInt(e.target.value)})}
                  placeholder="Commission %" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowAgentForm(false); setEditingAgent(null); setAgentForm({ name: '', phone: '', email: '', branch_id: '', commission_rate: 10 }); }} className="flex-1 px-4 py-2 bg-slate-700 text-white rounded">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded">{editingAgent ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
