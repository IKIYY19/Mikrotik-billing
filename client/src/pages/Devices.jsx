import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Router, Plus, Trash2, Copy, Download, Eye, RefreshCw,
  Terminal, Shield, Settings, CheckCircle, Clock, X, Code, FileText
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function Devices() {
  const [devices, setDevices] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showScript, setShowScript] = useState(null);
  const [showLogs, setShowLogs] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    name: '', identity: '', model: '', dns_servers: ['8.8.8.8', '8.8.4.4'],
    ntp_servers: ['pool.ntp.org'], wan_interface: 'ether1',
    radius_server: '', radius_secret: '', hotspot_enabled: false, pppoe_enabled: false,
    notes: '',
  });

  useEffect(() => { fetchDevices(); }, []);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/devices`);
      setDevices(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/devices`, formData);
      setShowCreate(false);
      setFormData({ name: '', identity: '', model: '', dns_servers: ['8.8.8.8', '8.8.4.4'],
        ntp_servers: ['pool.ntp.org'], wan_interface: 'ether1',
        radius_server: '', radius_secret: '', hotspot_enabled: false, pppoe_enabled: false, notes: '' });
      fetchDevices();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this device?')) return;
    await axios.delete(`${API_URL}/devices/${id}`);
    fetchDevices();
  };

  const regenerateToken = async (id) => {
    if (!window.confirm('Regenerate token? The old one will stop working.')) return;
    await axios.post(`${API_URL}/devices/${id}/regenerate-token`);
    fetchDevices();
  };

  const viewScript = async (device) => {
    try {
      const { data } = await axios.get(`${API_URL}/devices/${device.id}/script`);
      setShowScript({ ...device, content: data.script });
    } catch (e) { console.error(e); }
  };

  const viewLogs = async (device) => {
    try {
      const { data } = await axios.get(`${API_URL}/devices/${device.id}/logs`);
      setLogs(data);
      setShowLogs(device);
    } catch (e) { console.error(e); }
  };

  const copyCommand = (token) => {
    const cmd = `/tool fetch mode=https url="https://MYDOMAIN.com/mikrotik/provision/${token}" dst-path=setup.rsc\r\n:delay 2s\r\n/import setup.rsc\r\n/tool fetch mode=https url="https://MYDOMAIN.com/mikrotik/provision/callback/${token}"`;
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadScript = (device) => {
    const blob = new Blob([device.content || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${device.name}-provision.rsc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Zero-Touch Provisioning</h2>
          <p className="text-slate-400 mt-1">Add routers, generate one-line provision commands</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          <Plus className="w-5 h-5" /> Add Device
        </button>
      </div>

      {/* Devices Grid */}
      {devices.length === 0 ? (
        <div className="text-center py-16">
          <Router className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-500 text-lg">No devices yet. Add your first MikroTik router.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {devices.map(dev => (
            <div key={dev.id} className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Router className="w-6 h-6 text-blue-500" />
                  <div>
                    <h3 className="text-white font-semibold">{dev.name}</h3>
                    <p className="text-xs text-slate-400">{dev.identity || dev.name} • {dev.model || 'Unknown model'}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  dev.provision_status === 'provisioned' ? 'bg-green-600/20 text-green-400' : 'bg-amber-600/20 text-amber-400'
                }`}>
                  {dev.provision_status === 'provisioned' ? '✓ Provisioned' : '⏳ Pending'}
                </span>
              </div>

              {/* Provision Command */}
              <div className="p-4 bg-slate-900">
                <h4 className="text-xs text-slate-400 uppercase mb-2 flex items-center gap-1">
                  <Terminal className="w-3 h-3" /> Provision Command
                </h4>
                <pre className="text-xs text-green-400 bg-slate-800 p-3 rounded border border-slate-700 overflow-x-auto whitespace-pre-wrap font-mono">
{`/tool fetch mode=https url="https://MYDOMAIN.com/mikrotik/provision/${dev.provision_token}" dst-path=setup.rsc
:delay 2s
/import setup.rsc
/tool fetch mode=https url="https://MYDOMAIN.com/mikrotik/provision/callback/${dev.provision_token}"`}
                </pre>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => copyCommand(dev.provision_token)}
                    className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1">
                    <Copy className="w-3 h-3" /> {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button onClick={() => viewScript(dev)}
                    className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1">
                    <Eye className="w-3 h-3" /> Preview Script
                  </button>
                  <button onClick={() => viewLogs(dev)}
                    className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Logs
                  </button>
                </div>
              </div>

              {/* Settings */}
              <div className="p-4 grid grid-cols-2 gap-3 text-sm">
                <div className="text-slate-400">WAN: <span className="text-white">{dev.wan_interface}</span></div>
                <div className="text-slate-400">DNS: <span className="text-white">{dev.dns_servers?.join(', ')}</span></div>
                <div className="text-slate-400">RADIUS: <span className="text-white">{dev.radius_server || 'Not set'}</span></div>
                <div className="text-slate-400">PPPoE: <span className="text-white">{dev.pppoe_enabled ? 'Yes' : 'No'}</span></div>
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-slate-700 flex gap-2">
                <button onClick={() => regenerateToken(dev.id)}
                  className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 px-3 py-1.5 rounded text-sm flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> New Token
                </button>
                <button onClick={() => downloadScript(dev)}
                  className="bg-green-600/20 hover:bg-green-600/30 text-green-400 px-3 py-1.5 rounded text-sm flex items-center gap-1">
                  <Download className="w-3 h-3" /> .rsc
                </button>
                <button onClick={() => handleDelete(dev.id)}
                  className="bg-red-600/20 hover:bg-red-600/30 text-red-400 px-3 py-1.5 rounded text-sm flex items-center gap-1 ml-auto">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-white font-semibold text-lg">Add New Device</h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Name *</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" placeholder="Branch-Router-01" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Identity</label>
                  <input value={formData.identity} onChange={e => setFormData({...formData, identity: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" placeholder="MY-BRANCH-01" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Model</label>
                  <select value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white">
                    <option value="">Select model</option>
                    <option value="CCR2004">CCR2004</option>
                    <option value="CCR2116">CCR2116</option>
                    <option value="RB5009">RB5009</option>
                    <option value="RB4011">RB4011</option>
                    <option value="hEX">hEX RB750Gr3</option>
                    <option value="hAP-ax2">hAP ax²</option>
                    <option value="CHR">Cloud Hosted Router</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">WAN Interface</label>
                  <input value={formData.wan_interface} onChange={e => setFormData({...formData, wan_interface: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" placeholder="ether1" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">DNS Servers (comma-separated)</label>
                <input value={formData.dns_servers.join(', ')} onChange={e => setFormData({...formData, dns_servers: e.target.value.split(',').map(s => s.trim())})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" placeholder="8.8.8.8, 8.8.4.4" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">NTP Servers (comma-separated)</label>
                <input value={formData.ntp_servers.join(', ')} onChange={e => setFormData({...formData, ntp_servers: e.target.value.split(',').map(s => s.trim())})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" placeholder="pool.ntp.org" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">RADIUS Server IP</label>
                  <input value={formData.radius_server} onChange={e => setFormData({...formData, radius_server: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" placeholder="10.0.0.100" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">RADIUS Secret</label>
                  <input type="password" value={formData.radius_secret} onChange={e => setFormData({...formData, radius_secret: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" placeholder="shared-secret" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">RADIUS Port</label>
                  <input type="number" value={1812} onChange={e => setFormData({...formData, radius_port: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" />
                </div>
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-slate-300">
                  <input type="checkbox" checked={formData.hotspot_enabled} onChange={e => setFormData({...formData, hotspot_enabled: e.target.checked})} />
                  Enable Hotspot
                </label>
                <label className="flex items-center gap-2 text-slate-300">
                  <input type="checkbox" checked={formData.pppoe_enabled} onChange={e => setFormData({...formData, pppoe_enabled: e.target.checked})} />
                  Enable PPPoE Server
                </label>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" rows="2" placeholder="Location, contact, etc." />
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600">Cancel</button>
                <button type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Create Device</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Script Preview Modal */}
      {showScript && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg w-3/4 max-w-4xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Code className="w-5 h-5 text-green-500" /> Provision Script: {showScript.name}
              </h3>
              <div className="flex gap-2">
                <button onClick={() => downloadScript(showScript)}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1">
                  <Download className="w-4 h-4" /> Download
                </button>
                <button onClick={() => setShowScript(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <pre className="flex-1 p-6 text-sm text-green-400 font-mono overflow-auto">{showScript.content}</pre>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {showLogs && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg w-2/3 max-w-3xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-white font-semibold">Provision Logs: {showLogs.name}</h3>
              <button onClick={() => setShowLogs(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {logs.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No provisioning logs yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700">
                      <th className="text-left p-2">Time</th>
                      <th className="text-left p-2">Action</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">IP</th>
                      <th className="text-left p-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} className="border-b border-slate-700/50">
                        <td className="p-2 text-slate-400">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="p-2 text-white">{log.action}</td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            log.status === 'success' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
                          }`}>{log.status}</span>
                        </td>
                        <td className="p-2 text-slate-300">{log.ip_address}</td>
                        <td className="p-2 text-slate-400">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
