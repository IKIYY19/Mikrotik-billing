import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Router, Plus, Trash2, Copy, Download, Eye, RefreshCw,
  Terminal, Shield, Settings, CheckCircle, Clock, X, Code, FileText, Zap
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function Devices() {
  const [devices, setDevices] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showScript, setShowScript] = useState(null);
  const [showLogs, setShowLogs] = useState(null);
  const [showCommand, setShowCommand] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [provisionMethod, setProvisionMethod] = useState('import');
  const [commandLoading, setCommandLoading] = useState({});
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

  const getProvisionCommand = async (device, method = 'import') => {
    setCommandLoading(prev => ({ ...prev, [device.id]: true }));
    try {
      const { data } = await axios.get(`/mikrotik/provision/command/${device.id}`, {
        params: { method, baseUrl: window.location.origin }
      });
      setShowCommand({ ...device, ...data, method });
    } catch (e) { 
      console.error(e);
      // Fallback to manual command
      const serverUrl = window.location.origin;
      const token = device.provision_token;
      let command;
      switch (method) {
        case 'import':
          command = `/import file-name=provision.rsc url="${serverUrl}/mikrotik/provision/${token}"`;
          break;
        case 'script':
          command = `/tool fetch mode=https url="${serverUrl}/mikrotik/provision/${token}" dst-path=provision.rsc; /import file-name=provision.rsc`;
          break;
        case 'fetch':
          command = `/tool fetch mode=https url="${serverUrl}/mikrotik/provision/${token}" dst-path=provision.rsc`;
          break;
        case 'inline':
          command = `/tool fetch mode=https url="${serverUrl}/mikrotik/provision/${token}" dst-path=provision.rsc; /import file-name=provision.rsc; /file remove provision.rsc`;
          break;
        default:
          command = `/import file-name=provision.rsc url="${serverUrl}/mikrotik/provision/${token}"`;
      }
      setShowCommand({ ...device, command, copyText: command, method, serverUrl, token });
    } finally {
      setCommandLoading(prev => ({ ...prev, [device.id]: false }));
    }
  };

  const copyCommand = (text) => {
    navigator.clipboard.writeText(text);
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

  const provisionMethods = [
    { id: 'import', name: 'Import', icon: Zap, description: 'Direct import from URL' },
    { id: 'script', name: 'Script', icon: Code, description: 'Fetch then import' },
    { id: 'fetch', name: 'Fetch Only', icon: Download, description: 'Download for manual import' },
    { id: 'inline', name: 'Inline', icon: Terminal, description: 'Fetch, import, cleanup' },
  ];

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Zero-Touch Provisioning</h2>
          <p className="text-slate-400 mt-1">Add routers, generate one-line provision commands</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2">
          <Plus className="w-5 h-5" /> Add Device
        </Button>
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
            <Card key={dev.id} className="overflow-hidden">
              {/* Header */}
              <CardHeader className="border-b border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Router className="w-6 h-6 text-blue-500" />
                    <div>
                      <CardTitle className="text-lg">{dev.name}</CardTitle>
                      <CardDescription>{dev.identity || dev.name} • {dev.model || 'Unknown model'}</CardDescription>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    dev.provision_status === 'provisioned' ? 'bg-green-600/20 text-green-400' : 'bg-amber-600/20 text-amber-400'
                  }`}>
                    {dev.provision_status === 'provisioned' ? '✓ Provisioned' : '⏳ Pending'}
                  </span>
                </div>
              </CardHeader>

              {/* Provision Command */}
              <CardContent className="p-4 bg-zinc-900/50">
                <h4 className="text-xs text-zinc-400 uppercase mb-2 flex items-center gap-1">
                  <Terminal className="w-3 h-3" /> One-Line Provision Command
                </h4>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {provisionMethods.map(method => {
                      const Icon = method.icon;
                      return (
                        <Button
                          key={method.id}
                          variant={provisionMethod === method.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => getProvisionCommand(dev, method.id)}
                          disabled={commandLoading[dev.id]}
                          className="flex-1"
                          title={method.description}
                        >
                          <Icon className="w-3 h-3 mr-1" /> {method.name}
                        </Button>
                      );
                    })}
                  </div>
                  <pre className="text-xs text-green-400 bg-zinc-800 p-3 rounded border border-zinc-700 overflow-x-auto whitespace-pre-wrap font-mono min-h-[60px]">
                    {commandLoading[dev.id] ? 'Loading...' : (showCommand?.id === dev.id ? showCommand.copyText : 'Select a method above')}
                  </pre>
                  {showCommand?.id === dev.id && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => copyCommand(showCommand.copyText)} className="flex items-center gap-1">
                        <Copy className="w-3 h-3" /> {copied ? 'Copied!' : 'Copy'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => getProvisionCommand(dev, showCommand.method)} className="flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" /> Regenerate Token
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>

              {/* Settings */}
              <CardContent className="p-4 grid grid-cols-2 gap-3 text-sm border-t border-zinc-800">
                <div className="text-zinc-400">WAN: <span className="text-white">{dev.wan_interface}</span></div>
                <div className="text-zinc-400">DNS: <span className="text-white">{dev.dns_servers?.join(', ')}</span></div>
                <div className="text-zinc-400">RADIUS: <span className="text-white">{dev.radius_server || 'Not set'}</span></div>
                <div className="text-zinc-400">PPPoE: <span className="text-white">{dev.pppoe_enabled ? 'Yes' : 'No'}</span></div>
              </CardContent>

              {/* Actions */}
              <CardContent className="p-4 border-t border-zinc-800 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => viewScript(dev)} className="flex items-center gap-1">
                  <Eye className="w-3 h-3" /> Preview
                </Button>
                <Button variant="outline" size="sm" onClick={() => viewLogs(dev)} className="flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Logs
                </Button>
                <Button variant="outline" size="sm" onClick={() => regenerateToken(dev.id)} className="flex items-center gap-1 text-amber-400">
                  <RefreshCw className="w-3 h-3" /> New Token
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadScript(dev)} className="flex items-center gap-1 text-green-400">
                  <Download className="w-3 h-3" /> .rsc
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(dev.id)} className="flex items-center gap-1 text-red-400 ml-auto">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <CardTitle>Add New Device</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}><X className="w-5 h-5" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4 pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="device-name">Name *</Label>
                    <Input
                      id="device-name"
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      placeholder="Branch-Router-01"
                    />
                  </div>
                  <div>
                    <Label htmlFor="device-identity">Identity</Label>
                    <Input
                      id="device-identity"
                      value={formData.identity}
                      onChange={e => setFormData({...formData, identity: e.target.value})}
                      placeholder="MY-BRANCH-01"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="device-model">Model</Label>
                    <select
                      id="device-model"
                      value={formData.model}
                      onChange={e => setFormData({...formData, model: e.target.value})}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
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
                    <Label htmlFor="device-wan">WAN Interface</Label>
                    <Input
                      id="device-wan"
                      value={formData.wan_interface}
                      onChange={e => setFormData({...formData, wan_interface: e.target.value})}
                      placeholder="ether1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="device-dns">DNS Servers (comma-separated)</Label>
                  <Input
                    id="device-dns"
                    value={formData.dns_servers.join(', ')}
                    onChange={e => setFormData({...formData, dns_servers: e.target.value.split(',').map(s => s.trim())})}
                    placeholder="8.8.8.8, 8.8.4.4"
                  />
                </div>
                <div>
                  <Label htmlFor="device-ntp">NTP Servers (comma-separated)</Label>
                  <Input
                    id="device-ntp"
                    value={formData.ntp_servers.join(', ')}
                    onChange={e => setFormData({...formData, ntp_servers: e.target.value.split(',').map(s => s.trim())})}
                    placeholder="pool.ntp.org"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="device-radius-ip">RADIUS Server IP</Label>
                    <Input
                      id="device-radius-ip"
                      value={formData.radius_server}
                      onChange={e => setFormData({...formData, radius_server: e.target.value})}
                      placeholder="10.0.0.100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="device-radius-secret">RADIUS Secret</Label>
                    <Input
                      id="device-radius-secret"
                      type="password"
                      value={formData.radius_secret}
                      onChange={e => setFormData({...formData, radius_secret: e.target.value})}
                      placeholder="shared-secret"
                    />
                  </div>
                  <div>
                    <Label htmlFor="device-radius-port">RADIUS Port</Label>
                    <Input
                      id="device-radius-port"
                      type="number"
                      value={1812}
                      onChange={e => setFormData({...formData, radius_port: e.target.value})}
                    />
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.hotspot_enabled}
                      onCheckedChange={checked => setFormData({...formData, hotspot_enabled: checked})}
                    />
                    <Label className="text-zinc-300">Enable Hotspot</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.pppoe_enabled}
                      onCheckedChange={checked => setFormData({...formData, pppoe_enabled: checked})}
                    />
                    <Label className="text-zinc-300">Enable PPPoE Server</Label>
                  </div>
                </div>
                <div>
                  <Label htmlFor="device-notes">Notes</Label>
                  <textarea
                    id="device-notes"
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    rows="2"
                    placeholder="Location, contact, etc."
                  />
                </div>
                <div className="flex gap-3 pt-4 border-t border-zinc-800">
                  <Button type="button" variant="outline" onClick={() => setShowCreate(false)} className="flex-1">Cancel</Button>
                  <Button type="submit" className="flex-1">Create Device</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Script Preview Modal */}
      {showScript && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="w-3/4 max-w-4xl max-h-[80vh] flex flex-col">
            <CardHeader className="border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Code className="w-5 h-5 text-green-500" /> Provision Script: {showScript.name}
                </CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => downloadScript(showScript)} className="flex items-center gap-1">
                    <Download className="w-4 h-4" /> Download
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowScript(null)}><X className="w-5 h-5" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-6">
              <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">{showScript.content}</pre>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Logs Modal */}
      {showLogs && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="w-2/3 max-w-3xl max-h-[80vh] flex flex-col">
            <CardHeader className="border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <CardTitle>Provision Logs: {showLogs.name}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowLogs(null)}><X className="w-5 h-5" /></Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4">
              {logs.length === 0 ? (
                <p className="text-zinc-500 text-center py-8">No provisioning logs yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-zinc-400 border-b border-zinc-800">
                      <th className="text-left p-2">Time</th>
                      <th className="text-left p-2">Action</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">IP</th>
                      <th className="text-left p-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} className="border-b border-zinc-800/50">
                        <td className="p-2 text-zinc-400">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="p-2 text-white">{log.action}</td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            log.status === 'success' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
                          }`}>{log.status}</span>
                        </td>
                        <td className="p-2 text-zinc-300">{log.ip_address}</td>
                        <td className="p-2 text-zinc-400">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
