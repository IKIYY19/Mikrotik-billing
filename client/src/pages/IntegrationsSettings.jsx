import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  MessageSquare, CreditCard, Smartphone, Mail, Cloud, Activity, 
  Save, TestTube2, Eye, EyeOff, CheckCircle, XCircle, Loader2,
  Plus, Settings, Key, Globe
} from 'lucide-react';
import { useToast } from '../hooks/useToast';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function IntegrationsSettings() {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState({});
  const [showKeys, setShowKeys] = useState({});
  const [editingId, setEditingId] = useState(null);
  const toast = useToast();

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/integrations`);
      setIntegrations(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
      toast.error('Failed to load integrations');
      setLoading(false);
    }
  };

  const handleSave = async (integration) => {
    try {
      setSaving(true);
      const { data } = await axios.put(`${API_URL}/integrations/${integration.id}`, {
        config_data: integration.config_data,
        is_active: integration.is_active,
      });
      
      setIntegrations(prev => prev.map(i => i.id === integration.id ? data.integration : i));
      setEditingId(null);
      toast.success(`${integration.display_name} saved successfully`);
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save integration');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (integration) => {
    try {
      setTesting(prev => ({ ...prev, [integration.id]: true }));
      const { data } = await axios.post(`${API_URL}/integrations/${integration.id}/test`);
      
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }

      fetchIntegrations(); // Refresh to get updated test status
    } catch (error) {
      console.error('Test error:', error);
      toast.error('Test connection failed');
    } finally {
      setTesting(prev => ({ ...prev, [integration.id]: false }));
    }
  };

  const toggleKey = (id) => {
    setShowKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const updateConfig = (integration, key, value) => {
    setIntegrations(prev => prev.map(i => 
      i.id === integration.id 
        ? { ...i, config_data: { ...i.config_data, [key]: value } }
        : i
    ));
  };

  const toggleActive = async (integration) => {
    try {
      const { data } = await axios.put(`${API_URL}/integrations/${integration.id}`, {
        config_data: integration.config_data,
        is_active: !integration.is_active,
      });
      
      setIntegrations(prev => prev.map(i => i.id === integration.id ? data.integration : i));
    } catch (error) {
      toast.error('Failed to toggle integration');
    }
  };

  const categoryIcons = {
    sms: MessageSquare,
    payment: CreditCard,
    messaging: Smartphone,
    email: Mail,
    storage: Cloud,
    monitoring: Activity,
  };

  const categoryColors = {
    sms: 'from-blue-500 to-cyan-500',
    payment: 'from-emerald-500 to-teal-500',
    messaging: 'from-violet-500 to-purple-500',
    email: 'from-orange-500 to-amber-500',
    storage: 'from-pink-500 to-rose-500',
    monitoring: 'from-indigo-500 to-blue-500',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117] p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Integration Settings</h1>
          <p className="text-gray-400">Manage API keys for external services</p>
        </div>

        {/* Integrations Grid */}
        <div className="grid gap-6">
          {integrations.map(integration => {
            const Icon = categoryIcons[integration.category] || Settings;
            const isEditing = editingId === integration.id;
            const isTesting = testing[integration.id];
            const configKeys = Object.keys(integration.config_data || {});

            return (
              <div 
                key={integration.id}
                className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all"
              >
                {/* Header */}
                <div className="p-6 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${categoryColors[integration.category]} flex items-center justify-center`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white">{integration.display_name}</h3>
                        <p className="text-sm text-gray-400 capitalize">{integration.category}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Status Badge */}
                      {integration.last_test_status && (
                        <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                          integration.last_test_status === 'success' 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {integration.last_test_status === 'success' ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          {integration.last_test_status === 'success' ? 'Connected' : 'Failed'}
                        </div>
                      )}

                      {/* Active Toggle */}
                      <button
                        onClick={() => toggleActive(integration)}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                          integration.is_active
                            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                            : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                        }`}
                      >
                        {integration.is_active ? 'Active' : 'Inactive'}
                      </button>

                      {/* Test Button */}
                      <button
                        onClick={() => handleTest(integration)}
                        disabled={isTesting}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all disabled:opacity-50"
                      >
                        {isTesting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <TestTube2 className="w-4 h-4" />
                        )}
                        Test
                      </button>

                      {/* Save Button */}
                      {isEditing && (
                        <button
                          onClick={() => handleSave(integration)}
                          disabled={saving}
                          className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all disabled:opacity-50"
                        >
                          {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          Save
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Last Test Message */}
                  {integration.last_test_message && (
                    <p className="mt-3 text-sm text-gray-400">{integration.last_test_message}</p>
                  )}
                </div>

                {/* Config Fields */}
                <div className="p-6 space-y-4">
                  {configKeys.map(key => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-300 mb-2 capitalize">
                        {key.replace(/_/g, ' ')}
                      </label>
                      <div className="relative">
                        <input
                          type={showKeys[integration.id] ? 'text' : 'password'}
                          value={integration.config_data[key] || ''}
                          onChange={(e) => updateConfig(integration, key, e.target.value)}
                          onFocus={() => setEditingId(integration.id)}
                          className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder={`Enter ${key.replace(/_/g, ' ')}`}
                        />
                        <button
                          onClick={() => toggleKey(integration.id)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {showKeys[integration.id] ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {integrations.length === 0 && (
          <div className="text-center py-20">
            <Settings className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Integrations Found</h3>
            <p className="text-gray-400">Integration templates will be created on next server restart</p>
          </div>
        )}
      </div>
    </div>
  );
}
