import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  FolderPlus, TrendingUp, Users, UserCheck, AlertTriangle,
  RefreshCw, ArrowUpRight, ArrowDownRight, DollarSign,
  FileCode, Router, Settings, Network, Plus, Clock,
  FolderOpen, Trash2, Sparkles, Shield, MapPin, Activity, UserPlus, Key
} from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { useStore } from '../store';

const API_URL = import.meta.env.VITE_API_URL || '/api';

/* ─── Animated Counter ─── */
function AnimatedNumber({ value, prefix = '', suffix = '' }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 800;
    const steps = 30;
    const stepTime = duration / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += (value - 0) / steps;
      setDisplay(Math.round(current * 100) / 100);
      if (current >= value) { clearInterval(timer); setDisplay(value); }
    }, stepTime);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{prefix}{typeof value === 'number' && value % 1 !== 0 ? display.toFixed(2) : Math.round(display)}{suffix}</span>;
}

/* ─── Stat Card ─── */
function StatCard({ icon: Icon, label, value, prefix, suffix, trend, color, onClick }) {
  const colorMap = {
    blue: 'from-blue-500 to-cyan-500',
    emerald: 'from-emerald-500 to-teal-500',
    violet: 'from-violet-500 to-purple-500',
    amber: 'from-amber-500 to-orange-500',
    red: 'from-red-500 to-rose-500',
    green: 'from-green-500 to-emerald-500',
  };

  return (
    <div 
      onClick={onClick}
      className={`bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all ${onClick ? 'cursor-pointer hover:bg-white/10' : ''}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorMap[color]} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-sm ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="text-3xl font-bold text-white mb-1">
        <AnimatedNumber value={value} prefix={prefix} suffix={suffix} />
      </div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  );
}

/* ─── Quick Action Button ─── */
function QuickAction({ icon: Icon, label, color, onClick }) {
  const colorMap = {
    blue: 'hover:bg-blue-500/20 hover:border-blue-500/30 text-blue-400',
    emerald: 'hover:bg-emerald-500/20 hover:border-emerald-500/30 text-emerald-400',
    violet: 'hover:bg-violet-500/20 hover:border-violet-500/30 text-violet-400',
    amber: 'hover:bg-amber-500/20 hover:border-amber-500/30 text-amber-400',
    cyan: 'hover:bg-cyan-500/20 hover:border-cyan-500/30 text-cyan-400',
    orange: 'hover:bg-orange-500/20 hover:border-orange-500/30 text-orange-400',
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 transition-all ${colorMap[color]}`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium text-sm">{label}</span>
    </button>
  );
}

/* ─── Feature Card ─── */
function FeatureCard({ to, icon: Icon, label, desc, color, bg, ring }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(to)}
      className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all cursor-pointer hover:bg-white/10 group"
    >
      <div className={`w-12 h-12 rounded-xl ${bg} ring-1 ${ring} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">{label}</h3>
      <p className="text-sm text-gray-400">{desc}</p>
    </div>
  );
}

const featureCards = [
  { to: '/topology', icon: Network, label: 'Topology Builder', desc: 'Visual network design', color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-500/10', ring: 'ring-blue-500/20' },
  { to: '/devices', icon: Settings, label: 'Auto Provision', desc: 'Zero-touch device setup', color: 'from-violet-500 to-purple-500', bg: 'bg-violet-500/10', ring: 'ring-violet-500/20' },
  { to: '/billing', icon: DollarSign, label: 'ISP Billing', desc: 'Manage customers & revenue', color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20' },
  { to: '/billing-map', icon: MapPin, label: 'Network Map', desc: 'GIS customer locations', color: 'from-amber-500 to-orange-500', bg: 'bg-amber-500/10', ring: 'ring-amber-500/20' },
];

/* ─── Main Dashboard ─── */
export function Dashboard() {
  const { projects, fetchProjects, createProject, deleteProject, loading: storeLoading } = useStore();
  const [stats, setStats] = useState(null);
  const [quickActions, setQuickActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', routeros_version: 'v7' });
  const navigate = useNavigate();
  const toast = useToast();

  const fetchDashboardData = async () => {
    try {
      const [statsRes, actionsRes] = await Promise.all([
        axios.get(`${API_URL}/dashboard/stats`),
        axios.get(`${API_URL}/dashboard/quick-actions`),
      ]);

      if (statsRes.data.success) {
        setStats(statsRes.data.stats || {});
      }
      if (actionsRes.data.success && Array.isArray(actionsRes.data.actions)) {
        setQuickActions(actionsRes.data.actions);
      } else {
        setQuickActions([]);
      }

      setLastRefresh(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchDashboardData();
    fetchProjects();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    fetchDashboardData();
    fetchProjects();
    toast.success('Dashboard refreshed');
  };

  const handleQuickAction = (action) => {
    if (action.id === 'new-project') {
      setShowCreate(true);
    } else {
      navigate(action.route);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const project = await createProject(newProject);
    if (project) { 
      setShowCreate(false); 
      navigate(`/project/${project.id}`); 
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (window.confirm('Delete this project?')) await deleteProject(id);
  };

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-full animate-fade-in">
      {/* Background */}
      <div className="absolute inset-0 bg-mesh" />
      <div className="absolute inset-0 bg-noise" />

      {/* Header */}
      <div className="relative border-b border-white/10">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-semibold text-blue-400 uppercase tracking-wider">MikroTik Config Builder</span>
              </div>
              <h1 className="text-3xl font-bold text-white mb-1">Dashboard</h1>
              <p className="text-gray-400">
                {lastRefresh && `Last updated: ${lastRefresh.toLocaleTimeString()}`}
              </p>
            </div>
            
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-8 py-8 space-y-8">
        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              icon={FolderOpen}
              label="Total Projects"
              value={stats.totalProjects}
              color="blue"
              trend={stats.recentProjects > 0 ? Math.round((stats.recentProjects / Math.max(stats.totalProjects - stats.recentProjects, 1)) * 100) : 0}
              onClick={() => navigate('/')}
            />
            <StatCard
              icon={Users}
              label="Total Customers"
              value={stats.totalCustomers}
              color="emerald"
              onClick={() => navigate('/billing-customers')}
            />
            <StatCard
              icon={UserCheck}
              label="Active Customers"
              value={stats.activeCustomers}
              color="green"
              onClick={() => navigate('/billing')}
            />
            <StatCard
              icon={DollarSign}
              label="Total Revenue"
              value={stats.totalRevenue}
              prefix="$"
              color="amber"
              onClick={() => navigate('/billing-reports')}
            />
            <StatCard
              icon={FileCode}
              label="Templates"
              value={stats.totalTemplates}
              color="violet"
              onClick={() => navigate('/templates')}
            />
            <StatCard
              icon={Router}
              label="Connected Devices"
              value={stats.activeDevices}
              color="cyan"
              onClick={() => navigate('/mikrotik-api')}
            />
            <StatCard
              icon={AlertTriangle}
              label="Overdue Invoices"
              value={stats.overdueInvoices}
              color="red"
              onClick={() => navigate('/billing-invoices')}
            />
            <StatCard
              icon={Activity}
              label="Pending Revenue"
              value={stats.pendingRevenue}
              prefix="$"
              color="amber"
              onClick={() => navigate('/billing-invoices')}
            />
          </div>
        )}

        {/* Quick Actions */}
        {quickActions.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
            <div className="flex flex-wrap gap-3">
              {quickActions.map(action => {
                const iconMap = {
                  FolderPlus, UserPlus, Key, Users, FileCode,
                };
                const Icon = iconMap[action.icon] || FolderPlus;
                return (
                  <QuickAction
                    key={action.id}
                    icon={Icon}
                    label={action.label}
                    color={action.color}
                    onClick={() => handleQuickAction(action)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Feature Cards */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featureCards.map((card) => (
              <FeatureCard key={card.to} {...card} />
            ))}
          </div>
        </div>

        {/* Recent Projects */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Recent Projects</h2>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          </div>

          {storeLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-pulse">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 bg-white/10 rounded-xl" />
                    <div className="w-8 h-4 bg-white/10 rounded" />
                  </div>
                  <div className="w-24 h-8 bg-white/10 rounded mb-2" />
                  <div className="w-32 h-4 bg-white/10 rounded" />
                </div>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
              <FolderOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No projects yet</h3>
              <p className="text-gray-400 mb-6">Create your first project to get started</p>
              <button
                onClick={() => setShowCreate(true)}
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                Create Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map(project => (
                <div
                  key={project.id}
                  onClick={() => navigate(`/project/${project.id}`)}
                  className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all cursor-pointer hover:bg-white/10 group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                      <FolderOpen className="w-5 h-5 text-white" />
                    </div>
                    <button
                      onClick={(e) => handleDelete(project.id, e)}
                      className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1">{project.name}</h3>
                  <p className="text-sm text-gray-400 mb-3 line-clamp-2">{project.description || 'No description'}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    {new Date(project.updated_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Project Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-6">Create New Project</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Project Name</label>
                  <input
                    type="text"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="My ISP Network"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                  <textarea
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Brief description of your project"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">RouterOS Version</label>
                  <select
                    value={newProject.routeros_version}
                    onChange={(e) => setNewProject({ ...newProject, routeros_version: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="v7">RouterOS v7</option>
                    <option value="v6">RouterOS v6</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
