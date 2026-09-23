import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Gift, Users, Plus, Edit3, Trash2, Copy, Award, TrendingUp, CheckCircle, Clock, XCircle, UserPlus, Coins } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

const API = import.meta.env.VITE_API_URL || '/api';

export function ReferralEngine() {
  const toast = useToast();
  const [tab, setTab] = useState('programs');
  const [programs, setPrograms] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [codes, setCodes] = useState([]);
  const [stats, setStats] = useState({});
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [programForm, setProgramForm] = useState({
    name: '', description: '',
    referrer_reward_type: 'wallet_credit', referrer_reward_value: '',
    referee_reward_type: 'wallet_credit', referee_reward_value: '',
    referee_qualification: 'first_payment', qualification_amount: '',
    max_referrals_per_referrer: '', status: 'active',
    starts_at: '', ends_at: '',
  });
  const [showReferralForm, setShowReferralForm] = useState(false);
  const [referralForm, setReferralForm] = useState({
    program_id: '', referrer_customer_id: '', referee_customer_id: '',
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [progRes, refRes, codeRes] = await Promise.all([
        axios.get(`${API}/promos/programs`),
        axios.get(`${API}/promos/referrals`),
        axios.get(`${API}/promos/codes`),
      ]);
      setPrograms(progRes.data);
      setReferrals(refRes.data);
      setCodes(codeRes.data);

      const statsMap = {};
      for (const p of progRes.data) {
        try {
          const { data } = await axios.get(`${API}/promos/programs/${p.id}/stats`);
          statsMap[p.id] = data;
        } catch (err) { /* skip */ }
      }
      setStats(statsMap);
    } catch (err) {
      toast.error('Failed to load referral data', err.response?.data?.error || err.message);
    }
  };

  const resetProgramForm = () => {
    setProgramForm({
      name: '', description: '',
      referrer_reward_type: 'wallet_credit', referrer_reward_value: '',
      referee_reward_type: 'wallet_credit', referee_reward_value: '',
      referee_qualification: 'first_payment', qualification_amount: '',
      max_referrals_per_referrer: '', status: 'active',
      starts_at: '', ends_at: '',
    });
    setEditingProgram(null);
  };

  const handleProgramSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...programForm,
        referrer_reward_value: parseFloat(programForm.referrer_reward_value) || 0,
        referee_reward_value: parseFloat(programForm.referee_reward_value) || 0,
        qualification_amount: programForm.qualification_amount ? parseFloat(programForm.qualification_amount) : null,
        max_referrals_per_referrer: programForm.max_referrals_per_referrer ? parseInt(programForm.max_referrals_per_referrer) : null,
        starts_at: programForm.starts_at ? new Date(programForm.starts_at).toISOString() : undefined,
        ends_at: programForm.ends_at ? new Date(programForm.ends_at).toISOString() : null,
      };
      if (editingProgram) {
        await axios.put(`${API}/promos/programs/${editingProgram.id}`, payload);
        toast.success('Program updated');
      } else {
        await axios.post(`${API}/promos/programs`, payload);
        toast.success('Program created');
      }
      fetchAll();
      setShowProgramForm(false);
      resetProgramForm();
    } catch (err) {
      toast.error('Failed to save program', err.response?.data?.error || err.message);
    }
  };

  const handleEditProgram = (p) => {
    setEditingProgram(p);
    setProgramForm({
      name: p.name || '', description: p.description || '',
      referrer_reward_type: p.referrer_reward_type || 'wallet_credit',
      referrer_reward_value: String(p.referrer_reward_value || ''),
      referee_reward_type: p.referee_reward_type || 'wallet_credit',
      referee_reward_value: String(p.referee_reward_value || ''),
      referee_qualification: p.referee_qualification || 'first_payment',
      qualification_amount: p.qualification_amount ? String(p.qualification_amount) : '',
      max_referrals_per_referrer: p.max_referrals_per_referrer ? String(p.max_referrals_per_referrer) : '',
      status: p.status || 'active',
      starts_at: p.starts_at ? new Date(p.starts_at).toISOString().slice(0, 16) : '',
      ends_at: p.ends_at ? new Date(p.ends_at).toISOString().slice(0, 16) : '',
    });
    setShowProgramForm(true);
  };

  const handleDeleteProgram = async (id) => {
    if (!confirm('Delete this referral program? All related codes and referrals will be removed.')) return;
    try {
      await axios.delete(`${API}/promos/programs/${id}`);
      toast.success('Program deleted');
      fetchAll();
    } catch (err) {
      toast.error('Failed to delete program', err.response?.data?.error || err.message);
    }
  };

  const handleCreateReferral = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${API}/promos/referrals`, referralForm);
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success('Referral created');
        setShowReferralForm(false);
        setReferralForm({ program_id: '', referrer_customer_id: '', referee_customer_id: '' });
        fetchAll();
      }
    } catch (err) {
      toast.error('Failed to create referral', err.response?.data?.error || err.message);
    }
  };

  const handleQualify = async (id) => {
    try {
      await axios.post(`${API}/promos/referrals/${id}/qualify`);
      toast.success('Referral qualified');
      fetchAll();
    } catch (err) {
      toast.error('Failed to qualify referral', err.response?.data?.error || err.message);
    }
  };

  const handleIssueRewards = async (id) => {
    if (!confirm('Issue wallet rewards to both referrer and referee?')) return;
    try {
      const { data } = await axios.post(`${API}/promos/referrals/${id}/rewards`);
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success('Rewards issued successfully');
        fetchAll();
      }
    } catch (err) {
      toast.error('Failed to issue rewards', err.response?.data?.error || err.message);
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('Referral code copied');
  };

  const statusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-amber-400" />;
      case 'qualified': return <CheckCircle className="w-4 h-4 text-cyan-400" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-400" />;
      default: return <XCircle className="w-4 h-4 text-slate-500" />;
    }
  };

  const statusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-amber-500/20 text-amber-400';
      case 'qualified': return 'bg-cyan-500/20 text-cyan-400';
      case 'completed': return 'bg-green-500/20 text-green-400';
      default: return 'bg-slate-600 text-slate-300';
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Gift className="w-6 h-6 text-cyan-400" /> Referral Engine
          </h2>
          <p className="text-sm text-slate-400">Refer-a-friend programs with wallet credit rewards</p>
        </div>
        {tab === 'programs' && (
          <button
            onClick={() => { resetProgramForm(); setShowProgramForm(true); }}
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Program
          </button>
        )}
        {tab === 'referrals' && (
          <button
            onClick={() => setShowReferralForm(true)}
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <UserPlus className="w-4 h-4" /> New Referral
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-800/50 rounded-lg p-1 w-fit">
        {['programs', 'referrals', 'codes'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Programs Tab */}
      {tab === 'programs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {programs.length === 0 ? (
            <div className="col-span-2 text-center py-20">
              <Gift className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No referral programs yet. Create one to start rewarding referrals.</p>
            </div>
          ) : programs.map((p) => {
            const s = stats[p.id] || {};
            return (
              <div key={p.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 hover:border-cyan-600/50 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-white text-lg">{p.name}</h3>
                    {p.description && <p className="text-slate-400 text-sm mt-1">{p.description}</p>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${p.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-300'}`}>
                    {p.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 my-4">
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                      <Award className="w-3.5 h-3.5" /> Referrer Gets
                    </div>
                    <div className="text-lg font-bold text-emerald-400">
                      ${parseFloat(p.referrer_reward_value).toFixed(2)}
                    </div>
                    <div className="text-slate-500 text-xs">wallet credit</div>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                      <Coins className="w-3.5 h-3.5" /> Referee Gets
                    </div>
                    <div className="text-lg font-bold text-cyan-400">
                      ${parseFloat(p.referee_reward_value).toFixed(2)}
                    </div>
                    <div className="text-slate-500 text-xs">wallet credit</div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-sm mb-4">
                  <div className="bg-slate-900/30 rounded-lg p-2">
                    <div className="text-slate-500 text-xs">Total</div>
                    <div className="text-white font-semibold">{s.total_referrals || 0}</div>
                  </div>
                  <div className="bg-slate-900/30 rounded-lg p-2">
                    <div className="text-amber-400 text-xs">Pending</div>
                    <div className="text-white font-semibold">{s.pending || 0}</div>
                  </div>
                  <div className="bg-slate-900/30 rounded-lg p-2">
                    <div className="text-cyan-400 text-xs">Qualified</div>
                    <div className="text-white font-semibold">{s.qualified || 0}</div>
                  </div>
                  <div className="bg-slate-900/30 rounded-lg p-2">
                    <div className="text-green-400 text-xs">Completed</div>
                    <div className="text-white font-semibold">{s.completed || 0}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                  <span>Qualification: <span className="text-slate-300 capitalize">{p.referee_qualification?.replace(/_/g, ' ')}</span></span>
                  {p.max_referrals_per_referrer && <span>· Max: {p.max_referrals_per_referrer}/referrer</span>}
                </div>

                <div className="flex gap-2 pt-3 border-t border-slate-700/50">
                  <button onClick={() => handleEditProgram(p)} className="text-slate-400 hover:text-blue-400 text-sm flex items-center gap-1 transition-colors">
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => handleDeleteProgram(p.id)} className="text-slate-400 hover:text-red-400 text-sm flex items-center gap-1 transition-colors ml-auto">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Referrals Tab */}
      {tab === 'referrals' && (
        <div>
          {referrals.length === 0 ? (
            <div className="text-center py-20">
              <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No referrals yet.</p>
            </div>
          ) : (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="text-slate-400 text-sm border-b border-slate-700">
                    <th className="text-left px-4 py-3">Referrer</th>
                    <th className="text-left px-4 py-3">Referee</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-center px-4 py-3">Rewards</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => {
                    const program = programs.find((p) => p.id === r.program_id);
                    return (
                      <tr key={r.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                        <td className="px-4 py-3">
                          <div className="text-white text-sm font-medium">{r.referrer_name || 'Unknown'}</div>
                          <div className="text-slate-500 text-xs">{r.referrer_phone || r.referrer_customer_id?.substring(0, 8)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-white text-sm font-medium">{r.referee_name || 'Unknown'}</div>
                          <div className="text-slate-500 text-xs">{r.referee_phone || r.referee_customer_id?.substring(0, 8)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${statusColor(r.status)}`}>
                            {statusIcon(r.status)} {r.status}
                          </span>
                          {program && <div className="text-slate-500 text-xs mt-1">{program.name}</div>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5 text-xs">
                            <span className={r.referrer_rewarded ? 'text-green-400' : 'text-slate-600'}>
                              <CheckCircle className="w-3.5 h-3.5 inline" /> Referrer
                            </span>
                            <span className={r.referee_rewarded ? 'text-green-400' : 'text-slate-600'}>
                              <CheckCircle className="w-3.5 h-3.5 inline" /> Referee
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            {r.status === 'pending' && (
                              <button
                                onClick={() => handleQualify(r.id)}
                                className="text-cyan-400 hover:text-cyan-300 text-xs font-medium transition-colors"
                              >
                                Qualify
                              </button>
                            )}
                            {r.status === 'qualified' && (
                              <button
                                onClick={() => handleIssueRewards(r.id)}
                                className="text-emerald-400 hover:text-emerald-300 text-xs font-medium transition-colors"
                              >
                                Issue Rewards
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Codes Tab */}
      {tab === 'codes' && (
        <div>
          {codes.length === 0 ? (
            <div className="text-center py-20">
              <Ticket className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No referral codes generated yet. Codes are auto-generated when creating referrals.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {codes.map((c) => (
                <div key={c.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <code className="text-cyan-400 font-mono font-semibold">{c.code}</code>
                        <button onClick={() => copyCode(c.code)} className="text-slate-500 hover:text-cyan-400 transition-colors">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="text-slate-400 text-xs mt-1">{c.program_name || 'Unknown program'}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="bg-slate-900/30 rounded-lg p-2 text-center">
                      <div className="text-slate-500 text-xs">Total Referrals</div>
                      <div className="text-white font-semibold">{c.total_referrals || 0}</div>
                    </div>
                    <div className="bg-slate-900/30 rounded-lg p-2 text-center">
                      <div className="text-slate-500 text-xs">Qualified</div>
                      <div className="text-cyan-400 font-semibold">{c.qualified_referrals || 0}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Program Form Modal */}
      {showProgramForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowProgramForm(false)}>
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">{editingProgram ? 'Edit Program' : 'Create Referral Program'}</h3>
            <form onSubmit={handleProgramSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Program Name *</label>
                <input
                  type="text" required value={programForm.name}
                  onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })}
                  className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-cyan-500 outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Description</label>
                <textarea
                  value={programForm.description}
                  onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-cyan-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                  <h4 className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-1.5">
                    <Award className="w-4 h-4" /> Referrer Reward
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Reward Type</label>
                      <select
                        value={programForm.referrer_reward_type}
                        onChange={(e) => setProgramForm({ ...programForm, referrer_reward_type: e.target.value })}
                        className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-cyan-500 outline-none text-sm"
                      >
                        <option value="wallet_credit">Wallet Credit</option>
                        <option value="invoice_credit">Invoice Credit</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Amount *</label>
                      <input
                        type="number" required step="0.01" value={programForm.referrer_reward_value}
                        onChange={(e) => setProgramForm({ ...programForm, referrer_reward_value: e.target.value })}
                        className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-cyan-500 outline-none text-sm"
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                  <h4 className="text-sm font-medium text-cyan-400 mb-3 flex items-center gap-1.5">
                    <Coins className="w-4 h-4" /> Referee Reward
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Reward Type</label>
                      <select
                        value={programForm.referee_reward_type}
                        onChange={(e) => setProgramForm({ ...programForm, referee_reward_type: e.target.value })}
                        className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-cyan-500 outline-none text-sm"
                      >
                        <option value="wallet_credit">Wallet Credit</option>
                        <option value="invoice_credit">Invoice Credit</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Amount *</label>
                      <input
                        type="number" required step="0.01" value={programForm.referee_reward_value}
                        onChange={(e) => setProgramForm({ ...programForm, referee_reward_value: e.target.value })}
                        className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-cyan-500 outline-none text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Referee Qualification</label>
                  <select
                    value={programForm.referee_qualification}
                    onChange={(e) => setProgramForm({ ...programForm, referee_qualification: e.target.value })}
                    className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-cyan-500 outline-none"
                  >
                    <option value="first_payment">First Payment</option>
                    <option value="signup">Signup Only</option>
                    <option value="manual">Manual Approval</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Qualification Amount (blank = any)</label>
                  <input
                    type="number" step="0.01" value={programForm.qualification_amount}
                    onChange={(e) => setProgramForm({ ...programForm, qualification_amount: e.target.value })}
                    className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Max Referrals Per Referrer (blank = unlimited)</label>
                  <input
                    type="number" value={programForm.max_referrals_per_referrer}
                    onChange={(e) => setProgramForm({ ...programForm, max_referrals_per_referrer: e.target.value })}
                    className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-cyan-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Status</label>
                  <select
                    value={programForm.status}
                    onChange={(e) => setProgramForm({ ...programForm, status: e.target.value })}
                    className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-cyan-500 outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Start Date</label>
                  <input
                    type="datetime-local" value={programForm.starts_at}
                    onChange={(e) => setProgramForm({ ...programForm, starts_at: e.target.value })}
                    className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-cyan-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">End Date (blank = no expiry)</label>
                  <input
                    type="datetime-local" value={programForm.ends_at}
                    onChange={(e) => setProgramForm({ ...programForm, ends_at: e.target.value })}
                    className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-lg transition-colors">
                  {editingProgram ? 'Update' : 'Create'} Program
                </button>
                <button type="button" onClick={() => { setShowProgramForm(false); resetProgramForm(); }} className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Referral Modal */}
      {showReferralForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowReferralForm(false)}>
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Create Referral</h3>
            <form onSubmit={handleCreateReferral} className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Program *</label>
                <select
                  required value={referralForm.program_id}
                  onChange={(e) => setReferralForm({ ...referralForm, program_id: e.target.value })}
                  className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-cyan-500 outline-none"
                >
                  <option value="">Select a program</option>
                  {programs.filter((p) => p.status === 'active').map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Referrer Customer ID *</label>
                <input
                  type="text" required value={referralForm.referrer_customer_id}
                  onChange={(e) => setReferralForm({ ...referralForm, referrer_customer_id: e.target.value })}
                  placeholder="Customer UUID"
                  className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-cyan-500 outline-none font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Referee Customer ID *</label>
                <input
                  type="text" required value={referralForm.referee_customer_id}
                  onChange={(e) => setReferralForm({ ...referralForm, referee_customer_id: e.target.value })}
                  placeholder="Customer UUID"
                  className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 border border-slate-700 focus:border-cyan-500 outline-none font-mono text-sm"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-lg transition-colors">
                  Create Referral
                </button>
                <button type="button" onClick={() => setShowReferralForm(false)} className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
