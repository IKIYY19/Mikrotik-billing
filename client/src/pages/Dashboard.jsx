import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { Plus, FolderOpen, Trash2, ArrowRight, Sparkles, Router, Settings, Code, Network, Shield, DollarSign, MapPin } from 'lucide-react';

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

/* ─── Skeleton Card ─── */
function SkeletonCard() {
  return (
    <div className="glass rounded-2xl p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="skeleton w-10 h-10 rounded-xl" />
        <div className="skeleton w-12 h-4 rounded" />
      </div>
      <div className="skeleton w-20 h-8 rounded mb-2" />
      <div className="skeleton w-28 h-4 rounded" />
    </div>
  );
}

/* ─── Feature Cards ─── */
const featureCards = [
  { to: '/topology', icon: Network, label: 'Topology Builder', desc: 'Visual network design', color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-500/10', ring: 'ring-blue-500/20' },
  { to: '/devices', icon: Settings, label: 'Auto Provision', desc: 'Zero-touch device setup', color: 'from-violet-500 to-purple-500', bg: 'bg-violet-500/10', ring: 'ring-violet-500/20' },
  { to: '/billing', icon: DollarSign, label: 'ISP Billing', desc: 'Manage customers & revenue', color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20' },
  { to: '/billing-map', icon: MapPin, label: 'Network Map', desc: 'GIS customer locations', color: 'from-amber-500 to-orange-500', bg: 'bg-amber-500/10', ring: 'ring-amber-500/20' },
];

export function Dashboard() {
  const { projects, fetchProjects, createProject, deleteProject, loading } = useStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', routeros_version: 'v7' });
  const navigate = useNavigate();

  useEffect(() => { fetchProjects(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    const project = await createProject(newProject);
    if (project) { setShowCreate(false); navigate(`/project/${project.id}`); }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (window.confirm('Delete this project?')) await deleteProject(id);
  };

  return (
    <div className="relative min-h-full animate-fade-in">
      {/* Background mesh */}
      <div className="absolute inset-0 bg-mesh" />
      <div className="absolute inset-0 bg-noise" />

      {/* Hero */}
      <div className="relative border-b border-zinc-800/40">
        <div className="max-w-7xl mx-auto px-8 py-10">
          <div className="flex items-start justify-between">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">MikroTik Config Builder</span>
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Projects</h1>
              <p className="text-zinc-400 leading-relaxed">Create and manage MikroTik RouterOS configurations. Generate scripts, provision devices, and manage your ISP billing.</p>
            </div>
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              New Project
            </button>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-4 gap-3 mt-8">
            {featureCards.map((f, i) => (
              <button
                key={i}
                onClick={() => navigate(f.to)}
                className="group glass rounded-xl p-4 text-left card-hover transition-all duration-300"
              >
                <div className={`w-9 h-9 rounded-lg ${f.bg} ring-1 ${f.ring} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                  <f.icon className={`w-4 h-4 bg-gradient-to-r ${f.color} bg-clip-text`} style={{ color: 'currentColor' }} />
                </div>
                <div className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">{f.label}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{f.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Projects */}
      <div className="relative max-w-7xl mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Recent Projects</h2>
          {projects.length > 0 && (
            <span className="text-sm text-zinc-500">{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <FolderOpen className="w-7 h-7 text-zinc-600" />
            </div>
            <div className="empty-state-title">No projects yet</div>
            <div className="empty-state-desc">Create your first project to start building configurations</div>
            <button onClick={() => setShowCreate(true)} className="btn-primary mt-4">
              <Plus className="w-4 h-4" />
              Create Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project, i) => (
              <div
                key={project.id}
                onClick={() => navigate(`/project/${project.id}`)}
                className="group glass rounded-2xl p-5 cursor-pointer card-hover transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="relative">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 ring-1 ring-blue-500/10 flex items-center justify-center">
                      <Router className="w-5 h-5 text-blue-400" />
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(project.id, e)}
                    className="text-zinc-600 hover:text-rose-400 transition-colors p-2 rounded-lg hover:bg-zinc-800/40 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="text-base font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors truncate">{project.name}</h3>
                {project.description ? (
                  <p className="text-sm text-zinc-400 mb-4 line-clamp-2 leading-relaxed">{project.description}</p>
                ) : (
                  <div className="mb-4" />
                )}
                <div className="flex items-center justify-between pt-3 border-t border-zinc-800/40">
                  <span className="badge badge-blue text-[11px]">{project.routeros_version}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-zinc-500">{new Date(project.updated_at).toLocaleDateString()}</span>
                    <ArrowRight className="w-3 h-3 text-zinc-600 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="glass-strong rounded-2xl w-full max-w-md animate-fade-in-scale" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-800/50">
              <h3 className="text-lg font-semibold text-white">Create Project</h3>
              <p className="text-sm text-zinc-400 mt-0.5">Configure a new MikroTik RouterOS setup</p>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Project Name</label>
                <input
                  type="text" required autoFocus
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="modern-input"
                  placeholder="e.g., Branch Office Router"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Description</label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  className="modern-input resize-none"
                  rows="3"
                  placeholder="What's this configuration for?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">RouterOS Version</label>
                <select
                  value={newProject.routeros_version}
                  onChange={(e) => setNewProject({ ...newProject, routeros_version: e.target.value })}
                  className="modern-input"
                >
                  <option value="v7">RouterOS v7</option>
                  <option value="v6">RouterOS v6</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </div>
                  ) : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
