import { useState, useEffect } from "react";
import axios from "axios";
import {
  Eye, Save, Download, Upload, RefreshCw, Check, Copy, Globe,
  Wifi, Coffee, Zap, ShoppingBag, Hotel, Building2, Plane,
  Smartphone, Monitor, Palette, Image, Settings, ChevronLeft, ChevronRight,
  Sun, Moon, Cloud, Heart, Sparkles, Waves, Flame, Leaf, Stars,
} from "lucide-react";
import { useToast } from "../../hooks/useToast";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

const API = import.meta.env.VITE_API_URL || "/api";

const HOTSPOT_TEMPLATES = [
  {
    id: "neon",
    name: "Neon Night",
    icon: Zap,
    description: "Electric cyberpunk with glowing neon accents",
    colors: { bg: "#0a0a14", bg2: "#111122", accent: "#00ff88", card: "rgba(13,13,28,0.9)", text: "#e0ffe0", border: "rgba(0,255,136,0.15)", inputBg: "rgba(0,255,136,0.05)", glow: "0 0 30px rgba(0,255,136,0.15)" },
  },
  {
    id: "sunset",
    name: "Sunset Bliss",
    icon: Sun,
    description: "Warm golden hour gradients with dreamy vibes",
    colors: { bg: "#1a0f0a", bg2: "#2d1810", accent: "#ff8c42", card: "rgba(26,15,10,0.92)", text: "#ffe8d5", border: "rgba(255,140,66,0.15)", inputBg: "rgba(255,140,66,0.05)", glow: "0 0 30px rgba(255,140,66,0.12)" },
  },
  {
    id: "ocean",
    name: "Deep Ocean",
    icon: Waves,
    description: "Serene underwater blues with wave-like gradients",
    colors: { bg: "#061224", bg2: "#0a1a38", accent: "#38bdf8", card: "rgba(6,18,36,0.9)", text: "#e0f2fe", border: "rgba(56,189,248,0.12)", inputBg: "rgba(56,189,248,0.04)", glow: "0 0 40px rgba(56,189,248,0.1)" },
  },
  {
    id: "forest",
    name: "Enchanted Forest",
    icon: Leaf,
    description: "Mystical emerald greens with natural warmth",
    colors: { bg: "#0a1410", bg2: "#121e16", accent: "#4ade80", card: "rgba(10,20,16,0.92)", text: "#dcfce7", border: "rgba(74,222,128,0.12)", inputBg: "rgba(74,222,128,0.05)", glow: "0 0 30px rgba(74,222,128,0.1)" },
  },
  {
    id: "midnight",
    name: "Midnight Luxe",
    icon: Moon,
    description: "Sophisticated dark luxury with gold highlights",
    colors: { bg: "#0c0c14", bg2: "#1a1224", accent: "#c9a84c", card: "rgba(12,12,20,0.93)", text: "#fef3c7", border: "rgba(201,168,76,0.15)", inputBg: "rgba(201,168,76,0.05)", glow: "0 0 25px rgba(201,168,76,0.12)" },
  },
  {
    id: "rose",
    name: "Rose Gold",
    icon: Heart,
    description: "Romantic blush tones with soft pink highlights",
    colors: { bg: "#1a0e18", bg2: "#2a1528", accent: "#f472b6", card: "rgba(26,14,24,0.9)", text: "#fce7f3", border: "rgba(244,114,182,0.15)", inputBg: "rgba(244,114,182,0.05)", glow: "0 0 30px rgba(244,114,182,0.1)" },
  },
  {
    id: "aurora",
    name: "Aurora Skies",
    icon: Sparkles,
    description: "Magical northern lights with iridescent colors",
    colors: { bg: "#0f0a1a", bg2: "#1a0f2e", accent: "#a78bfa", card: "rgba(15,10,26,0.9)", text: "#ede9fe", border: "rgba(167,139,250,0.15)", inputBg: "rgba(167,139,250,0.05)", glow: "0 0 35px rgba(167,139,250,0.15)" },
  },
  {
    id: "ember",
    name: "Ember Glow",
    icon: Flame,
    description: "Warm fireplace ambiance with rich orange tones",
    colors: { bg: "#1a1008", bg2: "#2d180c", accent: "#fb923c", card: "rgba(26,16,8,0.9)", text: "#ffedd5", border: "rgba(251,146,60,0.15)", inputBg: "rgba(251,146,60,0.05)", glow: "0 0 30px rgba(251,146,60,0.12)" },
  },
  {
    id: "mint",
    name: "Fresh Mint",
    icon: Leaf,
    description: "Clean, refreshing mint with crisp white accents",
    colors: { bg: "#0a1a14", bg2: "#0f241a", accent: "#34d399", card: "rgba(10,26,20,0.9)", text: "#d1fae5", border: "rgba(52,211,153,0.12)", inputBg: "rgba(52,211,153,0.04)", glow: "0 0 25px rgba(52,211,153,0.1)" },
  },
  {
    id: "cosmic",
    name: "Cosmic Void",
    icon: Stars,
    description: "Deep space purples with stellar violet highlights",
    colors: { bg: "#0d0a1a", bg2: "#1a0f2e", accent: "#c084fc", card: "rgba(13,10,26,0.92)", text: "#f3e8ff", border: "rgba(192,132,252,0.15)", inputBg: "rgba(192,132,252,0.05)", glow: "0 0 35px rgba(192,132,252,0.15)" },
  },
  {
    id: "cloud",
    name: "Cloud Nine",
    icon: Cloud,
    description: "Soft, airy whites with subtle blue accents",
    colors: { bg: "#0f172a", bg2: "#1e293b", accent: "#60a5fa", card: "rgba(15,23,42,0.9)", text: "#e0e7ff", border: "rgba(96,165,250,0.12)", inputBg: "rgba(96,165,250,0.04)", glow: "0 0 25px rgba(96,165,250,0.1)" },
  },
  {
    id: "cafe",
    name: "Café Latte",
    icon: Coffee,
    description: "Warm coffee shop vibes with caramel tones",
    colors: { bg: "#1a1108", bg2: "#2d1c10", accent: "#d4a574", card: "rgba(26,17,8,0.92)", text: "#fef2e0", border: "rgba(212,165,116,0.15)", inputBg: "rgba(212,165,116,0.05)", glow: "0 0 25px rgba(212,165,116,0.1)" },
  },
];

function generatePortalHTML({ templateId, companyName, welcomeText, logoUrl, primaryColor, phoneNumber, showTerms, packages }) {
  const tpl = HOTSPOT_TEMPLATES.find(t => t.id === templateId) || HOTSPOT_TEMPLATES[0];
  const { bg, bg2, accent, card, text, border, inputBg, glow } = tpl.colors;
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
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, ${bg} 0%, ${bg2} 100%);
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
      position: relative;
      overflow: hidden;
    }
    body::before {
      content: '';
      position: absolute; inset: 0;
      background: radial-gradient(ellipse at 30% 20%, ${accent2}08 0%, transparent 60%),
                  radial-gradient(ellipse at 70% 80%, ${accent2}06 0%, transparent 50%);
      pointer-events: none;
    }
    .container {
      width: 100%; max-width: 400px;
      position: relative; z-index: 1;
    }
    .logo { text-align: center; margin-bottom: 28px; }
    .logo img { max-width: 130px; max-height: 55px; border-radius: 12px; }
    .logo-icon {
      width: 56px; height: 56px; margin: 0 auto 12px;
      background: linear-gradient(135deg, ${accent2}22, ${accent2}10);
      border: 1px solid ${border}; border-radius: 16px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: ${glow};
    }
    .logo-icon span { font-size: 24px; }
    .logo-text { font-size: 26px; font-weight: 800; color: ${text}; letter-spacing: -0.3px; }
    .welcome { text-align: center; color: ${text}; opacity: 0.6; font-size: 14px; margin-top: 6px; margin-bottom: 28px; }
    .card {
      background: ${card};
      backdrop-filter: blur(24px) saturate(120%);
      -webkit-backdrop-filter: blur(24px) saturate(120%);
      border: 1px solid ${border};
      border-radius: 22px;
      padding: 32px 24px;
      box-shadow: ${glow};
    }
    .packages {
      display: grid; grid-template-columns: repeat(${Math.min(pkgList.length, 4)}, 1fr);
      gap: 8px; margin-bottom: 22px;
    }
    .pkg-card {
      background: ${inputBg};
      border: 2px solid ${border};
      border-radius: 14px; padding: 14px 6px;
      text-align: center; cursor: pointer;
      transition: all 0.25s ease;
      position: relative;
    }
    .pkg-card:hover {
      border-color: ${accent2}66;
      background: ${accent2}0d;
      transform: translateY(-1px);
    }
    .pkg-card.selected {
      border-color: ${accent2};
      background: ${accent2}18;
      box-shadow: 0 0 16px ${accent2}22;
    }
    .pkg-badge {
      position: absolute; top: -8px; left: 50%; transform: translateX(-50%);
      background: ${accent2}; color: ${bg};
      font-size: 9px; font-weight: 700; padding: 2px 10px; border-radius: 20px;
      text-transform: uppercase; letter-spacing: 0.5px;
      display: none;
    }
    .pkg-card.selected .pkg-badge { display: block; }
    .pkg-name { font-size: 13px; font-weight: 600; color: ${text}; margin-bottom: 6px; }
    .pkg-price { font-size: 20px; font-weight: 700; color: ${accent2}; line-height: 1; }
    .pkg-price span { font-size: 10px; font-weight: 400; opacity: 0.6; display: block; margin-top: 2px; }
    .form-group { margin-bottom: 14px; }
    .form-group label {
      display: block; color: ${text}; font-size: 12px; font-weight: 600;
      margin-bottom: 6px; opacity: 0.7; letter-spacing: 0.3px; text-transform: uppercase;
    }
    .form-group input {
      width: 100%; padding: 14px 16px;
      background: ${inputBg};
      border: 1.5px solid ${border};
      border-radius: 14px; color: ${text}; font-size: 15px;
      outline: none; transition: all 0.25s;
      font-family: inherit;
    }
    .form-group input:focus {
      border-color: ${accent2};
      box-shadow: 0 0 0 3px ${accent2}22;
      background: ${accent2}08;
    }
    .form-group input::placeholder { color: ${text}; opacity: 0.25; }
    .btn-connect {
      width: 100%; padding: 16px;
      background: linear-gradient(135deg, ${accent2}, ${accent2}dd);
      color: ${bg}; border: none; border-radius: 14px;
      font-size: 16px; font-weight: 700;
      cursor: pointer; margin-top: 10px;
      transition: all 0.25s;
      box-shadow: 0 4px 20px ${accent2}33;
      letter-spacing: 0.3px;
    }
    .btn-connect:hover { opacity: 0.92; transform: translateY(-1px); box-shadow: 0 6px 28px ${accent2}44; }
    .btn-connect:active { transform: scale(0.98); }
    .btn-connect:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
    .terms { text-align: center; margin-top: 14px; }
    .terms label { color: ${text}; opacity: 0.5; font-size: 11px; cursor: pointer; }
    .terms input { margin-right: 6px; accent-color: ${accent2}; }
    .footer { text-align: center; margin-top: 22px; color: ${text}; opacity: 0.3; font-size: 11px; }
    .footer a { color: ${accent2}; text-decoration: none; font-weight: 500; }
    .status { text-align: center; margin-top: 12px; font-size: 13px; font-weight: 500; display: none; }
    .status.show { display: block; }
    .status.error { color: #f87171; }
    .selected-pkg { text-align: center; margin-bottom: 14px; font-size: 12px; color: ${text}; opacity: 0.55; font-weight: 500; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .card, .logo { animation: fadeIn 0.5s ease-out; }
    @media (max-width: 480px) {
      .card { padding: 24px 18px; border-radius: 18px; }
      .logo-text { font-size: 22px; }
      .container { max-width: 360px; }
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
        var s = document.getElementById('status');
        s.textContent = 'Please accept the terms to continue';
        s.className = 'status show error';
        return;
      }
      ` : ''}
      var s = document.getElementById('status');
      s.className = 'status';
      document.getElementById('connect').disabled = true;
      document.getElementById('connect').textContent = 'Connecting...';
      const chal = '${Math.random().toString(36).substring(2, 10)}';
      const pass = hexMD5('\\0' + p + chal);
      var url = 'http://' + location.hostname + '/login?username=' + encodeURIComponent(u) + '&password=' + encodeURIComponent(pass) + '&dst=' + encodeURIComponent(location.href);
      if (selectedPackage) {
        url += '&comment=' + encodeURIComponent(selectedPackage.name + '|' + selectedPackage.price);
      }
      const req = new XMLHttpRequest();
      req.open('GET', url, true);
      req.onload = function() {
        if (req.status === 200) {
          s.style.color = '#10b981';
          s.textContent = 'Connected! Redirecting...';
          s.className = 'status show';
          setTimeout(function() { location.href = '${window.location.origin || "https://google.com"}'; }, 1500);
        } else {
          document.getElementById('connect').disabled = false;
          document.getElementById('connect').textContent = 'Connect to WiFi';
          s.textContent = 'Login failed. Check your credentials.';
          s.className = 'status show error';
        }
      };
      req.send();
    }
  </script>
</head>
<body>
  <div class="container">
    <div class="logo">
      <div class="logo-icon"><span>${logoUrl ? `<img src="${logoUrl}" alt="" style="max-width:100%;max-height:100%;object-fit:contain" />` : '📶'}</span></div>
      <div class="logo-text">${company}</div>
      <p class="welcome">${welcome}</p>
    </div>
    <div class="card">
      ${hasPackages ? `
      <div class="packages">
        ${pkgList.map((pkg, i) => `
        <div class="pkg-card${i === 0 ? ' selected' : ''}" onclick="selectPackage(this, '${pkg.name}', '${pkg.price}')">
          <div class="pkg-badge">TOP</div>
          <div class="pkg-name">${pkg.name}</div>
          <div class="pkg-price">KES ${pkg.price}<span>${pkg.duration || ''}</span></div>
        </div>
        `).join('')}
      </div>
      <p id="sel-pkg-label" class="selected-pkg" style="display:block">Selected: ${pkgList[0].name} — KES ${pkgList[0].price}</p>
      ` : ''}
      <form onsubmit="event.preventDefault(); doLogin();">
        <div class="form-group">
          <label>Phone Number</label>
          <input id="username" type="text" placeholder="07XX XXX XXX" autocomplete="off" inputmode="tel" />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input id="password" type="password" placeholder="Enter your password" />
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
            <CardContent className="grid grid-cols-3 gap-2">
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
              <div className={`bg-zinc-950 rounded-b-xl overflow-hidden ${previewMode === "mobile" ? "w-[375px] mx-auto" : "w-full"}`}                   style={{ height: previewMode === "mobile" ? "750px" : "650px" }}>
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
