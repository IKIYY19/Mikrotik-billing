import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Server, TestTube, Send, Trash2, Plus } from 'lucide-react';
import { useToast } from '../hooks/useToast';

const API = import.meta.env.VITE_API_URL || '/api';

export function MikroTikAPI() {
  const { info } = useToast();
  const [connections, setConnections] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    ip_address: '',
    api_port: 8728,
    username: '',
    password: '',
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
                <label className="block text-sm text-slate-300 mb-2">API Port</label>
                <input
                  type="number"
                  value={formData.api_port}
                  onChange={(e) => setFormData({ ...formData, api_port: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
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
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                Save
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
                    <div>
                      <h4 className="font-semibold text-white">{conn.name}</h4>
                      <p className="text-sm text-slate-400">{conn.ip_address}:{conn.api_port}</p>
                      <p className="text-xs text-slate-500">User: {conn.username}</p>
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
