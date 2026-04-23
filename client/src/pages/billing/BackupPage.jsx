import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { HardDrive, Plus, Play, Download, Eye, Trash2, Clock, CheckCircle, XCircle, Settings, RotateCcw, X, Upload } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

const API = import.meta.env.VITE_API_URL || '/api';

export function BackupPage() {
  const toast = useToast();
  const [schedules, setSchedules] = useState([]);
  const [backups, setBackups] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', ip_address: '', api_port: 8728, username: '', schedule: 'daily', time: '02:00' });
  const [viewBackup, setViewBackup] = useState(null);
  const [running, setRunning] = useState(false);
  const [showRestore, setShowRestore] = useState(null);
  const [restoreForm, setRestoreForm] = useState({ target_ip: '', target_port: 8728, target_username: '', target_password: '' });
  const [restoring, setRestoring] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

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

  const handleRestore = async (backup) => {
    setShowRestore(backup);
    setRestoreForm({ target_ip: '', target_port: 8728, target_username: '', target_password: '' });
  };

  const executeRestore = async (e) => {
    e.preventDefault();
    setRestoring(true);
    try {
      await axios.post(`${API}/advanced/backup/restore/${showRestore.id}`, restoreForm);
      toast.success('Backup restored successfully');
      setShowRestore(null);
      setRestoreForm({ target_ip: '', target_port: 8728, target_username: '', target_password: '' });
    } catch (error) {
      console.error('Failed to restore backup:', error);
      toast.error('Restore failed', error.response?.data?.error || error.message);
    }
    setRestoring(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadFile(file);
    }
  };

  const executeUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error('Please select a file to upload');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      await axios.post(`${API}/advanced/backup/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Backup file uploaded successfully');
      setShowUpload(false);
      setUploadFile(null);
      fetchBackups();
    } catch (error) {
      console.error('Failed to upload backup:', error);
      toast.error('Upload failed', error.response?.data?.error || error.message);
    }
    setUploading(false);
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
          <Button onClick={runAll} disabled={running} className="flex items-center gap-2">
            <Play className="w-4 h-4" /> {running ? 'Running...' : 'Run All Backups'}
          </Button>
          <Button onClick={() => setShowUpload(true)} variant="outline" className="flex items-center gap-2">
            <Upload className="w-4 h-4" /> Upload Backup
          </Button>
          <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Schedule
          </Button>
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
                    {b.status === 'success' ? (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => viewBackupContent(b.id)} className="mr-1 text-blue-400 hover:text-blue-300">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => downloadBackup(b)} className="mr-1 text-green-400 hover:text-green-300">
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleRestore(b)} className="text-amber-400 hover:text-amber-300">
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <span className="text-slate-500 text-xs">N/A</span>
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
          <Card className="w-3/4 max-w-4xl max-h-[80vh] flex flex-col">
            <CardHeader className="border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <CardTitle>Backup: {viewBackup.device_name} ({viewBackup.created_at.split('T')[0]})</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => downloadBackup(viewBackup)} className="flex items-center gap-1">
                    <Download className="w-4 h-4" /> Download
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setViewBackup(null)}><X className="w-5 h-5" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-6">
              <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">{viewBackup.content}</pre>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Restore Modal */}
      {showRestore && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader className="border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-amber-400" /> Restore Backup
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowRestore(null)}><X className="w-5 h-5" /></Button>
              </div>
              <CardDescription>
                Restore {showRestore.device_name} backup from {new Date(showRestore.created_at).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={executeRestore} className="space-y-4 pt-6">
                <div>
                  <Label htmlFor="target-ip">Target Router IP *</Label>
                  <Input
                    id="target-ip"
                    required
                    value={restoreForm.target_ip}
                    onChange={e => setRestoreForm({...restoreForm, target_ip: e.target.value})}
                    placeholder="192.168.88.1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="target-port">API Port</Label>
                    <Input
                      id="target-port"
                      type="number"
                      value={restoreForm.target_port}
                      onChange={e => setRestoreForm({...restoreForm, target_port: e.target.value})}
                      placeholder="8728"
                    />
                  </div>
                  <div>
                    <Label htmlFor="target-username">Username *</Label>
                    <Input
                      id="target-username"
                      required
                      value={restoreForm.target_username}
                      onChange={e => setRestoreForm({...restoreForm, target_username: e.target.value})}
                      placeholder="admin"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="target-password">Password *</Label>
                  <Input
                    id="target-password"
                    type="password"
                    required
                    value={restoreForm.target_password}
                    onChange={e => setRestoreForm({...restoreForm, target_password: e.target.value})}
                    placeholder="Router password"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowRestore(null)} className="flex-1">Cancel</Button>
                  <Button type="submit" disabled={restoring} className="flex-1">
                    {restoring ? 'Restoring...' : 'Restore Backup'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upload Backup Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader className="border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-400" /> Upload Backup File
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowUpload(null)}><X className="w-5 h-5" /></Button>
              </div>
              <CardDescription>
                Upload a MikroTik backup file (.rsc, .backup) from your computer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={executeUpload} className="space-y-4 pt-6">
                <div>
                  <Label htmlFor="backup-file">Backup File *</Label>
                  <Input
                    id="backup-file"
                    type="file"
                    accept=".rsc,.backup"
                    onChange={handleFileUpload}
                    className="cursor-pointer"
                  />
                  {uploadFile && (
                    <p className="text-sm text-zinc-400 mt-2">
                      Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowUpload(null)} className="flex-1">Cancel</Button>
                  <Button type="submit" disabled={uploading || !uploadFile} className="flex-1">
                    {uploading ? 'Uploading...' : 'Upload Backup'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
