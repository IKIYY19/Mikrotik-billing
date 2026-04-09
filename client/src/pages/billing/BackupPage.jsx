import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { HardDrive, Plus, Play, Download, Eye, Trash2, Clock, CheckCircle, XCircle, Settings } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

const API = import.meta.env.VITE_API_URL || '/api';

export function BackupPage() {
  const toast = useToast();
  const [schedules, setSchedules] = useState([]);
  const [backups, setBackups] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', ip_address: '', api_port: 8728, username: '', schedule: 'daily', time: '02:00' });
  const [viewBackup, setViewBackup] = useState(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetchSchedules();
    fetchBackups();
  }, []);

  const fetchSchedules = async () => {
    try { const { data } = await axios.get(`${API}/advanced/backup/schedules`); setSchedules(data); } catch (error) { console.error('Failed to fetch schedules:', error); toast.error('Failed to load schedules', error.response?.data?.error || error.message); }
  };

  const fetchBackups = async () => {
    try { const { data } = await axios.get(`${API}/advanced/backup/backups`); setBackups(data); } catch (error) { console.error('Failed to fetch backups:', error); toast.error('Failed to load backups', error.response?.data?.error || error.message); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await axios.post(`${API}/advanced/backup/schedules`, form);
    setShowForm(false);
    setForm({ name: '', ip_address: '', api_port: 8728, username: '', schedule: 'daily', time: '02:00' });
    fetchSchedules();
  };

  const runBackup = async (id) => {
    setRunning(true);
    try {
      await axios.post(`${API}/advanced/backup/schedules/${id}/run`);
      fetchBackups();
      fetchSchedules();
    } catch (error) { console.error('Failed to run backup:', error); toast.error('Backup failed', error.response?.data?.error || error.message); }
    setRunning(false);
  };

  const runAll = async () => {
    setRunning(true);
    try {
      const { data } = await axios.post(`${API}/advanced/backup/run-all`);
      alert(`Success: ${data.success}, Failed: ${data.failed}`);
      fetchBackups();
      fetchSchedules();
    } catch (error) { console.error('Failed to run all backups:', error); toast.error('Run all backups failed', error.response?.data?.error || error.message); }
    setRunning(false);
  };

  const deleteSchedule = async (id) => {
    if (!confirm('Delete this schedule?')) return;
    await axios.delete(`${API}/advanced/backup/schedules/${id}`);
    fetchSchedules();
  };

  const viewBackupContent = async (id) => {
    try {
      const { data } = await axios.get(`${API}/advanced/backup/backups/${id}`);
      setViewBackup(data);
    } catch (error) { console.error('Failed to view backup content:', error); toast.error('Failed to load backup', error.response?.data?.error || error.message); }
  };

  const downloadBackup = (backup) => {
    const blob = new Blob([backup.config_content || `# Backup from ${backup.ip_address}\n# ${backup.created_at}\n# Content not available`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-${backup.device_name}-${backup.created_at.split('T')[0]}.rsc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <HardDrive className="w-6 h-6 text-blue-400" /> Auto Backup & Restore
          </h2>
          <p className="text-sm text-slate-400">Schedule and manage MikroTik configuration backups</p>
        </div>
        <div className="flex gap-3">
          <button onClick={runAll} disabled={running}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <Play className="w-4 h-4" /> {running ? 'Running...' : 'Run All Backups'}
          </button>
          <button onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Schedule
          </button>
        </div>
      </div>

      {/* Schedules */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center gap-2"><Settings className="w-4 h-4" /> Backup Schedules</h3>
        </div>
        {schedules.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No backup schedules configured</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Device</th>
                <th className="text-left p-3">Schedule</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Last Run</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map(s => (
                <tr key={s.id} className="border-t border-slate-700 hover:bg-slate-700/50">
                  <td className="p-3 text-white">{s.name}</td>
                  <td className="p-3 text-slate-300 font-mono text-xs">{s.ip_address}:{s.api_port}</td>
                  <td className="p-3">
                    <span className="text-slate-300 capitalize">{s.schedule}</span>
                    <span className="text-slate-500 ml-1">at {s.time}</span>
                  </td>
                  <td className="p-3">
                    <span className={`flex items-center gap-1 ${s.enabled ? 'text-green-400' : 'text-slate-500'}`}>
                      <span className={`w-2 h-2 rounded-full ${s.enabled ? 'bg-green-400' : 'bg-slate-500'}`} />
                      {s.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="p-3">
                    {s.last_run ? (
                      <div>
                        <div className="text-slate-300 text-xs">{new Date(s.last_run).toLocaleDateString()}</div>
                        <span className={`text-xs ${s.last_status === 'success' ? 'text-green-400' : 'text-red-400'}`}>{s.last_status}</span>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-xs">Never</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => runBackup(s.id)} disabled={running} className="text-green-400 hover:text-green-300 mr-2 disabled:opacity-50">
                      <Play className="w-4 h-4 inline" />
                    </button>
                    <button onClick={() => deleteSchedule(s.id)} className="text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Backup History */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-700"><h3 className="text-white font-semibold flex items-center gap-2"><Clock className="w-4 h-4" /> Backup History</h3></div>
        {backups.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No backups yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="text-left p-3">Device</th>
                <th className="text-left p-3">IP Address</th>
                <th className="text-left p-3">Size</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Date</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.map(b => (
                <tr key={b.id} className="border-t border-slate-700 hover:bg-slate-700/50">
                  <td className="p-3 text-white">{b.device_name}</td>
                  <td className="p-3 text-slate-300 font-mono text-xs">{b.ip_address}</td>
                  <td className="p-3 text-slate-300">{(b.file_size / 1024).toFixed(1)} KB</td>
                  <td className="p-3">
                    <span className={`flex items-center gap-1 ${b.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                      {b.status === 'success' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {b.status}
                    </span>
                  </td>
                  <td className="p-3 text-slate-400 text-xs">{new Date(b.created_at).toLocaleString()}</td>
                  <td className="p-3 text-right">
                    {b.status === 'success' && (
                      <>
                        <button onClick={() => viewBackupContent(b.id)} className="text-blue-400 hover:text-blue-300 mr-2"><Eye className="w-4 h-4 inline" /></button>
                        <button onClick={() => downloadBackup(b)} className="text-green-400 hover:text-green-300"><Download className="w-4 h-4 inline" /></button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Schedule Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg w-full max-w-md p-6">
            <h3 className="text-white font-semibold mb-4">Add Backup Schedule</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                placeholder="Schedule name" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" />
              <input required value={form.ip_address} onChange={e => setForm({...form, ip_address: e.target.value})}
                placeholder="Router IP (192.168.88.1)" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" value={form.api_port} onChange={e => setForm({...form, api_port: e.target.value})}
                  placeholder="API port" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" />
                <input value={form.username} onChange={e => setForm({...form, username: e.target.value})}
                  placeholder="Username" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <select value={form.schedule} onChange={e => setForm({...form, schedule: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 bg-slate-700 text-white rounded">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded">Create Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Backup Content */}
      {viewBackup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg w-3/4 max-w-4xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-white font-semibold">Backup: {viewBackup.device_name} ({viewBackup.created_at.split('T')[0]})</h3>
              <div className="flex gap-2">
                <button onClick={() => downloadBackup(viewBackup)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1">
                  <Download className="w-4 h-4" /> Download
                </button>
                <button onClick={() => setViewBackup(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>
            </div>
            <pre className="flex-1 p-6 text-sm text-green-400 font-mono overflow-auto whitespace-pre-wrap">{viewBackup.content}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
