import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Building2, Mail, Phone, MapPin, Clock, DollarSign, FileText, Save, Upload, X, Shield, Check, X as XIcon, CreditCard, Globe, Lock, Palette, Sun, Moon, Wifi, Plus, Download, Trash2 } from 'lucide-react';
import { ROLES, FEATURE_ACCESS as DEFAULT_FEATURE_ACCESS } from '../lib/permissions';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { useTheme } from '../contexts/ThemeContext';

const API = import.meta.env.VITE_API_URL || '/api';

export function SettingsPage() {
  const { theme, setTheme, mode, setMode, themes } = useTheme();
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

  // Bank paybill state
  const [bankPaybills, setBankPaybills] = useState({
    enabled: false,
    banks: [
      { name: 'Equity Bank', paybill: '247247', account_number: '', enabled: true },
      { name: 'KCB Bank', paybill: '522522', account_number: '', enabled: true },
      { name: 'Co-operative Bank', paybill: '400200', account_number: '', enabled: true },
      { name: 'Standard Chartered', paybill: '320320', account_number: '', enabled: false },
      { name: 'Absa Bank', paybill: '303030', account_number: '', enabled: false },
      { name: 'NCBA Bank', paybill: '880200', account_number: '', enabled: false },
      { name: 'Diamond Trust Bank', paybill: '444444', account_number: '', enabled: false },
      { name: 'I&M Bank', paybill: '545500', account_number: '', enabled: false },
    ],
  });

  // WireGuard state
  const [wireguard, setWireguard] = useState({
    enabled: false,
    server_port: '51820',
    server_private_key: '',
    server_public_key: '',
    server_address: '10.0.0.1',
    server_dns: '1.1.1.1',
    peers: [],
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
    fetchBankPaybills();
    fetchWireguard();
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

  const fetchBankPaybills = async () => {
    try {
      const { data } = await axios.get(`${API}/settings/bank-paybills`);
      if (data) {
        setBankPaybills(data);
      }
    } catch (error) {
      console.error('Failed to fetch bank paybills:', error);
    }
  };

  const fetchWireguard = async () => {
    try {
      const { data } = await axios.get(`${API}/settings/wireguard`);
      if (data) {
        setWireguard(data);
      }
    } catch (error) {
      console.error('Failed to fetch WireGuard settings:', error);
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

  const handleSaveBankPaybills = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await axios.put(`${API}/settings/bank-paybills`, bankPaybills);
      setMessage({ type: 'success', text: 'Bank paybill settings saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save bank paybills:', error);
      setMessage({ type: 'error', text: 'Failed to save bank paybill settings' });
    }

    setSaving(false);
  };

  const updateBankPaybill = (index, field, value) => {
    setBankPaybills(prev => ({
      ...prev,
      banks: prev.banks.map((bank, i) =>
        i === index ? { ...bank, [field]: value } : bank
      )
    }));
  };

  const handleSaveWireguard = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await axios.put(`${API}/settings/wireguard`, wireguard);
      setMessage({ type: 'success', text: 'WireGuard settings saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save WireGuard settings:', error);
      setMessage({ type: 'error', text: 'Failed to save WireGuard settings' });
    }

    setSaving(false);
  };

  const updateWireguard = (field, value) => {
    setWireguard(prev => ({ ...prev, [field]: value }));
  };

  const handleAddPeer = async () => {
    const newPeer = {
      name: `Peer ${wireguard.peers.length + 1}`,
      public_key: '',
      allowed_ips: `10.0.0.${wireguard.peers.length + 2}/32`,
      preshared_key: '',
    };

    try {
      const { data } = await axios.post(`${API}/settings/wireguard/peers`, newPeer);
      setWireguard(prev => ({ ...prev, peers: [...prev.peers, data] }));
      setMessage({ type: 'success', text: 'Peer added successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to add peer:', error);
      setMessage({ type: 'error', text: 'Failed to add peer' });
    }
  };

  const handleDeletePeer = async (peerId) => {
    try {
      await axios.delete(`${API}/settings/wireguard/peers/${peerId}`);
      setWireguard(prev => ({
        ...prev,
        peers: prev.peers.filter(p => p.id !== peerId)
      }));
      setMessage({ type: 'success', text: 'Peer deleted successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to delete peer:', error);
      setMessage({ type: 'error', text: 'Failed to delete peer' });
    }
  };

  const handleGenerateConfig = async (peerId, endpoint) => {
    try {
      const { data } = await axios.post(`${API}/settings/wireguard/config/${peerId}`, { endpoint });
      const blob = new Blob([data.config], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wireguard-${peerId}.conf`;
      a.click();
      window.URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'Config file downloaded' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to generate config:', error);
      setMessage({ type: 'error', text: 'Failed to generate config' });
    }
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
        {['general', 'permissions', 'payment-gateways', 'bank-paybills', 'wireguard', 'billing', 'network', 'notifications'].map(tab => (
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" /> Company Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="company-name">Company Name *</Label>
                  <Input
                    id="company-name"
                    type="text"
                    value={settings.company_name}
                    onChange={e => setSettings({...settings, company_name: e.target.value})}
                    placeholder="Your ISP Name"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Company Logo</Label>
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
                  <Label htmlFor="contact-email">Contact Email</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={settings.contact_email}
                    onChange={e => setSettings({...settings, contact_email: e.target.value})}
                    placeholder="support@yourisp.com"
                  />
                </div>
                <div>
                  <Label htmlFor="contact-phone">Contact Phone</Label>
                  <Input
                    id="contact-phone"
                    type="tel"
                    value={settings.contact_phone}
                    onChange={e => setSettings({...settings, contact_phone: e.target.value})}
                    placeholder="+254 700 000 000"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    type="text"
                    value={settings.address}
                    onChange={e => setSettings({...settings, address: e.target.value})}
                    placeholder="Street address"
                  />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    type="text"
                    value={settings.city}
                    onChange={e => setSettings({...settings, city: e.target.value})}
                    placeholder="Nairobi"
                  />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    type="text"
                    value={settings.country}
                    onChange={e => setSettings({...settings, country: e.target.value})}
                    placeholder="Kenya"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Formatting */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" /> Date & Currency Formatting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <select
                    id="timezone"
                    value={settings.timezone}
                    onChange={e => setSettings({...settings, timezone: e.target.value})}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {timezones.map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <select
                    id="currency"
                    value={settings.currency}
                    onChange={e => {
                      const currency = currencies.find(c => c.code === e.target.value);
                      setSettings({...settings, currency: e.target.value, currency_symbol: currency?.symbol || e.target.value});
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {currencies.map(c => (
                      <option key={c.code} value={c.code}>{c.name} ({c.symbol})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="date-format">Date Format</Label>
                  <select
                    id="date-format"
                    value={settings.date_format}
                    onChange={e => setSettings({...settings, date_format: e.target.value})}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {dateFormats.map(df => (
                      <option key={df} value={df}>{df}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Theme Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" /> Appearance
              </CardTitle>
              <CardDescription>Customize the look and feel of your application.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Color Theme */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Color Theme</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {themes.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        theme === t.id
                          ? 'border-primary bg-primary/10'
                          : 'border-zinc-700 hover:border-zinc-600'
                      }`}
                    >
                      <div className="text-sm font-medium text-white mb-1">{t.name}</div>
                      <div className="text-xs text-zinc-400">{t.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Light/Dark Mode */}
              <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  {mode === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  <div>
                    <div className="font-medium text-white">Dark Mode</div>
                    <div className="text-sm text-zinc-400">Toggle between light and dark theme</div>
                  </div>
                </div>
                <Switch
                  checked={mode === 'dark'}
                  onCheckedChange={(checked) => setMode(checked ? 'dark' : 'light')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Invoice Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" /> Invoice Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="invoice-prefix">Invoice Prefix</Label>
                  <Input
                    id="invoice-prefix"
                    type="text"
                    value={settings.invoice_prefix}
                    onChange={e => setSettings({...settings, invoice_prefix: e.target.value})}
                    placeholder="INV-"
                  />
                </div>
                <div>
                  <Label htmlFor="invoice-start">Starting Number</Label>
                  <Input
                    id="invoice-start"
                    type="number"
                    value={settings.invoice_start_number}
                    onChange={e => setSettings({...settings, invoice_start_number: e.target.value})}
                    placeholder="1001"
                  />
                </div>
                <div>
                  <Label htmlFor="payment-terms">Payment Terms (Days)</Label>
                  <Input
                    id="payment-terms"
                    type="number"
                    value={settings.payment_terms}
                    onChange={e => setSettings({...settings, payment_terms: e.target.value})}
                    placeholder="14"
                  />
                </div>
                <div>
                  <Label htmlFor="tax-rate">Tax Rate (%)</Label>
                  <Input
                    id="tax-rate"
                    type="number"
                    step="0.1"
                    value={settings.tax_rate}
                    onChange={e => setSettings({...settings, tax_rate: e.target.value})}
                    placeholder="16"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </form>
      )}

      {/* Permissions Settings */}
      {activeTab === 'permissions' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" /> Role-Based Permissions
              </CardTitle>
              <CardDescription>Configure which features each user role can access.</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Role Selector */}
              <div className="flex gap-2 mb-6">
                {Object.values(ROLES).map(role => (
                  <Button
                    key={role}
                    variant={selectedRole === role ? 'default' : 'outline'}
                    onClick={() => setSelectedRole(role)}
                    className="capitalize"
                  >
                    {role}
                  </Button>
                ))}
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {allFeatures.map(feature => {
                  const hasAccess = permissions[selectedRole]?.includes(feature);
                  return (
                    <Button
                      key={feature}
                      variant={hasAccess ? 'secondary' : 'outline'}
                      onClick={() => toggleFeature(selectedRole, feature)}
                      className="justify-start"
                    >
                      {hasAccess ? <Check className="w-4 h-4" /> : <XIcon className="w-4 h-4" />}
                      <span className="capitalize ml-2">{feature.replace(/-/g, ' ')}</span>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSavePermissions} disabled={saving} className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Permissions'}
            </Button>
          </div>
        </div>
      )}

      {/* Payment Gateways Settings */}
      {activeTab === 'payment-gateways' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" /> Payment Gateways
              </CardTitle>
              <CardDescription>Configure payment gateways for accepting customer payments.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* M-Pesa */}
              <div className="p-4 bg-zinc-800/50 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-md font-semibold text-white flex items-center gap-2">
                    <Globe className="w-4 h-4" /> M-Pesa
                  </h3>
                  <Switch
                    checked={paymentGateways.mpesa.enabled}
                    onCheckedChange={(checked) => updatePaymentGateway('mpesa', 'enabled', checked)}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="mpesa-consumer-key">Consumer Key</Label>
                    <Input
                      id="mpesa-consumer-key"
                      type="text"
                      value={paymentGateways.mpesa.consumer_key}
                      onChange={(e) => updatePaymentGateway('mpesa', 'consumer_key', e.target.value)}
                      placeholder="Enter consumer key"
                    />
                  </div>
                  <div>
                    <Label htmlFor="mpesa-consumer-secret">Consumer Secret</Label>
                    <Input
                      id="mpesa-consumer-secret"
                      type="password"
                      value={paymentGateways.mpesa.consumer_secret}
                      onChange={(e) => updatePaymentGateway('mpesa', 'consumer_secret', e.target.value)}
                      placeholder="Enter consumer secret"
                    />
                  </div>
                  <div>
                    <Label htmlFor="mpesa-passkey">Passkey</Label>
                    <Input
                      id="mpesa-passkey"
                      type="password"
                      value={paymentGateways.mpesa.passkey}
                      onChange={(e) => updatePaymentGateway('mpesa', 'passkey', e.target.value)}
                      placeholder="Enter passkey"
                    />
                  </div>
                  <div>
                    <Label htmlFor="mpesa-shortcode">Shortcode</Label>
                    <Input
                      id="mpesa-shortcode"
                      type="text"
                      value={paymentGateways.mpesa.shortcode}
                      onChange={(e) => updatePaymentGateway('mpesa', 'shortcode', e.target.value)}
                      placeholder="174379"
                    />
                  </div>
                  <div>
                    <Label htmlFor="mpesa-environment">Environment</Label>
                    <select
                      id="mpesa-environment"
                      value={paymentGateways.mpesa.environment}
                      onChange={(e) => updatePaymentGateway('mpesa', 'environment', e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="sandbox">Sandbox</option>
                      <option value="production">Production</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Stripe */}
              <div className="p-4 bg-zinc-800/50 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-md font-semibold text-white flex items-center gap-2">
                    <CreditCard className="w-4 h-4" /> Stripe
                  </h3>
                  <Switch
                    checked={paymentGateways.stripe.enabled}
                    onCheckedChange={(checked) => updatePaymentGateway('stripe', 'enabled', checked)}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="stripe-publishable">Publishable Key</Label>
                    <Input
                      id="stripe-publishable"
                      type="text"
                      value={paymentGateways.stripe.publishable_key}
                      onChange={(e) => updatePaymentGateway('stripe', 'publishable_key', e.target.value)}
                      placeholder="pk_test_..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="stripe-secret">Secret Key</Label>
                    <Input
                      id="stripe-secret"
                      type="password"
                      value={paymentGateways.stripe.secret_key}
                      onChange={(e) => updatePaymentGateway('stripe', 'secret_key', e.target.value)}
                      placeholder="sk_test_..."
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="stripe-webhook">Webhook Secret</Label>
                    <Input
                      id="stripe-webhook"
                      type="password"
                      value={paymentGateways.stripe.webhook_secret}
                      onChange={(e) => updatePaymentGateway('stripe', 'webhook_secret', e.target.value)}
                      placeholder="whsec_..."
                    />
                  </div>
                </div>
              </div>

              {/* PayPal */}
              <div className="p-4 bg-zinc-800/50 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-md font-semibold text-white flex items-center gap-2">
                    <Globe className="w-4 h-4" /> PayPal
                  </h3>
                  <Switch
                    checked={paymentGateways.paypal.enabled}
                    onCheckedChange={(checked) => updatePaymentGateway('paypal', 'enabled', checked)}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="paypal-client-id">Client ID</Label>
                    <Input
                      id="paypal-client-id"
                      type="text"
                      value={paymentGateways.paypal.client_id}
                      onChange={(e) => updatePaymentGateway('paypal', 'client_id', e.target.value)}
                      placeholder="Enter PayPal client ID"
                    />
                  </div>
                  <div>
                    <Label htmlFor="paypal-client-secret">Client Secret</Label>
                    <Input
                      id="paypal-client-secret"
                      type="password"
                      value={paymentGateways.paypal.client_secret}
                      onChange={(e) => updatePaymentGateway('paypal', 'client_secret', e.target.value)}
                      placeholder="Enter PayPal client secret"
                    />
                  </div>
                  <div>
                    <Label htmlFor="paypal-mode">Mode</Label>
                    <select
                      id="paypal-mode"
                      value={paymentGateways.paypal.mode}
                      onChange={(e) => updatePaymentGateway('paypal', 'mode', e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="sandbox">Sandbox</option>
                      <option value="live">Live</option>
                    </select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSavePaymentGateways} disabled={saving} className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Payment Gateways'}
            </Button>
          </div>
        </div>
      )}

      {/* Bank Paybills Settings */}
      {activeTab === 'bank-paybills' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" /> Bank Paybills
                </CardTitle>
                <Switch
                  checked={bankPaybills.enabled}
                  onCheckedChange={(checked) => setBankPaybills(prev => ({ ...prev, enabled: checked }))}
                />
              </div>
              <CardDescription>Configure Kenyan bank paybill numbers for customers to pay directly to their bank accounts.</CardDescription>
            </CardHeader>
            <CardContent>
              {bankPaybills.banks.map((bank, index) => (
                <div key={index} className="mb-4 p-4 bg-zinc-800/50 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-md font-semibold text-white">{bank.name}</h3>
                    <Switch
                      checked={bank.enabled}
                      onCheckedChange={(checked) => updateBankPaybill(index, 'enabled', checked)}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`bank-paybill-${index}`}>Paybill Number</Label>
                      <Input
                        id={`bank-paybill-${index}`}
                        type="text"
                        value={bank.paybill}
                        onChange={(e) => updateBankPaybill(index, 'paybill', e.target.value)}
                        placeholder="e.g., 247247"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`bank-account-${index}`}>Account Number</Label>
                      <Input
                      type="text"
                      value={bank.account_number}
                      onChange={(e) => updateBankPaybill(index, 'account_number', e.target.value)}
                      placeholder="Your business account number"
                    />
                  </div>
                </div>
              </div>
            ))}
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSaveBankPaybills} disabled={saving} className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Bank Paybills'}
            </Button>
          </div>
        </div>
      )}

      {/* WireGuard Settings */}
      {activeTab === 'wireguard' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="w-5 h-5" /> WireGuard VPN
                </CardTitle>
                <Switch
                  checked={wireguard.enabled}
                  onCheckedChange={(checked) => updateWireguard('enabled', checked)}
                />
              </div>
              <CardDescription>Configure WireGuard VPN for secure remote access to your Mikrotik router.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="wg-port">Server Port</Label>
                  <Input
                    id="wg-port"
                    type="number"
                    value={wireguard.server_port}
                    onChange={(e) => updateWireguard('server_port', e.target.value)}
                    placeholder="51820"
                  />
                </div>
                <div>
                  <Label htmlFor="wg-address">Server Address</Label>
                  <Input
                    id="wg-address"
                    type="text"
                    value={wireguard.server_address}
                    onChange={(e) => updateWireguard('server_address', e.target.value)}
                    placeholder="10.0.0.1"
                  />
                </div>
                <div>
                  <Label htmlFor="wg-dns">DNS Server</Label>
                  <Input
                    id="wg-dns"
                    type="text"
                    value={wireguard.server_dns}
                    onChange={(e) => updateWireguard('server_dns', e.target.value)}
                    placeholder="1.1.1.1"
                  />
                </div>
                <div>
                  <Label htmlFor="wg-private-key">Server Private Key</Label>
                  <Input
                    id="wg-private-key"
                    type="password"
                    value={wireguard.server_private_key}
                    onChange={(e) => updateWireguard('server_private_key', e.target.value)}
                    placeholder="Private key (keep secret)"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="wg-public-key">Server Public Key</Label>
                  <Input
                    id="wg-public-key"
                    type="text"
                    value={wireguard.server_public_key}
                    onChange={(e) => updateWireguard('server_public_key', e.target.value)}
                    placeholder="Public key (share with peers)"
                  />
                </div>
              </div>

              {/* Peers Section */}
              <div className="border-t border-zinc-700 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-md font-semibold text-white">VPN Peers</h3>
                  <Button onClick={handleAddPeer} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add Peer
                  </Button>
                </div>

                {wireguard.peers.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">
                    <Wifi className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No peers configured yet</p>
                    <p className="text-sm">Add a peer to start using WireGuard VPN</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {wireguard.peers.map((peer) => (
                      <div key={peer.id} className="p-4 bg-zinc-800/50 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-medium text-white">{peer.name}</h4>
                            <p className="text-sm text-zinc-400">{peer.allowed_ips}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleGenerateConfig(peer.id, window.location.hostname)}
                              className="flex items-center gap-1"
                            >
                              <Download className="w-3 h-3" />
                              Config
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeletePeer(peer.id)}
                              className="flex items-center gap-1 text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor={`peer-key-${peer.id}`} className="text-xs">Public Key</Label>
                            <Input
                              id={`peer-key-${peer.id}`}
                              type="text"
                              value={peer.public_key}
                              onChange={(e) => {
                                const updatedPeers = wireguard.peers.map(p =>
                                  p.id === peer.id ? { ...p, public_key: e.target.value } : p
                                );
                                setWireguard(prev => ({ ...prev, peers: updatedPeers }));
                              }}
                              placeholder="Peer public key"
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`peer-psk-${peer.id}`} className="text-xs">Preshared Key (optional)</Label>
                            <Input
                              id={`peer-psk-${peer.id}`}
                              type="password"
                              value={peer.preshared_key}
                              onChange={(e) => {
                                const updatedPeers = wireguard.peers.map(p =>
                                  p.id === peer.id ? { ...p, preshared_key: e.target.value } : p
                                );
                                setWireguard(prev => ({ ...prev, peers: updatedPeers }));
                              }}
                              placeholder="Preshared key for extra security"
                              className="text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSaveWireguard} disabled={saving} className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save WireGuard Settings'}
            </Button>
          </div>
        </div>
      )}

      {/* Other tabs - placeholder */}
      {activeTab !== 'general' && activeTab !== 'permissions' && activeTab !== 'payment-gateways' && activeTab !== 'bank-paybills' && activeTab !== 'wireguard' && (
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
