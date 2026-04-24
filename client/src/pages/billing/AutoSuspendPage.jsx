import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Clock, Shield, AlertTriangle, Settings, Play, CheckCircle, Save } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

const API = import.meta.env.VITE_API_URL || '/api';

export function AutoSuspendPage() {
  const toast = useToast();
  const [config, setConfig] = useState({ warn_days: 7, throttle_days: 14, suspend_days: 30, throttle_speed_up: '1M', throttle_speed_down: '1M' });
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  useEffect(() => { fetchConfig(); }, []);

  const fetchConfig = async () => {
    try { const { data } = await axios.get(`${API}/features/auto-suspend/config`); setConfig(data); } catch (error) { console.error('Failed to fetch auto-suspend config:', error); toast.error('Failed to load config', error.response?.data?.error || error.message); }
  };

  const handleSave = async () => {
    try { await axios.put(`${API}/features/auto-suspend/config`, config); toast.success('Config saved', 'Auto-suspend configuration updated'); } catch (error) { console.error('Failed to save auto-suspend config:', error); toast.error('Failed to save config', error.response?.data?.error || error.message); }
  };

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      const { data } = await axios.post(`${API}/features/auto-suspend/run`);
      setResult(data);
    } catch (e) { setResult({ success: false, error: e.message }); }
    setRunning(false);
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white gradient-text mb-6 flex items-center gap-2">
        <Shield className="w-6 h-6 text-blue-400" /> Auto-Suspend with Grace Period
      </h2>

      {/* Configuration */}
      <Card className="card-gradient p-6 mb-6">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-4 h-4" /> Grace Period Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-blue-600/10 border border-blue-600/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-blue-400" />
              <span className="text-blue-400 font-semibold">Warn</span>
            </div>
            <div className="text-sm text-slate-300 mb-2">Send SMS warning</div>
            <div className="flex items-center gap-2">
              <input type="number" value={config.warn_days} onChange={e => setConfig({...config, warn_days: parseInt(e.target.value)})}
                className="w-20 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center" />
              <span className="text-slate-400">days overdue</span>
            </div>
          </div>
          <div className="bg-amber-600/10 border border-amber-600/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-amber-400" />
              <span className="text-amber-400 font-semibold">Throttle</span>
            </div>
            <div className="text-sm text-slate-300 mb-2">Reduce speed</div>
            <div className="flex items-center gap-2">
              <input type="number" value={config.throttle_days} onChange={e => setConfig({...config, throttle_days: parseInt(e.target.value)})}
                className="w-20 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center" />
              <span className="text-slate-400">days overdue</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input value={config.throttle_speed_up} onChange={e => setConfig({...config, throttle_speed_up: e.target.value})}
                className="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm text-center" />
              <span className="text-slate-400 text-sm">/</span>
              <input value={config.throttle_speed_down} onChange={e => setConfig({...config, throttle_speed_down: e.target.value})}
                className="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm text-center" />
            </div>
          </div>
          <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-red-400" />
              <span className="text-red-400 font-semibold">Suspend</span>
            </div>
            <div className="text-sm text-slate-300 mb-2">Full service suspension</div>
            <div className="flex items-center gap-2">
              <input type="number" value={config.suspend_days} onChange={e => setConfig({...config, suspend_days: parseInt(e.target.value)})}
                className="w-20 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center" />
              <span className="text-slate-400">days overdue</span>
            </div>
          </div>
        </div>

        {/* Timeline visualization */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-400">Due Date</span>
            <span className="text-blue-400">Day {config.warn_days}: SMS Warning</span>
            <span className="text-amber-400">Day {config.throttle_days}: Throttle</span>
            <span className="text-red-400">Day {config.suspend_days}: Suspend</span>
          </div>
          <div className="relative h-2 bg-slate-700 rounded-full">
            <div className="absolute left-0 top-0 h-2 bg-blue-500 rounded-l-full" style={{ width: `${(config.warn_days / config.suspend_days) * 100}%` }} />
            <div className="absolute top-0 h-2 bg-amber-500" style={{ left: `${(config.warn_days / config.suspend_days) * 100}%`, width: `${((config.throttle_days - config.warn_days) / config.suspend_days) * 100}%` }} />
            <div className="absolute top-0 h-2 bg-red-500 rounded-r-full" style={{ left: `${(config.throttle_days / config.suspend_days) * 100}%`, width: `${((config.suspend_days - config.throttle_days) / config.suspend_days) * 100}%` }} />
          </div>
        </div>

        <Button onClick={handleSave} className="btn-gradient-primary flex items-center gap-2">
          <Save className="w-4 h-4" /> Save Configuration
        </Button>
        </CardContent>
      </Card>

      {/* Run Auto-Suspend */}
      <Card className="card-gradient p-6 mb-6">
        <CardHeader className="p-0 mb-4">
          <CardTitle>Manual Run</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <p className="text-sm text-slate-400 mb-4">
            Run the auto-suspend check now. This will process all overdue invoices and apply warnings, throttling, or suspension based on the configuration above.
          </p>
          <Button onClick={handleRun} disabled={running}
            className="btn-gradient-success flex items-center gap-2">
            <Play className="w-4 h-4" /> {running ? 'Running...' : 'Run Auto-Suspend Now'}
          </Button>

        {result && (
          <div className="mt-6 space-y-4">
            <div className={`p-4 rounded-lg ${result.success ? 'bg-green-600/20 border border-green-600/50' : 'bg-red-600/20 border border-red-600/50'}`}>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-semibold">Auto-suspend completed</span>
              </div>
            </div>

            {result.results?.warned?.length > 0 && (
              <div className="bg-blue-600/10 border border-blue-600/30 rounded-lg p-4">
                <h4 className="text-blue-400 font-semibold mb-2">⚠️ Warned ({result.results.warned.length})</h4>
                {result.results.warned.map((w, i) => (
                  <div key={i} className="text-sm text-slate-300">{w.customer} — {w.days_overdue} days overdue</div>
                ))}
              </div>
            )}

            {result.results?.throttled?.length > 0 && (
              <div className="bg-amber-600/10 border border-amber-600/30 rounded-lg p-4">
                <h4 className="text-amber-400 font-semibold mb-2">🐌 Throttled ({result.results.throttled.length})</h4>
                {result.results.throttled.map((t, i) => (
                  <div key={i} className="text-sm text-slate-300">{t.customer} — {t.days_overdue} days overdue → {t.throttle_speed}</div>
                ))}
              </div>
            )}

            {result.results?.suspended?.length > 0 && (
              <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-4">
                <h4 className="text-red-400 font-semibold mb-2">🚫 Suspended ({result.results.suspended.length})</h4>
                {result.results.suspended.map((s, i) => (
                  <div key={i} className="text-sm text-slate-300">{s.customer} — {s.days_overdue} days overdue</div>
                ))}
              </div>
            )}

            {result.results?.warned?.length === 0 && result.results?.throttled?.length === 0 && result.results?.suspended?.length === 0 && (
              <p className="text-slate-400 text-sm">No overdue accounts found. All customers are in good standing.</p>
            )}
          </div>
          </CardContent>
      </Card>
    </div>
  );
}
