import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Server, TestTube, Send, Trash2, Plus, Wifi, WifiOff, Clock, RefreshCw, Users, Download, X, Check } from 'lucide-react';
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
  
  // User import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [userType, setUserType] = useState('ppp'); // 'ppp' or 'hotspot'
  const [scanningUsers, setScanningUsers] = useState(false);
  const [foundUsers, setFoundUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const fetchConnections = async () => {
    try {
      const { data } = await axios.get(`${API}/mikrotik`);
      setConnections(data);
    } catch (error) {
      console.error('Failed to fetch connections:', error);
    }
  };

  const checkConnection = async (connectionId) => {
    try {
      const token = getToken();
      await axios.post(`${API}/mikrotik/${connectionId}/check`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Refresh connections to get updated status
      await fetchConnections();
    } catch (error) {
      console.error('Failed to check connection:', error);
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

  const handleScanUsers = async (connection) => {
    setSelectedConnection(connection);
    setScanningUsers(true);
    setFoundUsers([]);
    setSelectedUsers(new Set());
    setImportResult(null);
    
    try {
      const endpoint = userType === 'ppp' ? `/mikrotik/${connection.id}/ppp-secrets` : `/mikrotik/${connection.id}/hotspot-users`;
      const { data } = await axios.get(`${API}${endpoint}`);
      setFoundUsers(data.users || []);
      setShowImportModal(true);
    } catch (error) {
      alert('Failed to scan users: ' + (error.response?.data?.error || error.message));
    }
    
    setScanningUsers(false);
  };

  const toggleUserSelection = (userName) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userName)) {
      newSelected.delete(userName);
    } else {
      newSelected.add(userName);
    }
    setSelectedUsers(newSelected);
  };

  const selectAllUsers = () => {
    setSelectedUsers(new Set(foundUsers.map(u => u.name)));
  };

  const deselectAllUsers = () => {
    setSelectedUsers(new Set());
  };

  const handleImportUsers = async () => {
    if (selectedUsers.size === 0) {
      alert('Please select at least one user to import');
      return;
    }
    
    setImporting(true);
    setImportResult(null);
    
    try {
      const usersToImport = foundUsers.filter(u => selectedUsers.has(u.name));
      const { data } = await axios.post(`${API}/mikrotik/${selectedConnection.id}/import-users`, {
        users: usersToImport,
        userType
      });
      
      setImportResult(data);
      if (data.imported > 0) {
        info('Success', `Imported ${data.imported} users successfully`);
      }
    } catch (error) {
      alert('Failed to import users: ' + (error.response?.data?.error || error.message));
    }
    
    setImporting(false);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">MikroTik Connections</h2>
          <p className="text-slate-400">Manage and monitor your MikroTik router connections</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2">
            <div className="text-xs text-slate-400">Total Connections</div>
            <div className="text-xl font-bold text-white">{connections.length}</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2">
            <div className="text-xs text-slate-400">Online</div>
            <div className="text-xl font-bold text-emerald-400">{connections.filter(c => c.is_online).length}</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2">
            <div className="text-xs text-slate-400">Offline</div>
            <div className="text-xl font-bold text-red-400">{connections.filter(c => !c.is_online).length}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Connection Form */}
        <div className="lg:col-span-1 bg-slate-800 border border-slate-700 rounded-lg p-6">
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
        <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Saved Connections</h3>
            <button
              onClick={fetchConnections}
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <TestTube className="w-4 h-4" />
              Refresh
            </button>
          </div>
          {connections.length === 0 ? (
            <div className="text-center py-12">
              <Server className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No connections configured yet</p>
              <p className="text-sm text-slate-500 mt-1">Add your first MikroTik connection to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {connections.map((conn) => (
                <div key={conn.id} className={`bg-slate-700 rounded-lg p-4 border-l-4 ${conn.is_online ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-white text-lg">{conn.name}</h4>
                        {conn.is_online ? (
                          <span className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
                            <Wifi className="w-3 h-3" />
                            Online
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-medium">
                            <WifiOff className="w-3 h-3" />
                            Offline
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-400">IP: </span>
                          <span className="text-white">{conn.ip_address}:{conn.api_port}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">User: </span>
                          <span className="text-white">{conn.username}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Type: </span>
                          <span className="text-white capitalize">{conn.connection_type || 'API'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span className="text-slate-400">Last seen: </span>
                          <span className="text-white">{formatLastSeen(conn.last_seen)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleScanUsers(conn)}
                        disabled={scanningUsers}
                        className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 p-2 rounded-lg transition-colors disabled:opacity-50"
                        title="Scan for users"
                      >
                        <Users className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => checkConnection(conn.id)}
                        className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 p-2 rounded-lg transition-colors"
                        title="Check connectivity"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(conn.id)}
                        className="bg-red-600/20 hover:bg-red-600/30 text-red-400 p-2 rounded-lg transition-colors"
                        title="Delete connection"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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

      {/* User Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Import Users from {selectedConnection?.name}
                </h3>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-300">User Type:</label>
                  <select
                    value={userType}
                    onChange={(e) => setUserType(e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                  >
                    <option value="ppp">PPP Secrets</option>
                    <option value="hotspot">Hotspot Users</option>
                  </select>
                </div>
                <button
                  onClick={() => handleScanUsers(selectedConnection)}
                  disabled={scanningUsers}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${scanningUsers ? 'animate-spin' : ''}`} />
                  Scan
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[50vh]">
              {scanningUsers ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-2" />
                  <p className="text-slate-400">Scanning for users...</p>
                </div>
              ) : foundUsers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-400">No users found</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-slate-400">
                      Found {foundUsers.length} users • {selectedUsers.size} selected
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={selectAllUsers}
                        className="text-sm text-blue-400 hover:text-blue-300"
                      >
                        Select All
                      </button>
                      <button
                        onClick={deselectAllUsers}
                        className="text-sm text-slate-400 hover:text-slate-300"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {foundUsers.map((user) => (
                      <div
                        key={user.name}
                        onClick={() => toggleUserSelection(user.name)}
                        className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                          selectedUsers.has(user.name)
                            ? 'bg-blue-600/20 border-blue-500'
                            : 'bg-slate-700 border-slate-600 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                              selectedUsers.has(user.name)
                                ? 'bg-blue-500 border-blue-500'
                                : 'border-slate-500'
                            }`}>
                              {selectedUsers.has(user.name) && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <div>
                              <div className="font-medium text-white">{user.name}</div>
                              <div className="text-sm text-slate-400">
                                {user.profile && `Profile: ${user.profile}`}
                                {user.comment && ` • ${user.comment}`}
                              </div>
                            </div>
                          </div>
                          {user.disabled && (
                            <span className="text-xs text-red-400 bg-red-500/20 px-2 py-1 rounded">Disabled</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {importResult && (
              <div className={`p-4 border-t border-slate-700 ${
                importResult.imported > 0 ? 'bg-green-600/10' : 'bg-red-600/10'
              }`}>
                <div className="text-sm">
                  <span className={`font-medium ${importResult.imported > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {importResult.imported} users imported successfully
                  </span>
                  {importResult.errors > 0 && (
                    <span className="text-red-400 ml-2">
                      ({importResult.errors} failed)
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleImportUsers}
                disabled={importing || selectedUsers.size === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {importing ? 'Importing...' : `Import ${selectedUsers.size} Users`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
