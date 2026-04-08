import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Router, Plus, Trash2, Download, ArrowRight, 
  Settings, Shield, Network, Wifi, Globe,
  Copy, ChevronDown, ChevronRight, Eye
} from 'lucide-react';
import { RouterLinkGenerator } from '../utils/routerLinkGenerator';

const LINK_METHODS = [
  { id: 'ospf', label: 'OSPF Routing', icon: Network, color: '#3b82f6', desc: 'Dynamic routing between routers' },
  { id: 'bgp', label: 'BGP Peering', icon: Globe, color: '#8b5cf6', desc: 'BGP peering for autonomous systems' },
  { id: 'gre', label: 'GRE Tunnels', icon: ArrowRight, color: '#10b981', desc: 'Point-to-point GRE tunnels' },
  { id: 'wireguard', label: 'WireGuard Mesh', icon: Shield, color: '#ef4444', desc: 'Encrypted mesh network' },
  { id: 'vrrp', label: 'VRRP Redundancy', icon: Settings, color: '#f59e0b', desc: 'Primary/backup failover' },
  { id: 'eoip', label: 'EoIP Bridge', icon: Wifi, color: '#6366f1', desc: 'Layer 2 bridge across routers' },
  { id: 'management', label: 'Inter-Router Mgmt', icon: Settings, color: '#64748b', desc: 'Allow routers to manage each other' },
];

export function RouterLinking() {
  const navigate = useNavigate();
  const [routers, setRouters] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState('ospf');
  const [generatedScripts, setGeneratedScripts] = useState([]);
  const [showPreview, setShowPreview] = useState(null);
  const [activeStep, setActiveStep] = useState(1);

  // Add router definition
  const addRouter = () => {
    const id = `router-${Date.now()}`;
    setRouters([...routers, {
      id,
      name: `Router-${routers.length + 1}`,
      identity: `Router-${routers.length + 1}`,
      role: routers.length === 0 ? 'core' : 'branch',
      interfaces: [
        { name: 'ether1', ip: '', type: 'wan', connectedTo: null },
        { name: 'ether2', ip: '', type: 'lan', connectedTo: null },
      ],
      routerId: `10.0.0.${routers.length + 1}`,
      asn: 65000 + routers.length + 1,
      wgPrivateKey: '',
      wgPort: 13231,
    }]);
  };

  const updateRouter = (id, field, value) => {
    setRouters(routers.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const updateInterface = (routerId, ifaceName, field, value) => {
    setRouters(routers.map(r => 
      r.id === routerId ? {
        ...r,
        interfaces: r.interfaces.map(i => 
          i.name === ifaceName ? { ...i, [field]: value } : i
        ),
      } : r
    ));
  };

  const removeRouter = (id) => {
    setRouters(routers.filter(r => r.id !== id));
  };

  const addInterface = (routerId) => {
    setRouters(routers.map(r => 
      r.id === routerId ? {
        ...r,
        interfaces: [...r.interfaces, { 
          name: `ether${r.interfaces.length + 1}`, 
          ip: '', 
          type: 'lan',
          connectedTo: null,
        }],
      } : r
    ));
  };

  const removeInterface = (routerId, ifaceName) => {
    setRouters(routers.map(r => 
      r.id === routerId ? {
        ...r,
        interfaces: r.interfaces.filter(i => i.name !== ifaceName),
      } : r
    ));
  };

  // Generate scripts
  const generateScripts = () => {
    const generator = new RouterLinkGenerator(routers, selectedMethod);
    const scripts = generator.generate();
    setGeneratedScripts(scripts);
    setShowPreview(null);
  };

  // Copy script
  const copyScript = (text) => {
    navigator.clipboard.writeText(text);
  };

  // Download single script
  const downloadScript = (script) => {
    const blob = new Blob([script.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${script.name}.rsc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download all as combined
  const downloadAll = () => {
    let combined = '#############################################\n';
    combined += '# Combined Router Linking Configuration\n';
    combined += `# Generated: ${new Date().toISOString()}\n`;
    combined += `# Method: ${selectedMethod}\n`;
    combined += `# Routers: ${routers.length}\n`;
    combined += '#############################################\n\n';
    
    generatedScripts.forEach(script => {
      combined += `\n${'='.repeat(60)}\n`;
      combined += `# SCRIPT FOR: ${script.name}\n`;
      combined += `${'='.repeat(60)}\n\n`;
      combined += script.content;
      combined += '\n\n';
    });

    const blob = new Blob([combined], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `router-linking-${selectedMethod}-${Date.now()}.rsc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full">
      {/* Left Panel - Router Definitions */}
      <div className="w-96 bg-slate-800 border-r border-slate-700 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-white font-semibold text-lg">Router Definitions</h3>
          <p className="text-xs text-slate-400 mt-1">Define each router in your network</p>
        </div>

        <div className="p-4 space-y-4">
          {routers.map((router, idx) => (
            <div key={router.id} className="bg-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Router className="w-5 h-5 text-blue-500" />
                  <span className="text-white font-semibold">{router.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    router.role === 'core' ? 'bg-red-600/20 text-red-400' :
                    router.role === 'distribution' ? 'bg-amber-600/20 text-amber-400' :
                    'bg-green-600/20 text-green-400'
                  }`}>
                    {router.role}
                  </span>
                </div>
                <button onClick={() => removeRouter(router.id)} className="text-red-500 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <input
                  placeholder="Router Name"
                  value={router.name}
                  onChange={(e) => updateRouter(router.id, 'name', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={router.role}
                    onChange={(e) => updateRouter(router.id, 'role', e.target.value)}
                    className="px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                  >
                    <option value="core">Core</option>
                    <option value="distribution">Distribution</option>
                    <option value="branch">Branch</option>
                    <option value="edge">Edge</option>
                  </select>
                  <input
                    placeholder="Router ID (10.0.0.x)"
                    value={router.routerId}
                    onChange={(e) => updateRouter(router.id, 'routerId', e.target.value)}
                    className="px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                  />
                </div>
                <input
                  placeholder="Identity"
                  value={router.identity}
                  onChange={(e) => updateRouter(router.id, 'identity', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                />

                {/* Interfaces */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-300">Interfaces</span>
                    <button 
                      onClick={() => addInterface(router.id)}
                      className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {router.interfaces.map(iface => (
                      <div key={iface.name} className="bg-slate-800 p-2 rounded flex items-center gap-2">
                        <input
                          placeholder="Name"
                          value={iface.name}
                          onChange={(e) => updateInterface(router.id, iface.name, 'name', e.target.value)}
                          className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                        />
                        <input
                          placeholder="IP/CIDR"
                          value={iface.ip}
                          onChange={(e) => updateInterface(router.id, iface.name, 'ip', e.target.value)}
                          className="flex-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                        />
                        <select
                          value={iface.type}
                          onChange={(e) => updateInterface(router.id, iface.name, 'type', e.target.value)}
                          className="w-16 px-1 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                        >
                          <option value="wan">WAN</option>
                          <option value="lan">LAN</option>
                          <option value="link">Link</option>
                        </select>
                        {router.interfaces.length > 1 && (
                          <button 
                            onClick={() => removeInterface(router.id, iface.name)}
                            className="text-red-500 hover:text-red-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* BGP ASN */}
                {(selectedMethod === 'bgp') && (
                  <input
                    placeholder="ASN"
                    type="number"
                    value={router.asn}
                    onChange={(e) => updateRouter(router.id, 'asn', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                  />
                )}

                {/* WireGuard */}
                {selectedMethod === 'wireguard' && (
                  <>
                    <input
                      placeholder="WG Private Key"
                      value={router.wgPrivateKey}
                      onChange={(e) => updateRouter(router.id, 'wgPrivateKey', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                    />
                    <input
                      placeholder="WG Listen Port"
                      type="number"
                      value={router.wgPort}
                      onChange={(e) => updateRouter(router.id, 'wgPort', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                    />
                  </>
                )}
              </div>
            </div>
          ))}

          <button
            onClick={addRouter}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" /> Add Router
          </button>
        </div>
      </div>

      {/* Center - Linking Method */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="bg-slate-800 border-b border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Router Linking Configuration</h2>
              <p className="text-sm text-slate-400 mt-1">Choose how your routers will connect</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={generateScripts}
                disabled={routers.length < 2}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Settings className="w-4 h-4" /> Generate Scripts
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Link Method Selection */}
          <h3 className="text-lg font-semibold text-white mb-4">Linking Method</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
            {LINK_METHODS.map((method) => (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedMethod === method.id 
                    ? 'border-blue-500 bg-blue-600/10' 
                    : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                }`}
              >
                <method.icon className="w-8 h-8 mb-2" style={{ color: method.color }} />
                <h4 className="text-white font-semibold text-sm">{method.label}</h4>
                <p className="text-xs text-slate-400 mt-1">{method.desc}</p>
              </button>
            ))}
          </div>

          {/* Router Linking Diagram */}
          {routers.length >= 2 && (
            <div className="bg-slate-800 rounded-lg p-6 mb-6">
              <h4 className="text-white font-semibold mb-4">Linking Preview</h4>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                {routers.map((router, idx) => (
                  <React.Fragment key={router.id}>
                    <div className="bg-slate-700 rounded-lg p-4 text-center min-w-[120px]">
                      <Router className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                      <div className="text-white font-semibold text-sm">{router.name}</div>
                      <div className="text-xs text-slate-400">{router.routerId}</div>
                      <div className="text-xs text-slate-500 mt-1">{router.role}</div>
                    </div>
                    {idx < routers.length - 1 && (
                      <div className="flex flex-col items-center">
                        <ArrowRight className="w-6 h-6 text-green-500" />
                        <span className="text-xs text-green-400 mt-1">{selectedMethod}</span>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Generated Scripts */}
          {generatedScripts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-white font-semibold">Generated Scripts ({generatedScripts.length} routers)</h4>
                <button
                  onClick={downloadAll}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Download All
                </button>
              </div>
              <div className="space-y-4">
                {generatedScripts.map((script, idx) => (
                  <div key={idx} className="bg-slate-800 rounded-lg border border-slate-700">
                    <div className="flex items-center justify-between p-4 border-b border-slate-700">
                      <div className="flex items-center gap-3">
                        <Router className="w-5 h-5 text-blue-500" />
                        <div>
                          <h5 className="text-white font-semibold">{script.name}</h5>
                          <p className="text-xs text-slate-400">{script.description}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowPreview(showPreview === idx ? null : idx)}
                          className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" /> Preview
                        </button>
                        <button
                          onClick={() => copyScript(script.content)}
                          className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1"
                        >
                          <Copy className="w-4 h-4" /> Copy
                        </button>
                        <button
                          onClick={() => downloadScript(script)}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1"
                        >
                          <Download className="w-4 h-4" /> .rsc
                        </button>
                      </div>
                    </div>
                    {showPreview === idx && (
                      <pre className="p-4 text-sm text-green-400 font-mono overflow-auto max-h-[500px]">
                        {script.content}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {routers.length < 2 && (
            <div className="text-center py-12">
              <Network className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500 text-lg">Add at least 2 routers to generate linking scripts</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
