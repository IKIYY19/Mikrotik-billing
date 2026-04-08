import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Activity, Network, Download, Upload, Cpu, MemoryStick, Users, RefreshCw, Server, Wifi } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '/api';

export function MonitoringDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/features/monitoring/dashboard`);
      setData(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const formatBytes = (gb) => {
    const num = parseFloat(gb);
    return num >= 1000 ? `${(num / 1000).toFixed(1)} TB` : `${num.toFixed(1)} GB`;
  };

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  };

  if (loading) return <div className="p-8 text-white">Loading...</div>;
  if (!data) return <div className="p-8 text-white">No data</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-green-400" /> Network Monitoring
          </h2>
          <p className="text-sm text-slate-400">Real-time network status across all branches</p>
        </div>
        <button onClick={fetchData} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-2">
            <Wifi className="w-5 h-5 text-green-400" />
            <span className="text-sm text-slate-400">Active PPPoE</span>
          </div>
          <div className="text-3xl font-bold text-white">{data.total_sessions}</div>
          <div className="text-xs text-green-400 mt-1">sessions online</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-2">
            <Download className="w-5 h-5 text-blue-400" />
            <span className="text-sm text-slate-400">Total Upload</span>
          </div>
          <div className="text-3xl font-bold text-white">{formatBytes(data.total_bandwidth_in_gb)}</div>
          <div className="text-xs text-blue-400 mt-1">from customers</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-2">
            <Upload className="w-5 h-5 text-purple-400" />
            <span className="text-sm text-slate-400">Total Download</span>
          </div>
          <div className="text-3xl font-bold text-white">{formatBytes(data.total_bandwidth_out_gb)}</div>
          <div className="text-xs text-purple-400 mt-1">to customers</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-2">
            <Server className="w-5 h-5 text-amber-400" />
            <span className="text-sm text-slate-400">Branches</span>
          </div>
          <div className="text-3xl font-bold text-white">{data.branch_metrics.length}</div>
          <div className="text-xs text-amber-400 mt-1">POP locations</div>
        </div>
      </div>

      {/* Branch Metrics */}
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Network className="w-5 h-5" /> Branch Status
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {data.branch_metrics.map((bm, i) => (
          <div key={i} className="bg-slate-800 border border-slate-700 rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-semibold">{bm.branch.name}</h4>
              <span className={`px-2 py-0.5 rounded text-xs ${
                bm.online_routers === bm.total_routers ? 'bg-green-600/20 text-green-400' :
                bm.online_routers > 0 ? 'bg-amber-600/20 text-amber-400' : 'bg-red-600/20 text-red-400'
              }`}>
                {bm.online_routers}/{bm.total_routers} online
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-green-400" />
                <span className="text-slate-400">PPPoE:</span>
                <span className="text-white">{bm.active_pppoe}</span>
              </div>
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-blue-400" />
                <span className="text-slate-400">↑:</span>
                <span className="text-white">{bm.bandwidth_in} Mbps</span>
              </div>
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-purple-400" />
                <span className="text-slate-400">↓:</span>
                <span className="text-white">{bm.bandwidth_out} Mbps</span>
              </div>
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-amber-400" />
                <span className="text-slate-400">CPU:</span>
                <span className="text-white">{bm.cpu}%</span>
              </div>
            </div>
            {/* Progress bars */}
            <div className="mt-3 space-y-2">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1"><span>CPU</span><span>{bm.cpu}%</span></div>
                <div className="w-full bg-slate-700 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${bm.cpu > 80 ? 'bg-red-500' : bm.cpu > 50 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${bm.cpu}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1"><span>Memory</span><span>{bm.memory}%</span></div>
                <div className="w-full bg-slate-700 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${bm.memory > 80 ? 'bg-red-500' : bm.memory > 50 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${bm.memory}%` }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* PPPoE Sessions */}
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Users className="w-5 h-5" /> Active PPPoE Sessions ({data.sessions.length})
      </h3>
      <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
        {data.sessions.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No active sessions</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="text-left p-3">Username</th>
                  <th className="text-left p-3">Customer</th>
                  <th className="text-left p-3">IP Address</th>
                  <th className="text-left p-3">Upload</th>
                  <th className="text-left p-3">Download</th>
                  <th className="text-left p-3">Uptime</th>
                  <th className="text-left p-3">Connected</th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map(session => (
                  <tr key={session.id} className="border-t border-slate-700 hover:bg-slate-700/50">
                    <td className="p-3 text-blue-400 font-mono text-xs">{session.username}</td>
                    <td className="p-3 text-white">{session.customer_name}</td>
                    <td className="p-3 text-slate-300 font-mono text-xs">{session.ip_address}</td>
                    <td className="p-3 text-blue-300">{(session.bytes_in / (1024 * 1024)).toFixed(0)} MB</td>
                    <td className="p-3 text-purple-300">{(session.bytes_out / (1024 * 1024)).toFixed(0)} MB</td>
                    <td className="p-3 text-slate-300">{formatUptime(session.uptime_seconds)}</td>
                    <td className="p-3 text-slate-400 text-xs">{new Date(session.connected_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
