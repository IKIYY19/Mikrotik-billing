import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Server, TestTube, Send, Trash2, Plus, Wifi, WifiOff, Clock } from 'lucide-react';
import { useToast } from '../hooks/useToast';

const API = import.meta.env.VITE_API_URL || '/api';

// Helper function to format relative time
const formatLastSeen = (date) => {
  if (!date) return 'Never';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

export function MikroTikAPI() {
  const { info } = useToast();
  const [connections, setConnections] = useState([]);
  const [connectionType, setConnectionType] = useState('api'); // 'api' or 'ssh'
  const [formData, setFormData] = useState({
    name: '',
    ip_address: '',
    api_port: 8728,
    ssh_port: 22,
    username: '',
    password: '',
    use_tunnel: false,
    tunnel_host: '',
    tunnel_port: 22,
    tunnel_username: '',
    tunnel_password: '',
  });
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchConnections = async () => {
    try {
      const { data } = await axios.get(`${API}/mikrotik`);
      setConnections(data);
    } catch (error) {
      console.error('Failed to fetch connections:', error);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleTest = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      const { data } = await axios.post(`${API}/mikrotik/test`, formData);
      setTestResult(data);
    } catch (error) {
      setTestResult({ success: false, message: error.response?.data?.error || error.message });
    }
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await axios.post(`${API}/mikrotik`, formData);
      setConnections([...connections, data]);
      setFormData({ name: '', ip_address: '', api_port: 8728, username: '', password: '' });
      setTestResult({ success: true, message: 'Connection saved successfully' });
    } catch (error) {
      setTestResult({ success: false, message: error.response?.data?.error || error.message });
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this connection?')) return;
    try {
      await axios.delete(`${API}/mikrotik/${id}`);
      setConnections(connections.filter(c => c.id !== id));
      info('Success', 'Connection deleted successfully');
    } catch (error) {
      alert('Failed to delete connection');
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-8">MikroTik API Connection</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Connection Form */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Server className="w-5 h-5" />
            Add Connection
          </h3>
          
          {/* Connection Type Toggle */}
          <div className="mb-4">
            <label className="block text-sm text-slate-300 mb-2">Connection Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConnectionType('api')}
                className={`flex-1 px-4 py-2 rounded ${connectionType === 'api' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
              >
                API
              </button>
              <button
                type="button"
                onClick={() => setConnectionType('ssh')}
                className={`flex-1 px-4 py-2 rounded ${connectionType === 'ssh' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
              >
                SSH
              </button>
            </div>
          </div>

          <form onSubmit={handleSave}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                  placeholder="e.g., Office Router"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">IP Address</label>
                <input
                  type="text"
                  value={formData.ip_address}
                  onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                  placeholder="192.168.1.1"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  {connectionType === 'api' ? 'API Port' : 'SSH Port'}
                </label>
                <input
                  type="number"
                  value={connectionType === 'api' ? formData.api_port : formData.ssh_port}
                  onChange={(e) => setFormData(connectionType === 'api' 
                    ? { ...formData, api_port: e.target.value }
                    : { ...formData, ssh_port: e.target.value }
                  )}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                  placeholder={connectionType === 'api' ? '8728' : '22'}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                />
              </div>

              {/* SSH Tunnel Section */}
              {connectionType === 'ssh' && (
                <div className="border-t border-slate-600 pt-4 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      id="use_tunnel"
                      checked={formData.use_tunnel}
                      onChange={(e) => setFormData({ ...formData, use_tunnel: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <label htmlFor="use_tunnel" className="text-sm text-slate-300">
                      Use SSH Tunnel (for remote access)
                    </label>
                  </div>

                  {formData.use_tunnel && (
                    <div className="space-y-3 bg-slate-700/50 p-3 rounded">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Tunnel Host (Jump Server)</label>
                        <input
                          type="text"
                          value={formData.tunnel_host}
                          onChange={(e) => setFormData({ ...formData, tunnel_host: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                          placeholder="e.g., your-server.com"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Tunnel Port</label>
                        <input
                          type="number"
                          value={formData.tunnel_port}
                          onChange={(e) => setFormData({ ...formData, tunnel_port: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                          placeholder="22"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Tunnel Username</label>
                        <input
                          type="text"
                          value={formData.tunnel_username}
                          onChange={(e) => setFormData({ ...formData, tunnel_username: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Tunnel Password</label>
                        <input
                          type="password"
                          value={formData.tunnel_password}
                          onChange={(e) => setFormData({ ...formData, tunnel_password: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={handleTest}
                disabled={loading}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <TestTube className="w-4 h-4" />
                Test Connection
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>

          {testResult && (
            <div className={`mt-4 p-3 rounded ${testResult.success ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
              {testResult.message}
            </div>
          )}
        </div>

        {/* Saved Connections */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Saved Connections</h3>
          {connections.length === 0 ? (
            <p className="text-slate-400">No saved connections.</p>
          ) : (
            <div className="space-y-3">
              {connections.map((conn) => (
                <div key={conn.id} className="bg-slate-700 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-white">{conn.name}</h4>
                        {conn.is_online ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-400">
                            <Wifi className="w-3 h-3" />
                            Online
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-red-400">
                            <WifiOff className="w-3 h-3" />
                            Offline
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400">{conn.ip_address}:{conn.api_port}</p>
                      <p className="text-xs text-slate-500">User: {conn.username}</p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        Last seen: {formatLastSeen(conn.last_seen)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(conn.id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 p-4 bg-yellow-600/20 border border-yellow-600/50 rounded">
            <h4 className="text-yellow-400 font-semibold mb-2">⚠️ Warning</h4>
            <p className="text-sm text-yellow-300">
              Pushing scripts directly to MikroTik devices will execute commands immediately. 
              Always test your configuration in a lab environment first. Use the dry-run option 
              to preview changes before applying.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
