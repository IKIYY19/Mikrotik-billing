import { useState, useEffect } from "react";
import axios from "axios";
import {
  Eye, Save, Download, Upload, RefreshCw, Check, Copy, Globe,
  Wifi, Coffee, Zap, ShoppingBag, Hotel, Building2, Plane,
  Smartphone, Monitor, Palette, Image, Settings, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useToast } from "../../hooks/useToast";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

const API = import.meta.env.VITE_API_URL || "/api";

const HOTSPOT_TEMPLATES = [
  {
    id: "cafe",
    name: "Café & Restaurant",
    icon: Coffee,
    description: "Warm, inviting design for coffee shops and restaurants",
    colors: { bg: "#1a0e0a", accent: "#d4a574", card: "rgba(30,15,10,0.9)", text: "#f5e6d3" },
    preview: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=300&fit=crop",
  },
  {
    id: "hotel",
    name: "Hotel & Resort",
    icon: Hotel,
    description: "Elegant, premium feel for hotels and resorts",
    colors: { bg: "#0f1729", accent: "#4f8fc9", card: "rgba(15,23,41,0.92)", text: "#e8eef5" },
    preview: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=300&fit=crop",
  },
  {
    id: "modern",
    name: "Modern ISP",
    icon: Wifi,
    description: "Clean, modern design for internet service providers",
    colors: { bg: "#0a0a0f", accent: "#3b82f6", card: "rgba(15,15,20,0.9)", text: "#f1f5f9" },
    preview: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=300&fit=crop",
  },
  {
    id: "retail",
    name: "Retail & Mall",
    icon: ShoppingBag,
    description: "Bold, eye-catching design for retail spaces and malls",
    colors: { bg: "#1a0a2e", accent: "#a855f7", card: "rgba(26,10,46,0.9)", text: "#f3e8ff" },
    preview: "https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=400&h=300&fit=crop",
  },
  {
    id: "corporate",
    name: "Corporate Office",
    icon: Building2,
    description: "Professional, clean design for offices and corporate spaces",
    colors: { bg: "#0f1117", accent: "#06b6d4", card: "rgba(15,17,23,0.95)", text: "#e2e8f0" },
    preview: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop",
  },
  {
    id: "airport",
    name: "Airport & Transport",
    icon: Plane,
    description: "High-contrast, readable design for busy terminals",
    colors: { bg: "#1c1917", accent: "#f59e0b", card: "rgba(28,25,23,0.93)", text: "#fef3c7" },
    preview: "https://images.unsplash.com/photo-1436491865332-7a61a109bb05?w=400&h=300&fit=crop",
  },
];

function generatePortalHTML({ templateId, companyName, welcomeText, logoUrl, primaryColor, phoneNumber, showTerms, packages }) {
  const tpl = HOTSPOT_TEMPLATES.find(t => t.id === templateId) || HOTSPOT_TEMPLATES[2];
  const { bg, accent, card, text } = tpl.colors;
  const accent2 = primaryColor || accent;
  const company = companyName || "My WiFi";
  const welcome = welcomeText || "Welcome to our HotSpot";
  const pkgList = (packages && packages.length > 0) ? packages : [
    { name: "1 Hour", price: "50", duration: "1h" },
    { name: "1 Day", price: "100", duration: "1d" },
    { name: "1 Week", price: "500", duration: "7d" },
  ];
  const hasPackages = pkgList.length > 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${company} — WiFi Login</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: ${bg};
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
    }
    .container { width: 100%; max-width: 400px; }
    .logo { text-align: center; margin-bottom: 24px; }
    .logo img { max-width: 120px; max-height: 50px; }
    .logo-text { font-size: 28px; font-weight: 700; color: ${text}; margin-top: 8px; }
    .welcome { text-align: center; color: ${text}; opacity: 0.7; font-size: 15px; margin-bottom: 24px; }
    .card {
      background: ${card};
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      padding: 32px 24px;
    }
    .packages {
      display: grid; grid-template-columns: repeat(${Math.min(pkgList.length, 3)}, 1fr);
      gap: 8px; margin-bottom: 20px;
    }
    .pkg-card {
      background: rgba(255,255,255,0.03);
      border: 2px solid rgba(255,255,255,0.06);
      border-radius: 12px; padding: 12px 8px;
      text-align: center; cursor: pointer;
      transition: all 0.2s;
    }
    .pkg-card:hover { border-color: ${accent2}55; background: rgba(255,255,255,0.06); }
    .pkg-card.selected { border-color: ${accent2}; background: ${accent2}18; }
    .pkg-name { font-size: 13px; font-weight: 600; color: ${text}; margin-bottom: 4px; }
    .pkg-price { font-size: 18px; font-weight: 700; color: ${accent2}; }
    .pkg-price span { font-size: 11px; font-weight: 400; opacity: 0.7; }
    .pkg-divider {
      grid-column: 1 / -1; height: 1px;
      background: rgba(255,255,255,0.06); margin: 4px 0;
    }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; color: ${text}; font-size: 13px; font-weight: 500; margin-bottom: 6px; opacity: 0.8; }
    .form-group input {
      width: 100%; padding: 14px 16px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px; color: ${text}; font-size: 15px;
      outline: none; transition: border-color 0.2s;
    }
    .form-group input:focus { border-color: ${accent2}; }
    .form-group input::placeholder { color: ${text}; opacity: 0.3; }
    .btn-connect {
      width: 100%; padding: 16px;
      background: ${accent2};
      color: ${bg}; border: none; border-radius: 12px;
      font-size: 16px; font-weight: 600;
      cursor: pointer; margin-top: 8px;
      transition: opacity 0.2s, transform 0.1s;
    }
    .btn-connect:hover { opacity: 0.9; }
    .btn-connect:active { transform: scale(0.98); }
    .btn-connect:disabled { opacity: 0.5; cursor: not-allowed; }
    .terms { text-align: center; margin-top: 16px; }
    .terms label { color: ${text}; opacity: 0.6; font-size: 12px; cursor: pointer; }
    .terms input { margin-right: 6px; accent-color: ${accent2}; }
    .footer { text-align: center; margin-top: 24px; color: ${text}; opacity: 0.4; font-size: 12px; }
    .footer a { color: ${accent2}; text-decoration: none; }
    .status { text-align: center; margin-top: 12px; font-size: 13px; color: #ef4444; display: none; }
    .status.show { display: block; }
    .selected-pkg { text-align: center; margin-bottom: 12px; font-size: 12px; color: ${text}; opacity: 0.6; }
    @media (max-width: 480px) {
      .card { padding: 24px 16px; }
      .logo-text { font-size: 24px; }
    }
  </style>
  <script src="/md5.js"></script>
  <script>
    var selectedPackage = null;
    function selectPackage(el, name, price) {
      document.querySelectorAll('.pkg-card').forEach(function(c) { c.classList.remove('selected'); });
      el.classList.add('selected');
      selectedPackage = { name: name, price: price };
      var label = document.getElementById('sel-pkg-label');
      if (label) { label.textContent = 'Selected: ' + name + ' — KES ' + price; label.style.display = 'block'; }
    }
    function doLogin() {
      const u = document.getElementById('username').value;
      const p = document.getElementById('password').value;
      if (!u || !p) return;
      ${showTerms ? `
      const terms = document.getElementById('terms');
      if (terms && !terms.checked) {
        document.getElementById('status').textContent = 'Please accept the terms to continue';
        document.getElementById('status').classList.add('show');
        return;
      }
      ` : ''}
      document.getElementById('status').classList.remove('show');
      document.getElementById('connect').disabled = true;
      document.getElementById('connect').textContent = 'Connecting...';
      const chal = '${Math.random().toString(36).substring(2, 10)}';
      const pass = hexMD5('\\0' + p + chal);
      var url = 'http://' + location.hostname + '/login?username=' + encodeURIComponent(u) + '&password=' + encodeURIComponent(pass) + '&dst=' + encodeURIComponent(location.href);
      if (selectedPackage) {
        url += '&mac-format=1&mac-cookie-timeout=' + encodeURIComponent(selectedPackage.name) + '&comment=' + encodeURIComponent(selectedPackage.name + '|' + selectedPackage.price);
      }
      const req = new XMLHttpRequest();
      req.open('GET', url, true);
      req.onload = function() {
        if (req.status === 200) {
          document.getElementById('status').style.color = '#10b981';
          document.getElementById('status').textContent = 'Connected! Redirecting...';
          document.getElementById('status').classList.add('show');
          setTimeout(function() { location.href = '${window.location.origin || "https://google.com"}'; }, 1500);
        } else {
          document.getElementById('connect').disabled = false;
          document.getElementById('connect').textContent = 'Connect';
          document.getElementById('status').textContent = 'Login failed. Check your credentials.';
          document.getElementById('status').classList.add('show');
        }
      };
      req.send();
    }
  </script>
</head>
<body>
  <div class="container">
    <div class="logo">
      ${logoUrl ? `<img src="${logoUrl}" alt="${company}" />` : ''}
      <div class="logo-text">${company}</div>
    </div>
    <p class="welcome">${welcome}</p>
    <div class="card">
      ${hasPackages ? `
      <div class="packages">
        ${pkgList.map((pkg, i) => `
        <div class="pkg-card${i === 0 ? ' selected' : ''}" onclick="selectPackage(this, '${pkg.name}', '${pkg.price}')">
          <div class="pkg-name">${pkg.name}</div>
          <div class="pkg-price">KES ${pkg.price}<span>/${pkg.duration || ''}</span></div>
        </div>
        `).join('')}
      </div>
      <p id="sel-pkg-label" class="selected-pkg" style="display:block">Selected: ${pkgList[0].name} — KES ${pkgList[0].price}</p>
      ` : ''}
      <form onsubmit="event.preventDefault(); doLogin();">
        <div class="form-group">
          <label>Phone Number or Username</label>
          <input id="username" type="text" placeholder="07XX XXX XXX" autocomplete="off" />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input id="password" type="password" placeholder="Enter password" />
        </div>
        <button type="submit" id="connect" class="btn-connect">Connect to WiFi</button>
      </form>
      ${showTerms ? `
      <div class="terms">
        <label><input type="checkbox" id="terms" /> I accept the terms of service</label>
      </div>` : ''}
      <div id="status" class="status"></div>
    </div>
    <div class="footer">
      Powered by <strong>${company}</strong>${phoneNumber ? ` &middot; 📞 ${phoneNumber}` : ''}
    </div>
  </div>
</body>
</html>`;
}

export default function CaptivePortalBuilder() {
  const toast = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState("modern");
  const [companyName, setCompanyName] = useState(() => localStorage.getItem("portal_company") || "");
  const [welcomeText, setWelcomeText] = useState(() => localStorage.getItem("portal_welcome") || "");
  const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem("portal_logo") || "");
  const [primaryColor, setPrimaryColor] = useState(() => localStorage.getItem("portal_color") || "");
  const [phoneNumber, setPhoneNumber] = useState(() => localStorage.getItem("portal_phone") || "");
  const [showTerms, setShowTerms] = useState(true);
  const [previewMode, setPreviewMode] = useState("desktop");
  const [connections, setConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState("");
  const [pushing, setPushing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedPortals, setSavedPortals] = useState([]);
  const [packages, setPackages] = useState(() => {
    try { return JSON.parse(localStorage.getItem("portal_packages") || "null") || [
      { name: "1 Hour", price: "50", duration: "1h" },
      { name: "1 Day", price: "100", duration: "1d" },
      { name: "1 Week", price: "500", duration: "7d" },
    ]; } catch(e) { return []; }
  });

  useEffect(() => {
    axios.get(`${API}/mikrotik`).then(r => setConnections(r.data)).catch(() => {});
    axios.get(`${API}/resellers/captive-portals`).then(r => setSavedPortals(r.data)).catch(() => {});
  }, []);

  const saveSetting = (key, value) => {
    localStorage.setItem(key, value);
  };

  const getHtml = () => generatePortalHTML({
    templateId: selectedTemplate,
    companyName, welcomeText, logoUrl, primaryColor, phoneNumber, showTerms, packages,
  });

  const handlePush = async () => {
    if (!selectedConnection) { toast.error("Select a router connection"); return; }
    setPushing(true);
    try {
      await axios.post(`${API}/resellers/captive-portals/push`, {
        connection_id: selectedConnection,
        html: getHtml(),
        profile: "default",
        portal_name: companyName || "hotspot-portal",
      });
      toast.success("Hotspot portal pushed to router");
    } catch (e) {
      toast.error("Failed to push portal");
    } finally { setPushing(false); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getHtml());
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    toast.success("HTML copied to clipboard");
  };

  const handleSavePortal = async () => {
    try {
      await axios.post(`${API}/resellers/captive-portals`, {
        name: companyName || "Untitled Portal",
        elements: [],
        styles: { bgColor: HOTSPOT_TEMPLATES.find(t => t.id === selectedTemplate)?.colors.bg, accentColor: primaryColor },
        html: getHtml(),
      });
      toast.success("Portal saved");
      const { data } = await axios.get(`${API}/resellers/captive-portals`);
      setSavedPortals(data);
    } catch (e) { toast.error("Save failed"); }
  };

  const currentTemplate = HOTSPOT_TEMPLATES.find(t => t.id === selectedTemplate);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Wifi className="w-5 h-5 text-white" />
            </div>
            Hotspot Portal Builder
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Pick a template, customize, push to router — done</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy HTML"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleSavePortal} className="gap-1">
            <Save className="w-3.5 h-3.5" /> Save
          </Button>
          <Button onClick={handlePush} disabled={pushing || !selectedConnection} size="sm" className="gap-1 bg-amber-600 hover:bg-amber-500">
            {pushing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Push to Router
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Panel — Templates + Config */}
        <div className="lg:col-span-2 space-y-6">
          {/* Templates */}
          <Card className="surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Palette className="w-4 h-4 text-amber-400" /> Templates
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {HOTSPOT_TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl.id)}
                  className={`p-3 rounded-xl text-left transition-all border ${
                    selectedTemplate === tpl.id
                      ? "border-amber-500/50 bg-amber-500/5"
                      : "border-zinc-800/50 hover:border-zinc-700/50"
                  }`}
                >
                  <tpl.icon className={`w-5 h-5 mb-1.5 ${selectedTemplate === tpl.id ? "text-amber-400" : "text-zinc-500"}`} />
                  <p className="text-xs font-medium text-white">{tpl.name}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Customization */}
          <Card className="surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Settings className="w-4 h-4 text-zinc-400" /> Customize
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Company / Brand Name</Label>
                <Input value={companyName} onChange={e => { setCompanyName(e.target.value); saveSetting("portal_company", e.target.value); }} placeholder="My WiFi Hotspot" />
              </div>
              <div>
                <Label>Welcome Message</Label>
                <Input value={welcomeText} onChange={e => { setWelcomeText(e.target.value); saveSetting("portal_welcome", e.target.value); }} placeholder="Welcome to our free WiFi" />
              </div>
              <div>
                <Label>Logo URL (optional)</Label>
                <Input value={logoUrl} onChange={e => { setLogoUrl(e.target.value); saveSetting("portal_logo", e.target.value); }} placeholder="https://yourcompany.com/logo.png" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label>Accent Color</Label>
                  <input
                    type="color"
                    value={primaryColor || currentTemplate?.colors.accent || "#3b82f6"}
                    onChange={e => { setPrimaryColor(e.target.value); saveSetting("portal_color", e.target.value); }}
                    className="w-full h-10 rounded-lg border border-zinc-700/50 cursor-pointer bg-transparent"
                  />
                </div>
                <div className="flex-1">
                  <Label>Support Phone</Label>
                  <Input value={phoneNumber} onChange={e => { setPhoneNumber(e.target.value); saveSetting("portal_phone", e.target.value); }} placeholder="0712 345 678" />
                </div>
              </div>
              <div className="border-t border-zinc-800/50 pt-4">
                <Label className="text-sm font-medium text-white mb-3 block">Hotspot Packages</Label>
                <p className="text-xs text-zinc-500 mb-3">Pricing plans shown before login. First package pre-selected.</p>
                {packages.map((pkg, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2 mb-2">
                    <Input value={pkg.name} onChange={e => {
                      const next = [...packages]; next[i].name = e.target.value;
                      setPackages(next); localStorage.setItem("portal_packages", JSON.stringify(next));
                    }} placeholder="e.g. 1 Hour" className="text-xs" />
                    <Input value={pkg.price} onChange={e => {
                      const next = [...packages]; next[i].price = e.target.value;
                      setPackages(next); localStorage.setItem("portal_packages", JSON.stringify(next));
                    }} placeholder="KES" className="text-xs" type="number" />
                    <Input value={pkg.duration} onChange={e => {
                      const next = [...packages]; next[i].duration = e.target.value;
                      setPackages(next); localStorage.setItem("portal_packages", JSON.stringify(next));
                    }} placeholder="e.g. 1h" className="text-xs" />
                  </div>
                ))}
                <div className="flex gap-2 mt-1">
                  {packages.length < 4 && (
                    <Button variant="outline" size="sm" onClick={() => {
                      const next = [...packages, { name: "", price: "", duration: "" }];
                      setPackages(next); localStorage.setItem("portal_packages", JSON.stringify(next));
                    }} className="text-xs">+ Add Package</Button>
                  )}
                  {packages.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => {
                      const next = packages.slice(0, -1);
                      setPackages(next); localStorage.setItem("portal_packages", JSON.stringify(next));
                    }} className="text-xs text-red-400">Remove Last</Button>
                  )}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-400 mt-3">
                <input type="checkbox" checked={showTerms} onChange={e => setShowTerms(e.target.checked)} className="rounded" />
                Show terms checkbox
              </label>
            </CardContent>
          </Card>

          {/* Push */}
          {connections.length > 0 && (
            <Card className="surface-card">
              <CardContent className="p-4">
                <Label>Push to Router</Label>
                <select
                  value={selectedConnection}
                  onChange={e => setSelectedConnection(e.target.value)}
                  className="w-full mt-1 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="">Select router...</option>
                  {connections.map(c => (<option key={c.id} value={c.id}>{c.name} ({c.ip_address})</option>))}
                </select>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right — Live Preview */}
        <div className="lg:col-span-3">
          <Card className="surface-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Eye className="w-4 h-4 text-green-400" /> Live Preview
                </CardTitle>
                <div className="flex gap-1 bg-zinc-800/50 rounded-lg p-0.5">
                  <button onClick={() => setPreviewMode("mobile")} className={`px-3 py-1.5 rounded-md text-xs ${previewMode === "mobile" ? "bg-zinc-700 text-white" : "text-zinc-500"}`}>
                    <Smartphone className="w-3.5 h-3.5 inline mr-1" />Mobile
                  </button>
                  <button onClick={() => setPreviewMode("desktop")} className={`px-3 py-1.5 rounded-md text-xs ${previewMode === "desktop" ? "bg-zinc-700 text-white" : "text-zinc-500"}`}>
                    <Monitor className="w-3.5 h-3.5 inline mr-1" />Desktop
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className={`bg-zinc-950 rounded-b-xl overflow-hidden ${previewMode === "mobile" ? "w-[375px] mx-auto" : "w-full"}`} style={{ height: previewMode === "mobile" ? "700px" : "600px" }}>
                <iframe
                  srcDoc={getHtml()}
                  className="w-full h-full border-0"
                  title="Portal Preview"
                  sandbox="allow-scripts allow-forms"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Saved Portals */}
      {savedPortals.length > 0 && (
        <Card className="surface-card mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-base">Saved Portals ({savedPortals.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {savedPortals.map(p => (
                <div key={p.id} className="shrink-0 w-48 p-3 rounded-lg bg-zinc-800/30 border border-zinc-800/50">
                  <p className="text-sm font-medium text-white truncate">{p.name}</p>
                  <p className="text-xs text-zinc-500 mt-1">{new Date(p.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
