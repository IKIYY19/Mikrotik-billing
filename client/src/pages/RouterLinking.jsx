import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Router,
  Plus,
  Trash2,
  Download,
  ArrowRight,
  Settings,
  Shield,
  Network,
  Wifi,
  Globe,
  Copy,
  Eye,
  Wand2,
  Link2,
  Layers,
} from "lucide-react";
import { RouterLinkGenerator } from "../utils/routerLinkGenerator";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useToast } from "../hooks/useToast";

const LINK_METHODS = [
  {
    id: "ospf",
    label: "OSPF Routing",
    icon: Network,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    desc: "Dynamic routing between routers",
  },
  {
    id: "bgp",
    label: "BGP Peering",
    icon: Globe,
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
    desc: "BGP peering for autonomous systems",
  },
  {
    id: "gre",
    label: "GRE Tunnels",
    icon: ArrowRight,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    desc: "Point-to-point GRE tunnels",
  },
  {
    id: "wireguard",
    label: "WireGuard Mesh",
    icon: Shield,
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    desc: "Encrypted mesh network",
  },
  {
    id: "vrrp",
    label: "VRRP Redundancy",
    icon: Settings,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    desc: "Primary/backup failover",
  },
  {
    id: "eoip",
    label: "EoIP Bridge",
    icon: Wifi,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10 border-indigo-500/20",
    desc: "Layer 2 bridge across routers",
  },
  {
    id: "management",
    label: "Inter-Router Mgmt",
    icon: Settings,
    color: "text-zinc-400",
    bg: "bg-zinc-500/10 border-zinc-500/20",
    desc: "Allow routers to manage each other",
  },
];

const ROLE_COLORS = {
  core: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  distribution: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  branch: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  edge: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

export function RouterLinking() {
  const navigate = useNavigate();
  const toast = useToast();
  const [routers, setRouters] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState("ospf");
  const [generatedScripts, setGeneratedScripts] = useState([]);
  const [showPreview, setShowPreview] = useState(null);
  const [expandedRouter, setExpandedRouter] = useState(null);

  const addRouter = () => {
    const id = `router-${Date.now()}`;
    setRouters([
      ...routers,
      {
        id,
        name: `Router-${routers.length + 1}`,
        identity: `Router-${routers.length + 1}`,
        role: routers.length === 0 ? "core" : "branch",
        interfaces: [
          { name: "ether1", ip: "", type: "wan", connectedTo: null },
          { name: "ether2", ip: "", type: "lan", connectedTo: null },
        ],
        routerId: `10.0.0.${routers.length + 1}`,
        asn: 65000 + routers.length + 1,
        wgPrivateKey: "",
        wgPort: 13231,
      },
    ]);
    setExpandedRouter(id);
  };

  const updateRouter = (id, field, value) => {
    setRouters(
      routers.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  };

  const updateInterface = (routerId, ifaceName, field, value) => {
    setRouters(
      routers.map((r) => {
        if (r.id !== routerId) return r;
        return {
          ...r,
          interfaces: r.interfaces.map((i) =>
            i.name === ifaceName ? { ...i, [field]: value } : i,
          ),
        };
      }),
    );
  };

  const removeRouter = (id) => {
    setRouters(routers.filter((r) => r.id !== id));
    if (expandedRouter === id) setExpandedRouter(null);
  };

  const addInterface = (routerId) => {
    setRouters(
      routers.map((r) => {
        if (r.id !== routerId) return r;
        return {
          ...r,
          interfaces: [
            ...r.interfaces,
            {
              name: `ether${r.interfaces.length + 1}`,
              ip: "",
              type: "lan",
              connectedTo: null,
            },
          ],
        };
      }),
    );
  };

  const removeInterface = (routerId, ifaceName) => {
    setRouters(
      routers.map((r) => {
        if (r.id !== routerId) return r;
        return {
          ...r,
          interfaces: r.interfaces.filter((i) => i.name !== ifaceName),
        };
      }),
    );
  };

  const generateScripts = () => {
    if (routers.length < 2) {
      toast.error("Add at least 2 routers");
      return;
    }
    const generator = new RouterLinkGenerator(routers, selectedMethod);
    const scripts = generator.generate();
    setGeneratedScripts(scripts);
    toast.success(`Generated ${scripts.length} scripts`);
  };

  const copyScript = (content) => {
    navigator.clipboard.writeText(content);
    toast.success("Script copied");
  };

  const downloadScript = (script) => {
    const blob = new Blob([script.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${script.name.replace(/\s+/g, "-").toLowerCase()}.rsc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => {
    let combined = generatedScripts
      .map((s) => `# ${s.name}\n# ${s.description}\n${s.content}\n`)
      .join("\n\n");
    const blob = new Blob([combined], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `router-linking-${selectedMethod}.rsc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selected = LINK_METHODS.find((m) => m.id === selectedMethod);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-blue-400" />
            </div>
            Router Linking Wizard
          </h1>
          <p className="text-zinc-400 mt-2 ml-13">
            Define routers and generate linking configuration scripts
          </p>
        </div>
        <Button
          onClick={generateScripts}
          disabled={routers.length < 2}
          className="gap-2"
        >
          <Wand2 className="w-4 h-4" /> Generate Scripts
        </Button>
      </div>

      {/* Linking Method */}
      <Card className="border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-white">Linking Method</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {LINK_METHODS.map((method) => (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                className={`rounded-xl border p-4 text-left transition-all ${
                  selectedMethod === method.id
                    ? `${method.bg} ring-1 ring-white/10`
                    : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/30"
                }`}
              >
                <method.icon className={`w-5 h-5 mb-2 ${method.color}`} />
                <p className="text-white font-medium text-sm">{method.label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{method.desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Router Definitions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {routers.map((router) => (
          <Card key={router.id} className="border-zinc-800 overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Router className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-sm text-white">
                      {router.name}
                    </CardTitle>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border ${ROLE_COLORS[router.role]}`}
                    >
                      {router.role}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRouter(router.id)}
                  className="text-zinc-500 hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px]">Name</Label>
                  <Input
                    value={router.name}
                    onChange={(e) =>
                      updateRouter(router.id, "name", e.target.value)
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Router ID</Label>
                  <Input
                    value={router.routerId}
                    onChange={(e) =>
                      updateRouter(router.id, "routerId", e.target.value)
                    }
                    className="h-8 text-xs"
                    placeholder="10.0.0.x"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px]">Identity</Label>
                  <Input
                    value={router.identity}
                    onChange={(e) =>
                      updateRouter(router.id, "identity", e.target.value)
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Role</Label>
                  <select
                    value={router.role}
                    onChange={(e) =>
                      updateRouter(router.id, "role", e.target.value)
                    }
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="core">Core</option>
                    <option value="distribution">Distribution</option>
                    <option value="branch">Branch</option>
                    <option value="edge">Edge</option>
                  </select>
                </div>
              </div>

              {/* Interfaces */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-[11px]">Interfaces</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addInterface(router.id)}
                    className="text-xs text-blue-400 h-6"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {router.interfaces.map((iface) => (
                    <div
                      key={iface.name}
                      className="flex items-center gap-1.5 bg-zinc-900/50 rounded-lg p-2"
                    >
                      <Input
                        value={iface.name}
                        onChange={(e) =>
                          updateInterface(
                            router.id,
                            iface.name,
                            "name",
                            e.target.value,
                          )
                        }
                        className="h-7 text-xs w-20"
                        placeholder="Name"
                      />
                      <Input
                        value={iface.ip}
                        onChange={(e) =>
                          updateInterface(
                            router.id,
                            iface.name,
                            "ip",
                            e.target.value,
                          )
                        }
                        className="h-7 text-xs flex-1"
                        placeholder="IP/CIDR"
                      />
                      <select
                        value={iface.type}
                        onChange={(e) =>
                          updateInterface(
                            router.id,
                            iface.name,
                            "type",
                            e.target.value,
                          )
                        }
                        className="h-7 w-16 rounded-md border border-input bg-background px-1 text-xs"
                      >
                        <option value="wan">WAN</option>
                        <option value="lan">LAN</option>
                        <option value="link">Link</option>
                      </select>
                      {router.interfaces.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeInterface(router.id, iface.name)}
                          className="text-zinc-600 hover:text-red-400 h-7 w-7 p-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Method-specific fields */}
              {selectedMethod === "bgp" && (
                <div>
                  <Label className="text-[11px]">ASN</Label>
                  <Input
                    type="number"
                    value={router.asn}
                    onChange={(e) =>
                      updateRouter(router.id, "asn", e.target.value)
                    }
                    className="h-8 text-xs"
                  />
                </div>
              )}

              {selectedMethod === "wireguard" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px]">Private Key</Label>
                    <Input
                      value={router.wgPrivateKey}
                      onChange={(e) =>
                        updateRouter(router.id, "wgPrivateKey", e.target.value)
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Listen Port</Label>
                    <Input
                      type="number"
                      value={router.wgPort}
                      onChange={(e) =>
                        updateRouter(router.id, "wgPort", e.target.value)
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Add Router Button */}
        <button
          onClick={addRouter}
          className="border-2 border-dashed border-zinc-700 hover:border-zinc-500 rounded-xl p-8 flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors min-h-[200px]"
        >
          <Plus className="w-8 h-8" />
          <span className="text-sm font-medium">Add Router</span>
        </button>
      </div>

      {/* Linking Preview */}
      {routers.length >= 2 && (
        <Card className="border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-zinc-400" />
              {selected?.label} — Topology Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-4 flex-wrap py-4">
              {routers.map((router, idx) => (
                <React.Fragment key={router.id}>
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center min-w-[100px]">
                    <Router className="w-6 h-6 text-blue-400 mx-auto mb-1.5" />
                    <p className="text-white font-medium text-sm">
                      {router.name}
                    </p>
                    <p className="text-xs text-zinc-500">{router.routerId}</p>
                  </div>
                  {idx < routers.length - 1 && (
                    <div className="flex flex-col items-center gap-0.5">
                      <ArrowRight className={`w-5 h-5 ${selected?.color}`} />
                      <span className="text-[10px] text-zinc-600">
                        {selectedMethod}
                      </span>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated Scripts */}
      {generatedScripts.length > 0 && (
        <Card className="border-zinc-800">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base text-white">
              Generated Scripts ({generatedScripts.length})
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadAll}
              className="gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Download All
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {generatedScripts.map((script, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-zinc-800 overflow-hidden"
              >
                <div className="flex items-center justify-between p-3 bg-zinc-900/50">
                  <div className="flex items-center gap-3">
                    <Router className="w-4 h-4 text-blue-400" />
                    <div>
                      <p className="text-white text-sm font-medium">
                        {script.name}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {script.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setShowPreview(showPreview === idx ? null : idx)
                      }
                      className="text-zinc-400 hover:text-white"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyScript(script.content)}
                      className="text-zinc-400 hover:text-white"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadScript(script)}
                      className="text-emerald-400 hover:text-emerald-300"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                {showPreview === idx && (
                  <pre className="p-4 text-xs text-emerald-400 font-mono whitespace-pre-wrap overflow-auto max-h-[400px] bg-zinc-950">
                    {script.content}
                  </pre>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {routers.length < 2 && !generatedScripts.length && (
        <Card className="border-zinc-800">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Network className="w-8 h-8 text-zinc-600" />
            </div>
            <p className="text-zinc-400 font-medium">
              Add at least 2 routers to generate linking scripts
            </p>
            <p className="text-sm text-zinc-600 mt-1">
              Click "Add Router" above to get started
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
