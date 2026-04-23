import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Building2, Mail, Phone, MapPin, Clock, DollarSign, FileText, Save, Upload, X, Shield, Check, X as XIcon, CreditCard, Globe, Lock } from 'lucide-react';
import { ROLES, FEATURE_ACCESS as DEFAULT_FEATURE_ACCESS } from '../lib/permissions';

const API = import.meta.env.VITE_API_URL || '/api';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [settings, setSettings] = useState({
    // General
    company_name: '',
    company_logo: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    city: '',
    country: '',
    // Formatting
    timezone: 'Africa/Nairobi',
    currency: 'KES',
    currency_symbol: 'KES',
    date_format: 'DD/MM/YYYY',
    // Invoice
    invoice_prefix: 'INV-',
    invoice_start_number: '1001',
    payment_terms: '14',
    tax_rate: '16',
  });

  const [logoPreview, setLogoPreview] = useState(null);

  // Permissions state
  const [permissions, setPermissions] = useState(DEFAULT_FEATURE_ACCESS);
  const [selectedRole, setSelectedRole] = useState(ROLES.ADMIN);

  // Payment gateway state
  const [paymentGateways, setPaymentGateways] = useState({
    mpesa: { enabled: false, consumer_key: '', consumer_secret: '', passkey: '', shortcode: '', environment: 'sandbox' },
    stripe: { enabled: false, publishable_key: '', secret_key: '', webhook_secret: '' },
    paypal: { enabled: false, client_id: '', client_secret: '', mode: 'sandbox' },
  });

  const allFeatures = [
    'dashboard', 'topology', 'router-linking', 'devices', 'templates', 'mikrotik-api', 'integrations', 'settings',
    'billing', 'customers', 'plans', 'subscriptions', 'invoices', 'payments', 'wallet', 'sms', 'whatsapp',
    'network-map', 'monitoring', 'agents', 'auto-suspend', 'reports', 'analytics', 'pppoe', 'hotspot',
    'vouchers', 'network-services', 'olt', 'radius', 'tickets', 'captive-portal', 'bandwidth', 'resellers',
    'backups', 'inventory', 'users',
  ];

  useEffect(() => {
    fetchSettings();
    fetchPermissions();
    fetchPaymentGateways();
  }, []);

  const fetchPermissions = async () => {
    try {
      const { data } = await axios.get(`${API}/settings/permissions`);
      if (data) {
        setPermissions(data);
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    }
  };

  const fetchPaymentGateways = async () => {
    try {
      const { data } = await axios.get(`${API}/settings/payment-gateways`);
      if (data) {
        setPaymentGateways(data);
      }
    } catch (error) {
      console.error('Failed to fetch payment gateways:', error);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/settings`);
      if (data) {
        setSettings(prev => ({ ...prev, ...data }));
        if (data.company_logo) {
          setLogoPreview(data.company_logo);
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
    setLoading(false);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
        setSettings(prev => ({ ...prev, company_logo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setSettings(prev => ({ ...prev, company_logo: '' }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await axios.put(`${API}/settings`, settings);
      setMessage({ type: 'success', text: 'Settings saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    }

    setSaving(false);
  };

  const handleSavePermissions = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await axios.put(`${API}/settings/permissions`, permissions);
      setMessage({ type: 'success', text: 'Permissions saved successfully. Reloading page...' });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Failed to save permissions:', error);
      setMessage({ type: 'error', text: 'Failed to save permissions' });
      setSaving(false);
    }
  };

  const toggleFeature = (role, feature) => {
    setPermissions(prev => ({
      ...prev,
      [role]: prev[role].includes(feature)
        ? prev[role].filter(f => f !== feature)
        : [...prev[role], feature]
    }));
  };

  const handleSavePaymentGateways = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await axios.put(`${API}/settings/payment-gateways`, paymentGateways);
      setMessage({ type: 'success', text: 'Payment gateway settings saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save payment gateways:', error);
      setMessage({ type: 'error', text: 'Failed to save payment gateway settings' });
    }

    setSaving(false);
  };

  const updatePaymentGateway = (gateway, field, value) => {
    setPaymentGateways(prev => ({
      ...prev,
      [gateway]: {
        ...prev[gateway],
        [field]: value
      }
    }));
  };

  const timezones = [
    'Africa/Nairobi', 'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
    'America/New_York', 'America/Los_Angeles', 'America/Chicago',
    'Asia/Dubai', 'Asia/Tokyo', 'Asia/Singapore', 'Asia/Shanghai',
    'Australia/Sydney', 'Pacific/Auckland'
  ];

  const currencies = [
    { code: 'KES', symbol: 'KES', name: 'Kenyan Shilling' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'UGX', symbol: 'UGX', name: 'Ugandan Shilling' },
    { code: 'TZS', symbol: 'TZS', name: 'Tanzanian Shilling' },
    { code: 'RWF', symbol: 'RWF', name: 'Rwandan Franc' },
    { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  ];

  const dateFormats = [
    'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY'
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-zinc-400 mt-1">Configure your application settings</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800 mb-6">
        {['general', 'permissions', 'payment-gateways', 'billing', 'network', 'notifications'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium capitalize transition-colors border-b-2 ${
              activeTab === tab
                ? 'text-blue-400 border-blue-500'
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            {tab.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* General Settings */}
      {activeTab === 'general' && (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Company Info */}
          <div className="glass rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5" /> Company Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Company Name *</label>
                <input
                  type="text"
                  value={settings.company_name}
                  onChange={e => setSettings({...settings, company_name: e.target.value})}
                  className="modern-input"
                  placeholder="Your ISP Name"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Company Logo</label>
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-zinc-800">
                      <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-zinc-800 flex items-center justify-center border-2 border-dashed border-zinc-700">
                      <Building2 className="w-8 h-8 text-zinc-600" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      id="logo-upload"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="logo-upload"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg cursor-pointer transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Upload Logo
                    </label>
                    <p className="text-xs text-zinc-500 mt-1">Recommended: 200x200px, PNG or JPG</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Contact Email</label>
                <input
                  type="email"
                  value={settings.contact_email}
                  onChange={e => setSettings({...settings, contact_email: e.target.value})}
                  className="modern-input"
                  placeholder="support@yourisp.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Contact Phone</label>
                <input
                  type="tel"
                  value={settings.contact_phone}
                  onChange={e => setSettings({...settings, contact_phone: e.target.value})}
                  className="modern-input"
                  placeholder="+254 700 000 000"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Address</label>
                <input
                  type="text"
                  value={settings.address}
                  onChange={e => setSettings({...settings, address: e.target.value})}
                  className="modern-input"
                  placeholder="Street address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">City</label>
                <input
                  type="text"
                  value={settings.city}
                  onChange={e => setSettings({...settings, city: e.target.value})}
                  className="modern-input"
                  placeholder="Nairobi"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Country</label>
                <input
                  type="text"
                  value={settings.country}
                  onChange={e => setSettings({...settings, country: e.target.value})}
                  className="modern-input"
                  placeholder="Kenya"
                />
              </div>
            </div>
          </div>

          {/* Formatting */}
          <div className="glass rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" /> Date & Currency Formatting
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Timezone</label>
                <select
                  value={settings.timezone}
                  onChange={e => setSettings({...settings, timezone: e.target.value})}
                  className="modern-input"
                >
                  {timezones.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Currency</label>
                <select
                  value={settings.currency}
                  onChange={e => {
                    const currency = currencies.find(c => c.code === e.target.value);
                    setSettings({...settings, currency: e.target.value, currency_symbol: currency?.symbol || e.target.value});
                  }}
                  className="modern-input"
                >
                  {currencies.map(c => (
                    <option key={c.code} value={c.code}>{c.name} ({c.symbol})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Date Format</label>
                <select
                  value={settings.date_format}
                  onChange={e => setSettings({...settings, date_format: e.target.value})}
                  className="modern-input"
                >
                  {dateFormats.map(df => (
                    <option key={df} value={df}>{df}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Invoice Settings */}
          <div className="glass rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" /> Invoice Settings
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Invoice Prefix</label>
                <input
                  type="text"
                  value={settings.invoice_prefix}
                  onChange={e => setSettings({...settings, invoice_prefix: e.target.value})}
                  className="modern-input"
                  placeholder="INV-"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Starting Number</label>
                <input
                  type="number"
                  value={settings.invoice_start_number}
                  onChange={e => setSettings({...settings, invoice_start_number: e.target.value})}
                  className="modern-input"
                  placeholder="1001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Payment Terms (Days)</label>
                <input
                  type="number"
                  value={settings.payment_terms}
                  onChange={e => setSettings({...settings, payment_terms: e.target.value})}
                  className="modern-input"
                  placeholder="14"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.tax_rate}
                  onChange={e => setSettings({...settings, tax_rate: e.target.value})}
                  className="modern-input"
                  placeholder="16"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}

      {/* Permissions Settings */}
      {activeTab === 'permissions' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" /> Role-Based Permissions
            </h2>
            <p className="text-zinc-400 text-sm mb-6">Configure which features each user role can access.</p>

            {/* Role Selector */}
            <div className="flex gap-2 mb-6">
              {Object.values(ROLES).map(role => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                    selectedRole === role
                      ? 'bg-blue-500 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {allFeatures.map(feature => {
                const hasAccess = permissions[selectedRole]?.includes(feature);
                return (
                  <button
                    key={feature}
                    onClick={() => toggleFeature(selectedRole, feature)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      hasAccess
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    {hasAccess ? <Check className="w-4 h-4" /> : <XIcon className="w-4 h-4" />}
                    <span className="capitalize">{feature.replace(/-/g, ' ')}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSavePermissions}
              disabled={saving}
              className="btn-primary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Permissions'}
            </button>
          </div>
        </div>
      )}

      {/* Payment Gateways Settings */}
      {activeTab === 'payment-gateways' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5" /> Payment Gateways
            </h2>
            <p className="text-zinc-400 text-sm mb-6">Configure payment gateways for accepting customer payments.</p>

            {/* M-Pesa */}
            <div className="mb-6 p-4 bg-zinc-800/50 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-semibold text-white flex items-center gap-2">
                  <Globe className="w-4 h-4" /> M-Pesa
                </h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={paymentGateways.mpesa.enabled}
                    onChange={(e) => updatePaymentGateway('mpesa', 'enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Consumer Key</label>
                  <input
                    type="text"
                    value={paymentGateways.mpesa.consumer_key}
                    onChange={(e) => updatePaymentGateway('mpesa', 'consumer_key', e.target.value)}
                    className="modern-input"
                    placeholder="Enter consumer key"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Consumer Secret</label>
                  <input
                    type="password"
                    value={paymentGateways.mpesa.consumer_secret}
                    onChange={(e) => updatePaymentGateway('mpesa', 'consumer_secret', e.target.value)}
                    className="modern-input"
                    placeholder="Enter consumer secret"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Passkey</label>
                  <input
                    type="password"
                    value={paymentGateways.mpesa.passkey}
                    onChange={(e) => updatePaymentGateway('mpesa', 'passkey', e.target.value)}
                    className="modern-input"
                    placeholder="Enter passkey"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Shortcode</label>
                  <input
                    type="text"
                    value={paymentGateways.mpesa.shortcode}
                    onChange={(e) => updatePaymentGateway('mpesa', 'shortcode', e.target.value)}
                    className="modern-input"
                    placeholder="174379"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Environment</label>
                  <select
                    value={paymentGateways.mpesa.environment}
                    onChange={(e) => updatePaymentGateway('mpesa', 'environment', e.target.value)}
                    className="modern-input"
                  >
                    <option value="sandbox">Sandbox</option>
                    <option value="production">Production</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Stripe */}
            <div className="mb-6 p-4 bg-zinc-800/50 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-semibold text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4" /> Stripe
                </h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={paymentGateways.stripe.enabled}
                    onChange={(e) => updatePaymentGateway('stripe', 'enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Publishable Key</label>
                  <input
                    type="text"
                    value={paymentGateways.stripe.publishable_key}
                    onChange={(e) => updatePaymentGateway('stripe', 'publishable_key', e.target.value)}
                    className="modern-input"
                    placeholder="pk_test_..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Secret Key</label>
                  <input
                    type="password"
                    value={paymentGateways.stripe.secret_key}
                    onChange={(e) => updatePaymentGateway('stripe', 'secret_key', e.target.value)}
                    className="modern-input"
                    placeholder="sk_test_..."
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Webhook Secret</label>
                  <input
                    type="password"
                    value={paymentGateways.stripe.webhook_secret}
                    onChange={(e) => updatePaymentGateway('stripe', 'webhook_secret', e.target.value)}
                    className="modern-input"
                    placeholder="whsec_..."
                  />
                </div>
              </div>
            </div>

            {/* PayPal */}
            <div className="mb-6 p-4 bg-zinc-800/50 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-semibold text-white flex items-center gap-2">
                  <Globe className="w-4 h-4" /> PayPal
                </h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={paymentGateways.paypal.enabled}
                    onChange={(e) => updatePaymentGateway('paypal', 'enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Client ID</label>
                  <input
                    type="text"
                    value={paymentGateways.paypal.client_id}
                    onChange={(e) => updatePaymentGateway('paypal', 'client_id', e.target.value)}
                    className="modern-input"
                    placeholder="Enter PayPal client ID"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Client Secret</label>
                  <input
                    type="password"
                    value={paymentGateways.paypal.client_secret}
                    onChange={(e) => updatePaymentGateway('paypal', 'client_secret', e.target.value)}
                    className="modern-input"
                    placeholder="Enter PayPal client secret"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Mode</label>
                  <select
                    value={paymentGateways.paypal.mode}
                    onChange={(e) => updatePaymentGateway('paypal', 'mode', e.target.value)}
                    className="modern-input"
                  >
                    <option value="sandbox">Sandbox</option>
                    <option value="live">Live</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSavePaymentGateways}
              disabled={saving}
              className="btn-primary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Payment Gateways'}
            </button>
          </div>
        </div>
      )}

      {/* Other tabs - placeholder */}
      {activeTab !== 'general' && activeTab !== 'permissions' && activeTab !== 'payment-gateways' && (
        <div className="glass rounded-2xl p-12 text-center">
          <div className="text-zinc-500">
            <p className="text-lg font-medium mb-2">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Settings</p>
            <p className="text-sm">Coming soon</p>
          </div>
        </div>
      )}
    </div>
  );
}
