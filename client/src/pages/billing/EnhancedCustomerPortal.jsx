import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../../hooks/useToast';
import { generateInvoicePDF, generateReceiptPDF } from '../../utils/pdfGenerator';
import {
  Smartphone, Wifi, Download, Upload, FileText, CreditCard, Clock, AlertTriangle,
  CheckCircle, DollarSign, MessageSquare, BarChart3, Gauge, Ticket, Receipt,
  TrendingUp, Calendar, Bell, Zap, Activity, Printer, ExternalLink, X
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '/api';

function StatCard({ title, value, icon: Icon, color = 'blue', sub }) {
  const colors = {
    blue: 'from-blue-500 to-cyan-500',
    green: 'from-emerald-500 to-green-500',
    purple: 'from-purple-500 to-pink-500',
    orange: 'from-orange-500 to-amber-500',
  };
  
  return (
    <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800/50 rounded-2xl p-5 hover:border-zinc-700/50 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-zinc-400 mt-1">{title}</div>
      {sub && <div className="text-xs text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}

export function CustomerPortal() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [speedTest, setSpeedTest] = useState({ running: false, download: 0, upload: 0, ping: 0 });
  const [bandwidthHistory, setBandwidthHistory] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [supportTickets, setSupportTickets] = useState([]);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketForm, setTicketForm] = useState({ subject: '', description: '', category: 'general' });
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const [usageAlerts, setUsageAlerts] = useState([]);

  useEffect(() => {
    fetchData();
    fetchPaymentHistory();
    fetchSupportTickets();
    fetchBandwidthHistory();
  }, [customerId]);

  useEffect(() => {
    checkUsageAlerts();
  }, [data]);

  const fetchData = async () => {
    try {
      const { data } = await axios.get(`${API}/portal/${customerId}/dashboard`);
      setData(data);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  const fetchPaymentHistory = async () => {
    try {
      const { data } = await axios.get(`${API}/portal/${customerId}/payments`);
      setPaymentHistory(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch payments:', e);
    }
  };

  const fetchSupportTickets = async () => {
    try {
      const { data } = await axios.get(`${API}/portal/${customerId}/tickets`);
      setSupportTickets(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch tickets:', e);
    }
  };

  const fetchBandwidthHistory = async () => {
    try {
      const { data } = await axios.get(`${API}/portal/${customerId}/bandwidth`);
      setBandwidthHistory(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch bandwidth:', e);
    }
  };

  const checkUsageAlerts = () => {
    const alerts = [];
    const quotaPercent = data?.usage?.quota_used_percent || 0;
    
    if (quotaPercent >= 100) {
      alerts.push({ type: 'critical', message: 'You have exceeded your monthly quota. Speed may be reduced.' });
    } else if (quotaPercent >= 90) {
      alerts.push({ type: 'warning', message: `You've used ${quotaPercent.toFixed(0)}% of your quota. ${100 - quotaPercent.toFixed(0)}% remaining.` });
    } else if (quotaPercent >= 75) {
      alerts.push({ type: 'info', message: `You've used ${quotaPercent.toFixed(0)}% of your monthly quota.` });
    }
    
    if (data?.outstanding_balance > 0) {
      alerts.push({ type: 'critical', message: `You have an outstanding balance of KES ${data.outstanding_balance.toFixed(2)}.` });
    }
    
    setUsageAlerts(alerts);
  };

  const runSpeedTest = async () => {
    setSpeedTest({ running: true, download: 0, upload: 0, ping: 0 });
    
    try {
      // Simple speed test using file downloads
      const startTime = Date.now();
      
      // Test ping
      const pingStart = Date.now();
      await axios.get(`${API}/portal/${customerId}/ping`);
      const ping = Date.now() - pingStart;
      
      // Test download (download a test file or use a large endpoint response)
      const downloadStart = Date.now();
      await axios.get(`${API}/portal/${customerId}/speedtest`, { responseType: 'blob' });
      const downloadTime = (Date.now() - downloadStart) / 1000;
      const downloadSpeed = (1024 / downloadTime / 1024 * 8).toFixed(2); // Mbps
      
      // Test upload
      const uploadData = new Blob([new ArrayBuffer(512 * 1024)]); // 512KB
      const uploadStart = Date.now();
      await axios.post(`${API}/portal/${customerId}/speedtest`, uploadData);
      const uploadTime = (Date.now() - uploadStart) / 1000;
      const uploadSpeed = (512 / uploadTime / 1024 * 8).toFixed(2); // Mbps
      
      setSpeedTest({
        running: false,
        download: downloadSpeed,
        upload: uploadSpeed,
        ping: ping,
      });
    } catch (e) {
      console.error('Speed test failed:', e);
      setSpeedTest({ running: false, download: 0, upload: 0, ping: 0 });
      toast.error('Speed test failed');
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/portal/${customerId}/tickets`, ticketForm);
      setShowTicketForm(false);
      setTicketForm({ subject: '', description: '', category: 'general' });
      toast.success('Ticket created', 'Your support ticket has been submitted');
      fetchSupportTickets();
    } catch (error) {
      toast.error('Failed to create ticket', error.response?.data?.error || error.message);
    }
  };

  const handlePayment = async () => {
    if (!payAmount) return;
    setPaying(true);
    try {
      await axios.post(`${API}/portal/${customerId}/pay`, {
        amount: parseFloat(payAmount),
        method: 'mpesa',
      });
      setShowPayModal(false);
      setPayAmount('');
      toast.success('Payment initiated', 'Check your phone for M-Pesa prompt');
      fetchData();
      fetchPaymentHistory();
    } catch (e) {
      toast.error('Payment failed', e.response?.data?.error || e.message);
    }
    setPaying(false);
  };

  const downloadInvoice = (invoice) => {
    generateInvoicePDF(invoice, data?.customer || {});
  };

  const downloadReceipt = (payment) => {
    const invoice = data?.recent_invoices?.find(inv => inv.id === payment.invoice_id);
    generateReceiptPDF(payment, invoice, data?.customer || {});
  };

  if (loading) return <div className="p-8 text-zinc-400">Loading portal...</div>;
  if (!data) return <div className="p-8 text-white">Customer not found</div>;

  const quotaPercent = data.usage?.quota_used_percent ? parseInt(data.usage.quota_used_percent) : 0;
  const isThrottled = data.subscription?.throttled;

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'usage', label: 'Bandwidth', icon: Activity },
    { id: 'speedtest', label: 'Speed Test', icon: Gauge },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'payments', label: 'Payments', icon: Receipt },
    { id: 'support', label: 'Support', icon: Ticket },
  ];

  return (
    <div className="min-h-screen bg-[#0a0b0f]">
      {/* Header */}
      <div className="bg-zinc-900/50 backdrop-blur border-b border-zinc-800/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{data.customer.name}</h1>
            <p className="text-zinc-400 text-sm">{data.customer.phone} • {data.customer.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTicketForm(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Open Ticket</span>
            </button>
            <button
              onClick={() => setShowPayModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Smartphone className="w-4 h-4" />
              <span className="hidden sm:inline">Pay Now</span>
            </button>
          </div>
        </div>
      </div>

      {/* Usage Alerts */}
      {usageAlerts.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 py-4 space-y-2">
          {usageAlerts.map((alert, i) => (
            <div key={i} className={`flex items-center justify-between p-4 rounded-xl border ${
              alert.type === 'critical' ? 'bg-red-500/10 border-red-500/20' :
              alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20' :
              'bg-blue-500/10 border-blue-500/20'
            }`}>
              <div className="flex items-center gap-3">
                <Bell className={`w-5 h-5 ${
                  alert.type === 'critical' ? 'text-red-400' :
                  alert.type === 'warning' ? 'text-amber-400' :
                  'text-blue-400'
                }`} />
                <span className={`text-sm ${
                  alert.type === 'critical' ? 'text-red-300' :
                  alert.type === 'warning' ? 'text-amber-300' :
                  'text-blue-300'
                }`}>{alert.message}</span>
              </div>
              <button onClick={() => setUsageAlerts(alerts => alerts.filter((_, idx) => idx !== i))} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800/50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Status Banners */}
            {isThrottled && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <div>
                  <span className="text-amber-300 font-semibold">Service Throttled</span>
                  <span className="text-amber-400 text-sm ml-2">Your speed has been reduced to 1M/1M</span>
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Current Plan" value={data.subscription?.plan_name || 'No plan'} icon={Wifi} color="blue" sub={data.subscription?.speed} />
              <StatCard title="Monthly Price" value={`KES ${data.subscription?.plan?.price || 0}`} icon={DollarSign} color="green" sub="per month" />
              <StatCard title="Data Used" value={`${data.usage?.total_gb || 0} GB`} icon={Download} color="purple" sub={`of ${data.usage?.quota_gb || 0} GB`} />
              <StatCard title="Active Sessions" value={data.usage?.active_sessions || 0} icon={Zap} color="orange" sub={`${data.usage?.session_count || 0} total`} />
            </div>

            {/* Quota Progress */}
            {data.usage?.quota_gb && (
              <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800/50 rounded-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Monthly Quota Usage
                  </h3>
                  <span className={`text-lg font-bold ${
                    quotaPercent >= 100 ? 'text-red-400' :
                    quotaPercent >= 80 ? 'text-amber-400' :
                    'text-emerald-400'
                  }`}>{quotaPercent}%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      quotaPercent >= 100 ? 'bg-red-500' :
                      quotaPercent >= 80 ? 'bg-amber-500' :
                      'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, quotaPercent)}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm text-zinc-400 mt-2">
                  <span>{data.usage.total_gb} GB used</span>
                  <span>{(data.usage.quota_gb - data.usage.total_gb).toFixed(1)} GB remaining</span>
                  <span>{data.usage.quota_gb} GB total</span>
                </div>
              </div>
            )}

            {/* Recent Invoices */}
            <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800/50 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800/50 flex items-center justify-between">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Recent Invoices
                </h3>
                <button onClick={() => setActiveTab('invoices')} className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
                  View All <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              {data.recent_invoices?.length === 0 ? (
                <div className="p-6 text-zinc-500 text-center">No invoices</div>
              ) : (
                <div className="divide-y divide-zinc-800/50">
                  {data.recent_invoices?.slice(0, 3).map(inv => (
                    <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <FileText className="w-8 h-8 text-blue-400" />
                        <div>
                          <div className="text-white font-medium text-sm">{inv.invoice_number}</div>
                          <div className="text-zinc-500 text-xs">{new Date(inv.due_date).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-white font-semibold">KES {inv.amount.toFixed(2)}</div>
                          <div className={`text-xs ${inv.balance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {inv.balance > 0 ? `Balance: KES ${inv.balance.toFixed(2)}` : 'Paid'}
                          </div>
                        </div>
                        <button onClick={() => downloadInvoice(inv)} className="p-2 hover:bg-zinc-700/50 rounded-lg transition-colors" title="Download PDF">
                          <Printer className="w-4 h-4 text-zinc-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bandwidth Tab */}
        {activeTab === 'usage' && (
          <div className="space-y-6">
            <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800/50 rounded-2xl p-6">
              <h3 className="text-white font-semibold flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5" />
                Bandwidth Usage (Last 30 Days)
              </h3>
              
              {bandwidthHistory.length === 0 ? (
                <div className="text-zinc-500 text-center py-8">No bandwidth data available</div>
              ) : (
                <div className="space-y-3">
                  {bandwidthHistory.slice(0, 14).map((day, i) => {
                    const maxGB = Math.max(...bandwidthHistory.map(d => d.total_gb || 0), 1);
                    const percent = ((day.total_gb || 0) / maxGB) * 100;
                    return (
                      <div key={i} className="flex items-center gap-4">
                        <div className="w-20 text-sm text-zinc-400">{new Date(day.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</div>
                        <div className="flex-1 bg-zinc-800 rounded-full h-6 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-end pr-2 transition-all"
                            style={{ width: `${percent}%` }}
                          >
                            <span className="text-xs text-white font-semibold">{day.total_gb?.toFixed(1) || 0} GB</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Download vs Upload */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800/50 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-white font-semibold flex items-center gap-2">
                    <Download className="w-5 h-5 text-emerald-400" />
                    Download
                  </h4>
                  <span className="text-2xl font-bold text-emerald-400">{data.usage?.download_gb?.toFixed(1) || 0} GB</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-3">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(data.usage?.download_gb / data.usage?.quota_gb) * 100 || 0}%` }} />
                </div>
              </div>

              <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800/50 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-white font-semibold flex items-center gap-2">
                    <Upload className="w-5 h-5 text-blue-400" />
                    Upload
                  </h4>
                  <span className="text-2xl font-bold text-blue-400">{data.usage?.upload_gb?.toFixed(1) || 0} GB</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-3">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(data.usage?.upload_gb / data.usage?.quota_gb) * 100 || 0}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Speed Test Tab */}
        {activeTab === 'speedtest' && (
          <div className="space-y-6">
            <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800/50 rounded-2xl p-8">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">Internet Speed Test</h3>
                <p className="text-zinc-400">Test your current connection speed</p>
              </div>

              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-3">
                    <Download className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">
                    {speedTest.download > 0 ? `${speedTest.download}` : '---'}
                  </div>
                  <div className="text-sm text-zinc-400">Mbps Download</div>
                </div>

                <div className="text-center">
                  <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-3">
                    <Upload className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">
                    {speedTest.upload > 0 ? `${speedTest.upload}` : '---'}
                  </div>
                  <div className="text-sm text-zinc-400">Mbps Upload</div>
                </div>

                <div className="text-center">
                  <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center mb-3">
                    <Clock className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">
                    {speedTest.ping > 0 ? `${speedTest.ping}` : '---'}
                  </div>
                  <div className="text-sm text-zinc-400">ms Ping</div>
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={runSpeedTest}
                  disabled={speedTest.running}
                  className={`px-8 py-3 rounded-xl font-semibold text-white transition-all ${
                    speedTest.running
                      ? 'bg-zinc-700 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20'
                  }`}
                >
                  {speedTest.running ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Testing...
                    </span>
                  ) : (
                    'Run Speed Test'
                  )}
                </button>
              </div>
            </div>

            {/* Plan Comparison */}
            {data.subscription?.speed && (
              <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800/50 rounded-2xl p-6">
                <h4 className="text-white font-semibold mb-4">Your Plan Speed</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-white">{data.subscription.speed}</div>
                    <div className="text-sm text-zinc-400">Advertised speed</div>
                  </div>
                  {speedTest.download > 0 && (
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${
                        speedTest.download >= parseInt(data.subscription.speed) * 0.8 ? 'text-emerald-400' :
                        speedTest.download >= parseInt(data.subscription.speed) * 0.5 ? 'text-amber-400' :
                        'text-red-400'
                      }`}>
                        {speedTest.download} Mbps
                      </div>
                      <div className="text-sm text-zinc-400">Actual download speed</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Invoices Tab */}
        {activeTab === 'invoices' && (
          <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800/50 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800/50">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5" />
                All Invoices
              </h3>
            </div>
            {data.recent_invoices?.length === 0 ? (
              <div className="p-6 text-zinc-500 text-center">No invoices</div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {data.recent_invoices?.map(inv => (
                  <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        inv.status === 'paid' ? 'bg-emerald-500/10' : 'bg-amber-500/10'
                      }`}>
                        <FileText className={`w-5 h-5 ${
                          inv.status === 'paid' ? 'text-emerald-400' : 'text-amber-400'
                        }`} />
                      </div>
                      <div>
                        <div className="text-white font-medium">{inv.invoice_number}</div>
                        <div className="text-zinc-500 text-xs">Due: {new Date(inv.due_date).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-white font-semibold">KES {inv.amount.toFixed(2)}</div>
                        <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                          inv.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' :
                          inv.status === 'partial' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>{inv.status}</span>
                      </div>
                      <button onClick={() => downloadInvoice(inv)} className="p-2 hover:bg-zinc-700/50 rounded-lg transition-colors" title="Download PDF">
                        <Printer className="w-4 h-4 text-zinc-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800/50 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800/50">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Payment History
              </h3>
            </div>
            {paymentHistory.length === 0 ? (
              <div className="p-6 text-zinc-500 text-center">No payment history</div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {paymentHistory.map(payment => (
                  <div key={payment.id} className="p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <div className="text-white font-medium">{payment.method || 'Cash'}</div>
                        <div className="text-zinc-500 text-xs">{new Date(payment.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-emerald-400 font-semibold">KES {payment.amount.toFixed(2)}</div>
                        <div className="text-zinc-500 text-xs">Ref: {payment.reference || 'N/A'}</div>
                      </div>
                      <button onClick={() => downloadReceipt(payment)} className="p-2 hover:bg-zinc-700/50 rounded-lg transition-colors" title="Download Receipt">
                        <Printer className="w-4 h-4 text-zinc-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Support Tab */}
        {activeTab === 'support' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Ticket className="w-5 h-5" />
                Support Tickets
              </h3>
              <button
                onClick={() => setShowTicketForm(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                New Ticket
              </button>
            </div>

            {supportTickets.length === 0 ? (
              <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800/50 rounded-2xl p-8 text-zinc-500 text-center">
                No support tickets yet
              </div>
            ) : (
              <div className="space-y-3">
                {supportTickets.map(ticket => (
                  <div key={ticket.id} className="bg-zinc-900/50 backdrop-blur border border-zinc-800/50 rounded-2xl p-5 hover:border-zinc-700/50 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="text-white font-semibold mb-1">{ticket.subject}</h4>
                        <div className="flex items-center gap-3 text-sm text-zinc-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(ticket.created_at).toLocaleDateString()}
                          </span>
                          <span className="capitalize">Category: {ticket.category}</span>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        ticket.status === 'open' ? 'bg-blue-500/20 text-blue-400' :
                        ticket.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400' :
                        ticket.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-zinc-500/20 text-zinc-400'
                      }`}>{ticket.status}</span>
                    </div>
                    {ticket.description && (
                      <p className="text-zinc-400 text-sm">{ticket.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ticket Form Modal */}
      {showTicketForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowTicketForm(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-800/50 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Create Support Ticket</h3>
              <button onClick={() => setShowTicketForm(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTicket} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Subject *</label>
                <input
                  required
                  value={ticketForm.subject}
                  onChange={e => setTicketForm({ ...ticketForm, subject: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                  placeholder="Brief description of your issue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Category</label>
                <select
                  value={ticketForm.category}
                  onChange={e => setTicketForm({ ...ticketForm, category: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                >
                  <option value="general">General Inquiry</option>
                  <option value="technical">Technical Issue</option>
                  <option value="billing">Billing Question</option>
                  <option value="upgrade">Upgrade Request</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Description *</label>
                <textarea
                  required
                  value={ticketForm.description}
                  onChange={e => setTicketForm({ ...ticketForm, description: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                  rows="4"
                  placeholder="Describe your issue in detail..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowTicketForm(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Submit Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowPayModal(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-800/50 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Make Payment</h3>
              <button onClick={() => setShowPayModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Amount (KES) *</label>
                <input
                  type="number"
                  required
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white text-2xl font-bold"
                  placeholder="0.00"
                />
              </div>
              {data.outstanding_balance > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  <div className="text-sm text-amber-300">Outstanding Balance: <span className="font-bold">KES {data.outstanding_balance.toFixed(2)}</span></div>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPayModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button
                  onClick={handlePayment}
                  disabled={paying || !payAmount}
                  className={`btn-primary flex-1 ${paying || !payAmount ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {paying ? 'Processing...' : 'Pay via M-Pesa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
