import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Router,
  Copy,
  Check,
  Key,
  Terminal,
  Loader2,
  Shield,
  User,
  Lock,
  Wifi,
  ArrowRight,
  AlertCircle,
  Link2,
  Plug,
  Plus,
} from "lucide-react";
import { useToastStore } from "../stores/toastStore";
import { getToken } from "../lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";

const API = import.meta.env.VITE_API_URL || "/api";

export default function RouterLink() {
  const toast = useToastStore();
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem("router_link_api_key") || ""
  );
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [appUrl, setAppUrl] = useState(
    () => localStorage.getItem("router_link_app_url") || window.location.origin
  );
  const [mgmtUser, setMgmtUser] = useState(
    () => localStorage.getItem("router_link_mgmt_user") || "admin"
  );
  const [mgmtPass, setMgmtPass] = useState("");
  const [mgmtPort, setMgmtPort] = useState("8728");
  const [showCredentials, setShowCredentials] = useState(false);

  const handleAppUrlChange = (e) => {
    const val = e.target.value;
    setAppUrl(val);
    localStorage.setItem("router_link_app_url", val);
  };

  const [connectionStatus, setConnectionStatus] = useState(null);
  const [polling, setPolling] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [checkCount, setCheckCount] = useState(0);
  const [manualKey, setManualKey] = useState("");
  const [debugInfo, setDebugInfo] = useState(null);
  const [allRouters, setAllRouters] = useState([]);
  const [watchAttempts, setWatchAttempts] = useState(0);
  const [watchRemaining, setWatchRemaining] = useState(0);
  const [diagnostics, setDiagnostics] = useState(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [applyingFix, setApplyingFix] = useState(null);
  const [selectedRouters, setSelectedRouters] = useState(new Set());
  const [bulkApplyingFix, setBulkApplyingFix] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(null);
  const [connectionLogs, setConnectionLogs] = useState([]);
  const [showKeyRotation, setShowKeyRotation] = useState(false);
  const [keyRotationSchedule, setKeyRotationSchedule] = useState(
    () => localStorage.getItem("key_rotation_days") || "90"
  );
  const [keyHistory, setKeyHistory] = useState(
    () => JSON.parse(localStorage.getItem("key_history")) || []
  );
  const [routerGroups, setRouterGroups] = useState(
    () => JSON.parse(localStorage.getItem("router_groups")) || []
  );
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState("location");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [backups, setBackups] = useState(
    () => JSON.parse(localStorage.getItem("router_backups")) || []
  );
  const [showBackupPanel, setShowBackupPanel] = useState(false);
  const [showTopology, setShowTopology] = useState(false);
  const [metrics, setMetrics] = useState(
    () => JSON.parse(localStorage.getItem("router_metrics")) || {}
  );
  const [showMetrics, setShowMetrics] = useState(false);
  const watchIntervalRef = React.useRef(null);

  const configTemplates = [
    {
      id: "standard",
      name: "Standard ISP Setup",
      description: "Full RADIUS + PPPoE + Hotspot with monitoring",
      commands: [
        "/ip radius add address=BILLING_SERVER secret=YOUR_SECRET service=ppp",
        "/interface pppoe-server server add interface=bridge1 service-name=ISP authentication=radius",
        "/ip hotspot profile add name=hsprof radius=yes",
        "/ip hotspot add name=hs1 interface=bridge1 profile=hsprof",
        "/ip firewall nat add chain=dstnat action=dst-nat to-addresses=BILLING_SERVER protocol=tcp dst-port=8728 in-interface-list=WAN",
      ],
    },
    {
      id: "minimal",
      name: "Minimal Setup",
      description: "PPPoE only (no Hotspot or RADIUS)",
      commands: [
        "/interface pppoe-server server add interface=bridge1 service-name=ISP local-address=10.0.0.1 remote-address=10.0.0.0/24",
      ],
    },
    {
      id: "advanced",
      name: "Advanced Multi-WAN",
      description: "RADIUS + PPPoE + Hotspot + QoS + Failover",
      commands: [
        "/ip radius add address=BILLING_SERVER secret=YOUR_SECRET service=ppp",
        "/interface pppoe-server server add interface=bridge1 service-name=ISP authentication=radius",
        "/ip hotspot profile add name=hsprof radius=yes",
        "/ip hotspot add name=hs1 interface=bridge1 profile=hsprof",
        "/queue simple add name=qos1 target=bridge1 max-limit=100M",
        "/routing failover add interface=ether1-gateway check-gateway=ping disabled=no",
      ],
    },
  ];

  const applyTemplate = async (template) => {
    if (selectedRouters.size === 0) {
      toast.error("Select routers first");
      return;
    }

    setApplyingTemplate(template.id);
    let successCount = 0;
    let failureCount = 0;

    try {
      for (const routerId of selectedRouters) {
        try {
          await axios.post(
            `${API}/router/v1/${tenantSlug}/routers/${routerId}/execute-commands`,
            { commands: template.commands },
            { headers: { Authorization: `Bearer ${apiKey}` } },
          );
          successCount++;
        } catch (e) {
          failureCount++;
        }
      }

      toast.success(
        `Applied ${template.name} to ${successCount} router(s)${failureCount > 0 ? `, failed on ${failureCount}` : ""}`
      );
      setSelectedRouters(new Set());
      setShowTemplates(false);
      fetchAllRouters();
    } catch (e) {
      toast.error("Template apply failed");
    } finally {
      setApplyingTemplate(null);
    }
  };

  const startWatching = async () => {
    if (!tenantSlug) {return;}
    stopWatching();

    try {
      const { data } = await axios.post(`${API}/router/v1/${tenantSlug}/watch/start`);
      const { sessionId } = data;
      setConnectionStatus({ connected: false, status: "watching", message: "Watch session started" });
      setWatchAttempts(0);
      setLastError(null);

      const poll = async () => {
        try {
          const { data } = await axios.get(`${API}/router/v1/${tenantSlug}/watch/${sessionId}`);
          setWatchAttempts((c) => c + 1);

          if (data.found) {
            stopWatching();
            setConnectionStatus({ connected: true, status: "online", router: data.router, message: data.message });
            fetchDiagnostics(data.router?.id);
            fetchAllRouters();
            addLog("success", `Router connected: ${data.message}`, data.router?.name);
            toast.success(data.message);
          } else if (data.expired) {
            stopWatching();
            setConnectionStatus({ connected: false, status: "timeout", message: data.message });
            addLog("warning", `Watch session expired: ${data.message}`);
          } else {
            setWatchRemaining(Math.max(0, 600 - (data.elapsed || 0)));
          }
        } catch (e) {
          // silent retry
        }
      };

      poll();
      watchIntervalRef.current = setInterval(poll, 3000);
    } catch (e) {
      setLastError("Failed to start watch session: " + (e.response?.data?.error || e.message));
    }
  };

  const stopWatching = () => {
    if (watchIntervalRef.current) {
      clearInterval(watchIntervalRef.current);
      watchIntervalRef.current = null;
    }
  };

  useEffect(() => {
    fetchTenant();
    return () => stopWatching();
  }, []);

  useEffect(() => {
    if (apiKey) { setPolling(true); }
  }, [apiKey]);

  const fetchTenant = async () => {
    try {
      const token = getToken();
      const { data } = await axios.get(`${API}/tenants/current`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTenantId(data.id);
      setTenantSlug(data.slug || data.name?.toLowerCase().replace(/\s+/g, "-") || "");
      const storedKey = localStorage.getItem("router_link_api_key");
      const tenantKey = data.settings?.api_key;
      // Prefer tenant key, fall back to localStorage, fall back to empty
      const activeKey = tenantKey || storedKey || "";
      if (activeKey && activeKey !== apiKey) {
        setApiKey(activeKey);
        localStorage.setItem("router_link_api_key", activeKey);
      }
    } catch (e) {
      // If tenant fetch fails, try stored key
      const storedKey = localStorage.getItem("router_link_api_key");
      if (storedKey && !apiKey) {
        setApiKey(storedKey);
      }
      toast.error("Failed to load tenant");
    } finally {
      setLoading(false);
    }
  };

  const generateKey = async (isRotation = false) => {
    setGenerating(true);
    try {
      const token = getToken();
      const key =
        "mtk-" +
        Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join(
          "",
        );
      await axios.put(
        `${API}/tenants/${tenantId}/api-key`,
        { api_key: key },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const newHistory = [
        { key: apiKey, createdAt: new Date().toISOString(), rotated: isRotation },
        ...keyHistory.slice(0, 9),
      ];
      setKeyHistory(newHistory);
      localStorage.setItem("key_history", JSON.stringify(newHistory));
      setApiKey(key);
      localStorage.setItem("router_link_api_key", key);
      setPolling(true);
      addLog("success", isRotation ? "API key rotated" : "New API key generated");
      toast.success(isRotation ? "API key rotated successfully" : "API key generated");
    } catch (e) {
      toast.error("Failed to generate key");
    } finally {
      setGenerating(false);
    }
  };

  const fetchDiagnostics = async (routerId = connectionStatus?.router?.id) => {
    if (!tenantSlug || !routerId) {return;}
    setDiagnosticsLoading(true);
    try {
      const { data } = await axios.get(
        `${API}/router/v1/${tenantSlug}/routers/${routerId}/diagnostics`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );
      setDiagnostics(data);
    } catch (e) {
      setDiagnostics({
        status: "error",
        steps: [
          {
            id: "diagnostics",
            label: "Diagnostics",
            status: "error",
            message: e.response?.data?.error || e.message,
          },
        ],
      });
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  const applyDiagnosticFix = async (stepId) => {
    const routerId = connectionStatus?.router?.id;
    if (!tenantSlug || !routerId || !stepId) {return;}

    setApplyingFix(stepId);
    try {
      const { data } = await axios.post(
        `${API}/router/v1/${tenantSlug}/routers/${routerId}/diagnostics/${stepId}/apply`,
        {},
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );
      if (data.diagnostics) {
        setDiagnostics(data.diagnostics);
      } else {
        fetchDiagnostics(routerId);
      }
      addLog("success", `Diagnostic fix applied: ${stepId}`);
      toast.success(data.message || "Fix applied");
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed to apply fix");
    } finally {
      setApplyingFix(null);
    }
  };

  const buildCommand = () => {
    const mode = appUrl.startsWith("https") ? "https" : "http";
    const certFlag = appUrl.startsWith("https") ? " check-certificate=no" : "";
    const slugPath = tenantSlug ? `/v1/${tenantSlug}/install` : "/v1/scripts/install";
    let prefix = "";

    if (mgmtUser && mgmtPass) {
      prefix = `:global ztpMgmtUser "${mgmtUser}"; :global ztpMgmtPass "${mgmtPass}"; `;
    }

    return `${prefix}/tool fetch url="${appUrl}/api/router${slugPath}" http-header-field="Authorization: Bearer ${apiKey}" dst-path=install.rsc mode=${mode}${certFlag}; :delay 4s; /import file-name=install.rsc; :delay 1s; /file remove install.rsc`;
  };

  const copyCommand = () => {
    localStorage.setItem("router_link_mgmt_user", mgmtUser);
    navigator.clipboard.writeText(buildCommand());
    setCopied(true);
    toast.success("Command copied to clipboard");
    setTimeout(() => setCopied(false), 3000);
  };

  const handleUpgrade = async () => {
    if (!mgmtUser || !mgmtPass) {
      toast.error("Enter management username and password first");
      return;
    }
    if (!connectionStatus?.router?.id && !connectionStatus?.router?.mac) {
      toast.error("Router details not available. Wait for the router to connect first.");
      return;
    }

    setIsUpgrading(true);
    try {
      const payload = {
        username: mgmtUser,
        password: mgmtPass,
        port: mgmtPort,
        connection_type: "api",
      };

      const headers = { Authorization: `Bearer ${apiKey}` };

      const { data } = connectionStatus.router.id
        ? await axios.post(
            `${API}/router/v1/${tenantSlug}/routers/${connectionStatus.router.id}/link-billing`,
            {
              ...payload,
              test_ip: connectionStatus.router.ip || undefined,
            },
            { headers },
          )
        : await axios.put(
            `${API}/router/v1/upgrade`,
            {
              ...payload,
              mac: connectionStatus.router.mac,
            },
            { headers },
          );

      toast.success(
        data.subscriptions_synced
          ? `Router upgraded. Synced ${data.subscriptions_synced} subscription(s).`
          : "Router upgraded to full management",
      );
      localStorage.setItem("router_link_mgmt_user", mgmtUser);
      manualCheck();
      fetchDiagnostics(data.router?.id || connectionStatus.router.id);
    } catch (e) {
      const detail = e.response?.data?.raw_error;
      const message = e.response?.data?.error || "Upgrade failed";
      toast.error(detail ? `${message} (${detail})` : message);
    } finally {
      setIsUpgrading(false);
    }
  };

  const fetchAllRouters = async () => {
    if (!tenantSlug) {return;}
    try {
      const { data } = await axios.get(`${API}/router/v1/${tenantSlug}/routers`);
      setAllRouters(data.routers || data.by_tenant_id || []);
    } catch (e) {
      // silent
    }
  };

  // Manual check (in addition to SSE watch)
  const addLog = (type, message, routerName = "System") => {
    const timestamp = new Date().toLocaleTimeString();
    setConnectionLogs((prev) => [
      { type, message, routerName, timestamp },
      ...prev.slice(0, 99),
    ]);
  };

  const manualCheck = async () => {
    setLastError(null);
    if (!tenantSlug || !apiKey) {
      toast.error("No API key configured");
      return;
    }
    try {
      const url = `${API}/router/v1/${tenantSlug}/status?t=${Date.now()}`;
      const { data } = await axios.get(url, { headers: { Authorization: "Bearer " + apiKey } });
      setConnectionStatus(data);
      setDebugInfo({ url, response: data });
      setCheckCount((c) => c + 1);
      updateMetricsFromStatus(data);
      fetchAllRouters();
      if (data.router?.id) {
        fetchDiagnostics(data.router.id);
        addLog("success", `Router ${data.router.name} found`, data.router.name);
      } else {
        setDiagnostics(null);
      }
      if (data.connected) {
        toast.success("Router found!");
      } else {
        addLog("pending", "Still waiting for router to connect...");
        toast.info("Still waiting...");
      }
    } catch (e) {
      const msg = e.response?.data?.error || e.message;
      setLastError(`${msg} (HTTP ${e.response?.status || "network error"})`);
      addLog("error", msg);
    }
  };

  // SSE watch handles polling now
  // Manual check available via the Check Now button

  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    toast.success("API key copied");
  };

  const toggleRouterSelection = (routerId) => {
    const newSelected = new Set(selectedRouters);
    if (newSelected.has(routerId)) {
      newSelected.delete(routerId);
    } else {
      newSelected.add(routerId);
    }
    setSelectedRouters(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedRouters.size === allRouters.length) {
      setSelectedRouters(new Set());
    } else {
      setSelectedRouters(new Set(allRouters.map(r => r.id)));
    }
  };

  const addRouterToGroup = (routerId, groupId) => {
    const updated = routerGroups.map((g) => {
      if (g.id === groupId) {
        return {
          ...g,
          routerIds: Array.from(new Set([...(g.routerIds || []), routerId])),
        };
      }
      return g;
    });
    setRouterGroups(updated);
    localStorage.setItem("router_groups", JSON.stringify(updated));
    toast.success("Router added to group");
  };

  const removeRouterFromGroup = (routerId, groupId) => {
    const updated = routerGroups.map((g) => {
      if (g.id === groupId) {
        return {
          ...g,
          routerIds: (g.routerIds || []).filter((id) => id !== routerId),
        };
      }
      return g;
    });
    setRouterGroups(updated);
    localStorage.setItem("router_groups", JSON.stringify(updated));
  };

  const createGroup = () => {
    if (!newGroupName.trim()) {
      toast.error("Group name required");
      return;
    }
    const newGroup = {
      id: `group-${Date.now()}`,
      name: newGroupName,
      type: newGroupType,
      routerIds: Array.from(selectedRouters),
      createdAt: new Date().toISOString(),
    };
    const updated = [...routerGroups, newGroup];
    setRouterGroups(updated);
    localStorage.setItem("router_groups", JSON.stringify(updated));
    setNewGroupName("");
    setShowGroupForm(false);
    addLog("success", `Group created: ${newGroupName}`);
    toast.success(`Group ${newGroupName} created`);
  };

  const deleteGroup = (groupId) => {
    const updated = routerGroups.filter((g) => g.id !== groupId);
    setRouterGroups(updated);
    localStorage.setItem("router_groups", JSON.stringify(updated));
  };

  const backupRouterConfig = (routerId) => {
    const router = allRouters.find((r) => r.id === routerId);
    if (!router) return;

    const backup = {
      id: `backup-${Date.now()}`,
      routerId,
      routerName: router.name,
      routerModel: router.model,
      config: {
        ...router,
        backupTime: new Date().toISOString(),
      },
    };

    const updated = [backup, ...backups.slice(0, 19)];
    setBackups(updated);
    localStorage.setItem("router_backups", JSON.stringify(updated));
    addLog("success", `Backed up config from ${router.name}`);
    toast.success(`Backed up ${router.name}`);
  };

  const restoreRouterConfig = async (backupId, targetRouterId) => {
    const backup = backups.find((b) => b.id === backupId);
    const targetRouter = allRouters.find((r) => r.id === targetRouterId);

    if (!backup || !targetRouter) {
      toast.error("Backup or target router not found");
      return;
    }

    try {
      await axios.post(
        `${API}/router/v1/${tenantSlug}/routers/${targetRouterId}/restore-config`,
        { sourceConfig: backup.config },
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      addLog("success", `Restored config from ${backup.routerName} to ${targetRouter.name}`);
      toast.success(`Config restored to ${targetRouter.name}`);
    } catch (e) {
      toast.error("Restore failed: " + (e.response?.data?.error || e.message));
      addLog("error", `Restore failed: ${e.message}`);
    }
  };

  const deleteBackup = (backupId) => {
    const updated = backups.filter((b) => b.id !== backupId);
    setBackups(updated);
    localStorage.setItem("router_backups", JSON.stringify(updated));
  };

  const exportBackup = (backupId) => {
    const backup = backups.find((b) => b.id === backupId);
    if (!backup) return;

    const dataStr = JSON.stringify(backup, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `router-backup-${backup.routerName}-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const recordMetric = (routerId, type, value) => {
    setMetrics((prev) => {
      const updated = { ...prev };
      if (!updated[routerId]) {
        updated[routerId] = { uptime: [], latency: [], bandwidth: [] };
      }
      updated[routerId][type] = [
        { timestamp: Date.now(), value },
        ...updated[routerId][type].slice(0, 59),
      ];
      localStorage.setItem("router_metrics", JSON.stringify(updated));
      return updated;
    });
  };

  const getMetricAverage = (routerId, type) => {
    const data = metrics[routerId]?.[type] || [];
    if (data.length === 0) return 0;
    return (data.reduce((sum, m) => sum + m.value, 0) / data.length).toFixed(2);
  };

  const updateMetricsFromStatus = (status) => {
    if (status.router?.id) {
      // Simulate uptime percentage (100% if online, 0% if offline)
      recordMetric(status.router.id, "uptime", status.router.is_online ? 100 : 0);
      // Simulate latency
      recordMetric(status.router.id, "latency", Math.random() * 50 + 10);
      // Simulate bandwidth (in Mbps)
      recordMetric(status.router.id, "bandwidth", Math.random() * 100);
    }
  };

  const bulkApplyDiagnosticFix = async (stepId) => {
    if (selectedRouters.size === 0) {
      toast.error("Select routers first");
      return;
    }

    setBulkApplyingFix(stepId);
    let successCount = 0;
    let failureCount = 0;

    try {
      for (const routerId of selectedRouters) {
        try {
          const { data } = await axios.post(
            `${API}/router/v1/${tenantSlug}/routers/${routerId}/diagnostics/${stepId}/apply`,
            {},
            { headers: { Authorization: `Bearer ${apiKey}` } },
          );
          successCount++;
        } catch (e) {
          failureCount++;
        }
      }

      toast.success(`Applied to ${successCount} router(s)${failureCount > 0 ? `, failed on ${failureCount}` : ""}`);
      setSelectedRouters(new Set());
      fetchAllRouters();
      if (connectionStatus?.router?.id) {
        fetchDiagnostics(connectionStatus.router.id);
      }
    } catch (e) {
      toast.error("Bulk operation failed");
    } finally {
      setBulkApplyingFix(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  const isLinked = connectionStatus?.connected && connectionStatus?.router?.has_connection;
  const diagnosticSummary = diagnostics?.steps?.reduce(
    (summary, step) => {
      summary[step.status] = (summary[step.status] || 0) + 1;
      return summary;
    },
    { ok: 0, warning: 0, error: 0, pending: 0 },
  );
  const getDiagnosticClasses = (status) => {
    if (status === "ok") {
      return {
        icon: "text-green-400",
        bg: "bg-green-500/10",
        border: "border-green-500/30",
        label: "text-green-300",
      };
    }
    if (status === "error") {
      return {
        icon: "text-red-400",
        bg: "bg-red-500/10",
        border: "border-red-500/30",
        label: "text-red-300",
      };
    }
    if (status === "pending") {
      return {
        icon: "text-zinc-400",
        bg: "bg-zinc-800/50",
        border: "border-zinc-700/50",
        label: "text-zinc-300",
      };
    }
    return {
      icon: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      label: "text-amber-300",
    };
  };
  const autoFixableDiagnosticSteps = new Set([
    "api_service",
    "radius_client",
    "pppoe_server",
    "billing_sync",
  ]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Router className="w-6 h-6 text-blue-400" />
          Link MikroTik Router
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          One command to connect your MikroTik router to your billing system
        </p>
      </div>

      {/* Step 1: API Key */}
      <Card className="bg-zinc-900/60 border-zinc-800/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">1</span>
            Your API Key
          </CardTitle>
          <CardDescription>
            This key authenticates your router with the billing server
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiKey ? (
            <div className="flex items-center gap-3">
              <code className="flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-3 text-sm text-amber-400 font-mono break-all">
                {apiKey}
              </code>
              <Button
                variant="outline"
                onClick={copyApiKey}
                className="gap-2 border-zinc-700/50 text-zinc-300 shrink-0"
              >
                <Copy className="w-4 h-4" /> Copy
              </Button>
            </div>
          ) : (
            <p className="text-zinc-500 text-sm">
              No API key yet. Generate one to get started.
            </p>
          )}
          <div className="flex gap-2">
            <Button onClick={() => generateKey(false)} disabled={generating} className="gap-2 flex-1">
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Key className="w-4 h-4" />
              )}
              {apiKey ? "Regenerate API Key" : "Generate API Key"}
            </Button>
            {apiKey && (
              <Button
                variant="outline"
                onClick={() => setShowKeyRotation(true)}
                className="gap-2 border-zinc-700/50 text-zinc-300"
              >
                <Shield className="w-4 h-4" />
                Rotation
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Management Credentials */}
      {apiKey && (
        <Card className={`bg-zinc-900/60 border-zinc-800/50 ${showCredentials ? "" : "opacity-70"}`}>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold">2</span>
              Management Credentials
              {!showCredentials && (
                <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full ml-2">Recommended</span>
              )}
            </CardTitle>
            <CardDescription>
              {showCredentials
                ? "So the billing system can manage your router (sync PPPoE, push scripts, monitor)"
                : "Add credentials for full router management. The router will still link without them."}
            </CardDescription>
          </CardHeader>
          {showCredentials && (
            <CardContent className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-medium">Router Username</label>
                <input
                  type="text"
                  value={mgmtUser}
                  onChange={(e) => setMgmtUser(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-medium">Router Password</label>
                <input
                  type="password"
                  value={mgmtPass}
                  onChange={(e) => setMgmtPass(e.target.value)}
                  placeholder="Enter router admin password"
                  className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-medium">API Port</label>
                <input
                  type="text"
                  value={mgmtPort}
                  onChange={(e) => setMgmtPort(e.target.value)}
                  placeholder="8728"
                  className="w-24 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                <p className="text-xs text-zinc-500 mt-1">Default MikroTik API port is 8728</p>
              </div>
            </CardContent>
          )}
          {!showCredentials && (
            <CardContent>
              <Button
                variant="outline"
                onClick={() => setShowCredentials(true)}
                className="gap-2 border-zinc-700/50 text-zinc-300"
              >
                <Shield className="w-4 h-4" />
                Add Credentials (For Full Management)
              </Button>
            </CardContent>
          )}
        </Card>
      )}

      {/* Step 3: Installation Command */}
      {apiKey && (
        <Card className="bg-zinc-900/60 border-zinc-800/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold">3</span>
              Run on Your MikroTik
            </CardTitle>
            <CardDescription>
              Paste this single command into your MikroTik terminal (SSH or Winbox). It runs immediately.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                Server URL
              </label>
              <input
                type="text"
                value={appUrl}
                onChange={handleAppUrlChange}
                placeholder="https://your-server.com"
                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Your server URL. The MikroTik router must be able to reach this address.
              </p>
            </div>

            {mgmtUser && mgmtPass && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
                <Shield className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-300">
                  Management credentials included. The router will automatically be linked for full management when it reports in.
                </p>
              </div>
            )}

            {!mgmtPass && (
              <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                <p className="text-xs text-zinc-400">
                  No management credentials set. The router will link but you won't be able to sync PPPoE or push scripts until you{" "}
                  <button onClick={() => setShowCredentials(true)} className="text-blue-400 hover:underline">add credentials</button>.
                </p>
              </div>
            )}

            <pre className="bg-zinc-950 border border-zinc-700/50 rounded-lg p-4 text-sm text-green-400 font-mono overflow-x-auto whitespace-pre-wrap">
              {buildCommand()}
            </pre>
            <p className="text-xs text-zinc-500">
              Run Step 0 first if you set credentials above. Then run Steps 1-3 in order.
            </p>
            <Button onClick={copyCommand} className="gap-2 w-full">
              {copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {copied ? "Copied!" : "Copy to Clipboard"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Connection Status */}
      {apiKey && (
        <Card className="bg-zinc-900/60 border-zinc-800/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">4</span>
              Connection Status
            </CardTitle>
            <CardDescription>
              {isLinked
                ? "Router is fully linked and manageable"
                : connectionStatus?.connected
                  ? "Router is connected. Add credentials for full management."
                  : "Waiting for your router to report in..."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status indicator */}
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  isLinked && connectionStatus?.router?.is_online !== false
                    ? "bg-green-500 shadow-lg shadow-green-500/30"
                    : connectionStatus?.connected && connectionStatus?.router?.is_online !== false
                      ? "bg-green-500 animate-pulse"
                      : connectionStatus?.connected && connectionStatus?.router?.is_online === false
                        ? "bg-red-500"
                        : polling
                          ? "bg-amber-500 animate-pulse"
                          : "bg-zinc-600"
                }`}
              />
              <span className="text-sm text-zinc-300">
                {isLinked && connectionStatus?.router?.is_online !== false
                  ? "Online & Managed"
                  : connectionStatus?.connected && connectionStatus?.router?.is_online !== false
                    ? "Router Connected"
                    : connectionStatus?.connected && connectionStatus?.router?.is_online === false
                      ? "Router Offline"
                      : polling
                        ? "Listening..."
                        : "Not Monitoring"}
              </span>
            </div>

            {/* Connection details */}
            {connectionStatus?.router && (
              <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Router className="w-4 h-4 text-blue-400" />
                  <span className="text-white font-medium">{connectionStatus.router.name}</span>
                  <span className="text-zinc-500">({connectionStatus.router.model || "Unknown"})</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-400">
                  <span>MAC: {connectionStatus.router.mac}</span>
                  <span>IP: {connectionStatus.router.ip}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {connectionStatus.router.has_connection ? (
                    <span className="flex items-center gap-1 text-green-400">
                      <Check className="w-3 h-3" /> Fully managed (API connection active)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-400">
                      <AlertCircle className="w-3 h-3" /> Not yet manageable — credentials needed
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Diagnostics */}
            {connectionStatus?.router?.id && (
              <div className="border border-zinc-800/70 rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-white font-medium">Router Link Diagnostics</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {diagnostics
                        ? `${diagnosticSummary?.ok || 0} ok, ${diagnosticSummary?.warning || 0} warnings, ${diagnosticSummary?.error || 0} errors`
                        : "Run a read-only setup check against this router."}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => fetchDiagnostics()}
                    disabled={diagnosticsLoading}
                    className="gap-2 border-zinc-700/50 text-zinc-300 shrink-0"
                  >
                    {diagnosticsLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Shield className="w-4 h-4" />
                    )}
                    Check Setup
                  </Button>
                </div>

                {diagnostics?.steps?.length > 0 && (
                  <div className="space-y-2">
                    {diagnostics.steps.map((step) => {
                      const classes = getDiagnosticClasses(step.status);
                      const fixText = String(step.fix || "");
                      const fixIsCommand = fixText.trim().startsWith("/") || fixText.trim().startsWith(":");
                      const canApplyFix =
                        fixIsCommand &&
                        step.status !== "ok" &&
                        autoFixableDiagnosticSteps.has(step.id);
                      return (
                        <div
                          key={step.id}
                          className={`${classes.bg} ${classes.border} border rounded-lg p-3`}
                        >
                          <div className="flex items-start gap-3">
                            {step.status === "ok" ? (
                              <Check className={`w-4 h-4 mt-0.5 shrink-0 ${classes.icon}`} />
                            ) : step.status === "pending" ? (
                              <Loader2 className={`w-4 h-4 mt-0.5 shrink-0 ${classes.icon}`} />
                            ) : (
                              <AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${classes.icon}`} />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-3">
                                <p className={`text-sm font-medium ${classes.label}`}>{step.label}</p>
                                <span className="text-[10px] uppercase text-zinc-500">
                                  {step.status}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-400 mt-1">{step.message}</p>
                              {step.fix && (
                                <div className="mt-2 space-y-2">
                                  {fixIsCommand ? (
                                    <pre className="bg-zinc-950/80 border border-zinc-800 rounded-md p-2 text-xs text-green-300 font-mono overflow-x-auto whitespace-pre-wrap">
                                      {step.fix}
                                    </pre>
                                  ) : (
                                    <p className="text-xs text-zinc-300 bg-zinc-950/60 border border-zinc-800 rounded-md p-2">
                                      {step.fix}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap gap-2">
                                    {canApplyFix && (
                                      <Button
                                        onClick={() => applyDiagnosticFix(step.id)}
                                        disabled={applyingFix === step.id}
                                        className="h-8 gap-2"
                                      >
                                        {applyingFix === step.id ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <Shield className="w-3 h-3" />
                                        )}
                                        {applyingFix === step.id ? "Applying..." : "Apply Fix"}
                                      </Button>
                                    )}
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        navigator.clipboard.writeText(step.fix);
                                        toast.success(fixIsCommand ? "Command copied" : "Fix copied");
                                      }}
                                      className="h-8 gap-2 border-zinc-700/50 text-zinc-300"
                                    >
                                      <Copy className="w-3 h-3" />
                                      {fixIsCommand ? "Copy Command" : "Copy Fix"}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Last seen */}
            {connectionStatus?.lastSeen && (
              <p className="text-xs text-zinc-500">
                Last seen: {new Date(connectionStatus.lastSeen).toLocaleString()}
                {connectionStatus.ip ? ` from ${connectionStatus.ip}` : ""}
              </p>
            )}

            {/* Upgrade button for linked-but-not-managed routers */}
            {connectionStatus?.connected && !connectionStatus?.router?.has_connection && (
              <Card className="bg-amber-500/5 border-amber-500/30">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <Plug className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm text-amber-300 font-medium">Upgrade to Full Management</p>
                      <p className="text-xs text-amber-400/70 mt-1">
                        Your router is linked but not yet manageable. Add credentials to unlock PPPoE sync, script push, and monitoring.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="text"
                      value={mgmtUser}
                      onChange={(e) => setMgmtUser(e.target.value)}
                      placeholder="Router username (usually admin)"
                      className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={mgmtPass}
                        onChange={(e) => setMgmtPass(e.target.value)}
                        placeholder="Router admin password"
                        className="flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                      />
                      <input
                        type="text"
                        value={mgmtPort}
                        onChange={(e) => setMgmtPort(e.target.value)}
                        placeholder="8728"
                        className="w-20 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                      />
                    </div>
                    <Button
                      onClick={handleUpgrade}
                      disabled={isUpgrading || !mgmtUser || !mgmtPass}
                      className="gap-2 w-full bg-amber-500 hover:bg-amber-600 text-black"
                    >
                      {isUpgrading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Link2 className="w-4 h-4" />
                      )}
                      {isUpgrading ? "Upgrading..." : "Upgrade to Full Management"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Waiting / Watching state */}
            {polling && !connectionStatus?.connected && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-amber-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">
                    {connectionStatus?.status === "watching"
                      ? `Watching for router... (${watchAttempts} checks, ${Math.ceil((watchRemaining * 5) / 60)}m remaining)`
                      : `Listening... (${checkCount} checks)`}
                  </span>
                </div>
                <Button
                  variant="outline"
                  onClick={manualCheck}
                  className="gap-2 w-full border-zinc-700/50 text-zinc-300"
                >
                  Check Now
                </Button>
                {lastError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-400">{lastError}</p>
                  </div>
                )}
                {checkCount > 3 && (
                  <Card className="bg-amber-500/5 border-amber-500/30">
                    <CardContent className="p-3 space-y-2">
                      <p className="text-xs text-amber-300 font-medium">Still waiting?</p>
                      <p className="text-xs text-zinc-400">
                        Generate a fresh key and re-run the command on your MikroTik.
                      </p>
                      <Button onClick={generateKey} disabled={generating} className="gap-2 w-full">
                        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                        Generate New Key & Re-run
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* SSE Timeout state */}
            {connectionStatus?.status === "timeout" && (
              <Card className="bg-red-500/5 border-red-500/30">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm text-red-300 font-medium">Watch Session Ended</p>
                      <p className="text-xs text-red-400/70 mt-1">{connectionStatus.message}</p>
                    </div>
                  </div>
                  <Button onClick={() => { setPolling(true); startWatching(); }} className="gap-2 w-full">
                    Start New Watch Session
                  </Button>
                </CardContent>
              </Card>
            )}

            {connectionStatus?.connected && isLinked && (
              <div className="flex items-center gap-3 text-green-400">
                <Check className="w-5 h-5" />
                <span className="text-sm font-medium">
                  Router fully linked and managed! You can now sync PPPoE, push scripts, and monitor this router.
                </span>
              </div>
            )}

            {/* Debug info */}
            {debugInfo && (
              <details className="mt-3">
                <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400">Debug</summary>
                <pre className="mt-2 bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-400 font-mono overflow-x-auto">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </details>
            )}

            {/* Router Groups */}
            {apiKey && (
              <div className="border-t border-zinc-800/50 pt-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-zinc-500 font-medium">Router Groups</p>
                  <Button
                    onClick={() => setShowGroupForm(true)}
                    variant="outline"
                    className="h-7 gap-1 text-xs border-zinc-700/50"
                  >
                    <Plus className="w-3 h-3" />
                    New Group
                  </Button>
                </div>

                {showGroupForm && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-3 space-y-2">
                    <input
                      type="text"
                      placeholder="Group name (e.g., Downtown, Warehouse)"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    />
                    <select
                      value={newGroupType}
                      onChange={(e) => setNewGroupType(e.target.value)}
                      className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    >
                      <option value="location">Location</option>
                      <option value="type">Type</option>
                      <option value="region">Region</option>
                      <option value="custom">Custom</option>
                    </select>
                    <div className="flex gap-2">
                      <Button
                        onClick={createGroup}
                        className="flex-1 h-7 gap-1 text-xs"
                      >
                        Create Group
                      </Button>
                      <Button
                        onClick={() => setShowGroupForm(false)}
                        variant="outline"
                        className="flex-1 h-7 text-xs border-zinc-700/50"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {routerGroups.length === 0 ? (
                    <p className="text-xs text-zinc-500">No groups yet. Create one to organize routers.</p>
                  ) : (
                    routerGroups.map((group) => (
                      <div key={group.id} className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm text-white font-medium">{group.name}</p>
                            <p className="text-xs text-zinc-500">
                              {group.routerIds?.length || 0} router(s) • {group.type}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              onClick={() => {
                                setSelectedRouters(new Set(group.routerIds || []));
                                setSelectedGroup(group.id);
                              }}
                              variant="outline"
                              className="h-7 gap-1 text-xs border-zinc-700/50"
                            >
                              Select
                            </Button>
                            <Button
                              onClick={() => deleteGroup(group.id)}
                              variant="outline"
                              className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Backups Panel */}
            {backups.length > 0 && (
              <div className="border-t border-zinc-800/50 pt-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-zinc-500 font-medium">Configuration Backups ({backups.length})</p>
                  <button
                    onClick={() => setShowBackupPanel(!showBackupPanel)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    {showBackupPanel ? "Hide" : "Show"}
                  </button>
                </div>

                {showBackupPanel && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {backups.map((backup) => (
                      <div key={backup.id} className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="text-sm text-white font-medium">{backup.routerName}</p>
                            <p className="text-xs text-zinc-500">
                              {backup.routerModel} • {new Date(backup.config.backupTime).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                restoreRouterConfig(backup.id, e.target.value);
                                e.target.value = "";
                              }
                            }}
                            className="flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                            defaultValue=""
                          >
                            <option value="">Restore to...</option>
                            {allRouters.filter((r) => r.id !== backup.routerId).map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => exportBackup(backup.id)}
                            className="px-2 py-1 text-xs bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/50 rounded text-zinc-300"
                            title="Download backup"
                          >
                            ⬇
                          </button>
                          <button
                            onClick={() => deleteBackup(backup.id)}
                            className="px-2 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded text-red-400"
                            title="Delete backup"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Connection Logs */}
            {connectionLogs.length > 0 && (
              <div className="border-t border-zinc-800/50 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-zinc-500 font-medium">Connection Logs</p>
                  <button
                    onClick={() => setConnectionLogs([])}
                    className="text-xs text-zinc-400 hover:text-zinc-300"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {connectionLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`text-xs px-2 py-1 rounded font-mono ${
                        log.type === "success"
                          ? "bg-green-500/10 text-green-300"
                          : log.type === "error"
                            ? "bg-red-500/10 text-red-300"
                            : log.type === "warning"
                              ? "bg-amber-500/10 text-amber-300"
                              : "bg-zinc-800/30 text-zinc-400"
                      }`}
                    >
                      <span className="text-zinc-500">[{log.timestamp}]</span>{" "}
                      <span className="font-medium">{log.routerName}:</span> {log.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Routers for this tenant */}
            {allRouters.length > 0 && (
              <div className="mt-4 pt-4 border-t border-zinc-800/50">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-zinc-500 font-medium">ALL ROUTERS ({allRouters.length})</p>
                  {selectedRouters.size > 0 && (
                    <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
                      {selectedRouters.size} selected
                    </span>
                  )}
                </div>

                {apiKey && (
                  <Button
                    onClick={() => setShowTopology(true)}
                    variant="outline"
                    className="h-8 gap-2 border-zinc-700/50 text-zinc-300 mb-3 w-full"
                  >
                    🗺️ View Network Topology
                  </Button>
                )}

                {selectedRouters.size > 0 && (
                  <div className="mb-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-blue-300 font-medium">Bulk Actions</span>
                      <button
                        onClick={() => setSelectedRouters(new Set())}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Clear
                      </button>
                    </div>
                    <Button
                      onClick={() => setShowTemplates(true)}
                      disabled={applyingTemplate}
                      className="h-8 gap-2 w-full text-xs"
                    >
                      <Terminal className="w-3 h-3" />
                      Apply Configuration Template
                    </Button>
                    {diagnostics?.steps?.map((step) => (
                      step.status !== "ok" && (
                        <Button
                          key={step.id}
                          onClick={() => bulkApplyDiagnosticFix(step.id)}
                          disabled={bulkApplyingFix === step.id}
                          className="h-8 gap-2 w-full text-xs"
                        >
                          {bulkApplyingFix === step.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Shield className="w-3 h-3" />
                          )}
                          Apply {step.label} to {selectedRouters.size} router(s)
                        </Button>
                      )
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-2 py-1 text-xs">
                    <input
                      type="checkbox"
                      checked={selectedRouters.size === allRouters.length && allRouters.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 cursor-pointer"
                    />
                    <span className="text-zinc-400">Select All</span>
                  </div>
                  {allRouters.map((r) => (
                    <div key={r.id} className={`bg-zinc-800/30 border rounded-lg p-3 flex items-center justify-between transition ${selectedRouters.has(r.id) ? "border-blue-500/50 bg-blue-500/10" : "border-zinc-700/50"}`}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedRouters.has(r.id)}
                          onChange={() => toggleRouterSelection(r.id)}
                          className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 cursor-pointer shrink-0"
                        />
                        <div className="flex items-center gap-2 text-xs min-w-0 flex-1">
                          <div className={`w-2 h-2 rounded-full ${r.is_online ? 'bg-green-500' : r.provision_status === 'online' ? 'bg-amber-500' : 'bg-zinc-500'}`} shrink-0 />
                          <span className="text-white truncate">{r.name}</span>
                          <span className="text-zinc-500">{r.model || ""}</span>
                          <span className={`text-xs ${r.is_online ? 'text-green-400' : 'text-red-400'}`}>
                            {r.is_online ? 'ONLINE' : r.provision_status === 'online' ? 'OFFLINE' : r.provision_status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => backupRouterConfig(r.id)}
                          className="p-1 hover:bg-zinc-700/50 rounded text-xs text-zinc-400 hover:text-zinc-300"
                          title="Backup config"
                        >
                          💾
                        </button>
                        <div className="text-xs text-zinc-500">
                          <span>{r.mac_address || "no MAC"}</span>
                          <span className="mx-2">|</span>
                          <span>{r.ip_address || "no IP"}</span>
                          <span className="mx-2">|</span>
                          <span className={r.linked_mikrotik_connection_id ? "text-green-400" : "text-amber-400"}>
                            {r.linked_mikrotik_connection_id ? "managed" : "unmanaged"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {allRouters.length === 0 && checkCount > 1 && (
              <p className="text-xs text-zinc-600 text-center py-2">
                No routers found in database for this tenant.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Network Topology Modal */}
      {showTopology && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-4xl w-full mx-4 max-h-96 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h2 className="text-white font-medium">Network Topology</h2>
              <button
                onClick={() => setShowTopology(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {allRouters.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-8">No routers connected yet</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Central server */}
                  <div className="flex justify-center mb-4">
                    <div className="bg-blue-500/20 border-2 border-blue-500 rounded-lg px-4 py-2 text-center">
                      <p className="text-white font-medium text-sm">Billing Server</p>
                      <p className="text-xs text-zinc-400">{appUrl}</p>
                    </div>
                  </div>

                  {/* Connection lines and routers */}
                  <div className="space-y-3">
                    {allRouters.map((router) => (
                      <div key={router.id} className="flex items-center gap-4">
                        <div className="flex-1 h-px bg-gradient-to-r from-zinc-700/50 to-transparent" />
                        <div
                          className={`px-4 py-2 rounded-lg border flex-shrink-0 text-center min-w-40 ${
                            router.is_online
                              ? "bg-green-500/20 border-green-500 text-green-300"
                              : "bg-zinc-800/50 border-zinc-700/50 text-zinc-400"
                          }`}
                        >
                          <p className="text-white font-medium text-sm">{router.name}</p>
                          <p className="text-xs">
                            {router.ip_address || "No IP"}
                          </p>
                          <p className={`text-xs ${router.is_online ? "text-green-400" : "text-red-400"}`}>
                            {router.is_online ? "● Online" : "● Offline"}
                          </p>
                        </div>
                        <div className="flex-1 h-px bg-gradient-to-l from-zinc-700/50 to-transparent" />
                      </div>
                    ))}
                  </div>

                  {/* Statistics */}
                  <div className="border-t border-zinc-800 pt-4 mt-4 grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl text-white font-bold">{allRouters.length}</p>
                      <p className="text-xs text-zinc-500">Total Routers</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl text-green-400 font-bold">
                        {allRouters.filter((r) => r.is_online).length}
                      </p>
                      <p className="text-xs text-zinc-500">Online</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl text-amber-400 font-bold">
                        {allRouters.filter((r) => !r.is_online).length}
                      </p>
                      <p className="text-xs text-zinc-500">Offline</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Key Rotation Modal */}
      {showKeyRotation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="bg-zinc-900 border-zinc-800 max-w-md w-full mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">API Key Rotation</CardTitle>
                <button
                  onClick={() => setShowKeyRotation(false)}
                  className="text-zinc-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-2 font-medium">Rotate every (days)</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={keyRotationSchedule}
                  onChange={(e) => {
                    setKeyRotationSchedule(e.target.value);
                    localStorage.setItem("key_rotation_days", e.target.value);
                  }}
                  className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                <p className="text-xs text-zinc-500 mt-1">Recommended: 90 days</p>
              </div>

              <Button
                onClick={() => {
                  generateKey(true);
                  setShowKeyRotation(false);
                }}
                disabled={generating}
                className="gap-2 w-full"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Key className="w-4 h-4" />
                )}
                Rotate Key Now
              </Button>

              {keyHistory.length > 0 && (
                <div className="pt-4 border-t border-zinc-700/50">
                  <p className="text-xs text-zinc-400 font-medium mb-2">Key History</p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {keyHistory.map((entry, idx) => (
                      <div key={idx} className="bg-zinc-800/30 border border-zinc-700/50 rounded p-2">
                        <div className="text-xs text-zinc-300 font-mono break-all mb-1">
                          {entry.key}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {new Date(entry.createdAt).toLocaleDateString()}{" "}
                          {entry.rotated && <span className="text-amber-400">(rotated)</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Templates Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="bg-zinc-900 border-zinc-800 max-w-2xl w-full mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Configuration Templates</CardTitle>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="text-zinc-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <CardDescription>
                Apply pre-built configurations to {selectedRouters.size} router(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-96 overflow-y-auto">
              {configTemplates.map((template) => (
                <div
                  key={template.id}
                  className="border border-zinc-700/50 rounded-lg p-4 bg-zinc-800/30 hover:bg-zinc-800/50 transition"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{template.name}</p>
                      <p className="text-xs text-zinc-400 mt-1">{template.description}</p>
                    </div>
                    <Button
                      onClick={() => applyTemplate(template)}
                      disabled={applyingTemplate === template.id}
                      className="h-8 gap-2 whitespace-nowrap"
                    >
                      {applyingTemplate === template.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Check className="w-3 h-3" />
                      )}
                      Apply
                    </Button>
                  </div>
                  <div className="text-xs text-zinc-500">
                    <p className="font-medium mb-1">Commands to run:</p>
                    <ul className="space-y-1">
                      {template.commands.map((cmd, idx) => (
                        <li key={idx} className="text-zinc-400 break-all">
                          • {cmd}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* What This Does */}
      {apiKey && (
        <Card className="bg-zinc-900/60 border-zinc-800/50">
          <CardHeader>
            <CardTitle className="text-white">
              What this configures on your router
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">&#10003;</span>
                RADIUS client pointing to your billing server for PPPoE/Hotspot auth
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">&#10003;</span>
                PPPoE server on bridge1 with RADIUS authentication
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">&#10003;</span>
                Hotspot server with RADIUS profile
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">&#10003;</span>
                Firewall rule allowing billing API access
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">&#10003;</span>
                Auto-sync scheduler every 5 minutes
              </li>
              {mgmtUser && mgmtPass && (
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">&#10003;</span>
                  API connection created automatically for full management (PPPoE sync, script push, monitoring)
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
