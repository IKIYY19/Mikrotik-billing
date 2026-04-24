import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { MessageCircle, Send, Settings, MessageSquare, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

const API = import.meta.env.VITE_API_URL || '/api';

export function WhatsAppPage() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [settings, setSettings] = useState({});
  const [sendTo, setSendTo] = useState('');
  const [sendTemplate, setSendTemplate] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetchLogs();
    axios.get(`${API}/sms/templates`).then(r => setTemplates(r.data));
    axios.get(`${API}/sms/whatsapp/settings`).then(r => setSettings(r.data));
  }, []);

  const fetchLogs = async () => {
    try {
      const { data } = await axios.get(`${API}/sms/logs`);
      setLogs((data.data || []).filter(l => l.channel === 'whatsapp' || l.channel === 'whatsapp_inbound'));
    } catch (error) { console.error('Failed to fetch WhatsApp logs:', error); toast.error('Failed to load logs', error.response?.data?.error || error.message); }
  };

  const handleSend = async () => {
    if (!sendTo) return;
    setSending(true);
    setResult(null);

    try {
      let res;
      if (sendTemplate) {
        res = await axios.post(`${API}/sms/whatsapp/send-template`, {
          to: sendTo,
          template_id: sendTemplate,
          variables: { customer_name: 'Test', invoice_number: 'INV-TEST', amount: '500', due_date: 'May 15' },
        });
      } else {
        res = await axios.post(`${API}/sms/whatsapp/send`, { to: sendTo, message: customMessage });
      }
      setResult(res.data);
      fetchLogs();
    } catch (e) {
      setResult({ success: false, message: e.response?.data?.error || e.message });
    }
    setSending(false);
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white gradient-text mb-2 flex items-center gap-2">
        <MessageCircle className="w-6 h-6 text-green-400" /> WhatsApp Notifications
      </h2>
      <p className="text-sm text-slate-400 mb-6">Send notifications via WhatsApp Business API</p>

      {/* Settings */}
      <Card className="card-glow p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-slate-400" />
          <div>
            <div className="text-white font-semibold">WhatsApp Business API</div>
            <div className="text-sm text-slate-400">
              {settings.is_configured ? (
                <span className="text-green-400">● Configured — Phone: {settings.phone_number_id}</span>
              ) : (
                <span className="text-amber-400">● Sandbox Mode — Messages logged but not sent</span>
              )}
            </div>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Send Message */}
        <Card className="card-gradient p-6">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="flex items-center gap-2">
              <Send className="w-4 h-4" /> Send WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Phone Number</label>
              <input value={sendTo} onChange={e => setSendTo(e.target.value)} placeholder="254712345678"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Or Use Template</label>
              <select value={sendTemplate} onChange={e => setSendTemplate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white">
                <option value="">Custom message</option>
                {templates.filter(t => t.is_active).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            {!sendTemplate && (
              <div>
                <label className="block text-sm text-slate-400 mb-1">Message</label>
                <textarea value={customMessage} onChange={e => setCustomMessage(e.target.value)} rows="3"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                  placeholder="Type your message..." />
                <div className="text-xs text-slate-500 mt-1">{customMessage.length}/160 characters</div>
              </div>
            )}
            <Button onClick={handleSend} disabled={sending || !sendTo || (!sendTemplate && !customMessage)}
              className="w-full btn-gradient-success flex items-center justify-center gap-2">
              <MessageCircle className="w-4 h-4" /> {sending ? 'Sending...' : 'Send WhatsApp'}
            </Button>
            {result && (
              <div className={`p-3 rounded ${result.success ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                <div className="flex items-center gap-2">
                  {result.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  <span>{result.message}</span>
                </div>
                {result.isSandbox && <p className="text-xs text-amber-300 mt-1">Sandbox mode</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message Logs */}
        <Card className="card-gradient p-6">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> WhatsApp Logs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map(log => (
                <div key={log.id} className="bg-slate-700/50 rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-sm">{log.to?.[0] || log.from}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      log.status === 'sent' || log.status === 'received' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
                    }`}>{log.status}</span>
                  </div>
                  <p className="text-slate-300 text-xs truncate">{log.message}</p>
                  <div className="text-slate-500 text-xs mt-1">{new Date(log.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
