import { useState, useEffect } from "react";
import axios from "axios";
import {
  Eye, Save, Download, Upload, RefreshCw, Check, Copy,
  Wifi, Coffee, Zap, ShoppingBag, Hotel, Building2, Plane,
  Smartphone, Monitor, Palette, Settings, Plus, Trash2, X,
  Sun, Moon, Cloud, Sparkles, Waves, Flame, Leaf, Stars,
  Heart, Diamond, Gem, Glasses, Crown, ChevronDown, ChevronUp,
  Router,
} from "lucide-react";
import { useToastStore } from "../../stores/toastStore";

const API = import.meta.env.VITE_API_URL || "/api";

const HOTSPOT_TEMPLATES = [
  { id: "prism",    name: "Crystal Prism",    icon: Gem,       desc: "Glass morphism with iridescent gradients", type: "premium", accent: "#22d3ee", colors: { bg: "#0a0a20", bg2: "#141030", bg3: "#1a1540", accent: "#22d3ee", card: "rgba(15,15,35,0.7)", text: "#e2e8f0", border: "rgba(34,211,238,0.15)", inputBg: "rgba(34,211,238,0.06)", glow: "0 0 40px rgba(34,211,238,0.2)", cardBlur: "30px" } },
  { id: "quantum",  name: "Quantum Pulse",    icon: Diamond,   desc: "Animated moving gradients", type: "premium", accent: "#c084fc", colors: { bg: "#0d0d1a", bg2: "#1a1030", bg3: "#251555", accent: "#c084fc", card: "rgba(15,15,30,0.65)", text: "#f3e8ff", border: "rgba(192,132,252,0.18)", inputBg: "rgba(192,132,252,0.06)", glow: "0 0 50px rgba(192,132,252,0.25)", cardBlur: "35px" } },
  { id: "luxe",     name: "Executive Luxe",   icon: Crown,     desc: "Premium dark with gold accents", type: "premium", accent: "#eab308", colors: { bg: "#0a0a0f", bg2: "#141416", bg3: "#1c1812", accent: "#eab308", card: "rgba(14,14,18,0.75)", text: "#fef3c7", border: "rgba(234,179,8,0.18)", inputBg: "rgba(234,179,8,0.06)", glow: "0 0 35px rgba(234,179,8,0.2)", cardBlur: "28px" } },
  { id: "neon",     name: "Neon Night",       icon: Zap,       desc: "Electric cyberpunk glow", accent: "#00ff88", colors: { bg: "#08080f", bg2: "#0f0f1a", bg3: "#0a1520", accent: "#00ff88", card: "rgba(10,10,18,0.8)", text: "#e0ffe0", border: "rgba(0,255,136,0.15)", inputBg: "rgba(0,255,136,0.05)", glow: "0 0 30px rgba(0,255,136,0.18)", cardBlur: "24px" } },
  { id: "sunset",   name: "Sunset Bliss",     icon: Sun,       desc: "Warm golden gradients", accent: "#ff8c42", colors: { bg: "#1a0f0a", bg2: "#2d1810", bg3: "#351a10", accent: "#ff8c42", card: "rgba(26,15,10,0.8)", text: "#ffe8d5", border: "rgba(255,140,66,0.15)", inputBg: "rgba(255,140,66,0.05)", glow: "0 0 30px rgba(255,140,66,0.15)", cardBlur: "24px" } },
  { id: "ocean",    name: "Deep Ocean",       icon: Waves,     desc: "Serene underwater blues", accent: "#38bdf8", colors: { bg: "#061224", bg2: "#0a1a38", bg3: "#0d2240", accent: "#38bdf8", card: "rgba(6,18,36,0.82)", text: "#e0f2fe", border: "rgba(56,189,248,0.12)", inputBg: "rgba(56,189,248,0.04)", glow: "0 0 40px rgba(56,189,248,0.12)", cardBlur: "26px" } },
  { id: "forest",   name: "Enchanted Forest", icon: Leaf,      desc: "Mystical emerald greens", accent: "#4ade80", colors: { bg: "#0a1410", bg2: "#121e16", bg3: "#162818", accent: "#4ade80", card: "rgba(10,20,16,0.8)", text: "#dcfce7", border: "rgba(74,222,128,0.12)", inputBg: "rgba(74,222,128,0.05)", glow: "0 0 30px rgba(74,222,128,0.12)", cardBlur: "24px" } },
  { id: "midnight", name: "Midnight Luxe",    icon: Moon,      desc: "Dark luxury with gold", accent: "#c9a84c", colors: { bg: "#0c0c14", bg2: "#1a1224", bg3: "#201630", accent: "#c9a84c", card: "rgba(12,12,20,0.82)", text: "#fef3c7", border: "rgba(201,168,76,0.15)", inputBg: "rgba(201,168,76,0.05)", glow: "0 0 25px rgba(201,168,76,0.12)", cardBlur: "26px" } },
  { id: "rose",     name: "Rose Gold",        icon: Heart,     desc: "Romantic blush tones", accent: "#f472b6", colors: { bg: "#1a0e18", bg2: "#2a1528", bg3: "#301a2a", accent: "#f472b6", card: "rgba(26,14,24,0.8)", text: "#fce7f3", border: "rgba(244,114,182,0.15)", inputBg: "rgba(244,114,182,0.05)", glow: "0 0 28px rgba(244,114,182,0.12)", cardBlur: "24px" } },
  { id: "aurora",   name: "Aurora Skies",     icon: Sparkles,  desc: "Northern lights colours", accent: "#a78bfa", colors: { bg: "#0f0a1a", bg2: "#1a0f2e", bg3: "#201440", accent: "#a78bfa", card: "rgba(15,10,26,0.78)", text: "#ede9fe", border: "rgba(167,139,250,0.15)", inputBg: "rgba(167,139,250,0.05)", glow: "0 0 35px rgba(167,139,250,0.18)", cardBlur: "28px" } },
  { id: "cafe",     name: "Café Latte",       icon: Coffee,    desc: "Warm coffee shop vibes", accent: "#d4a574", colors: { bg: "#1a1108", bg2: "#2d1c10", bg3: "#352010", accent: "#d4a574", card: "rgba(26,17,8,0.82)", text: "#fef2e0", border: "rgba(212,165,116,0.15)", inputBg: "rgba(212,165,116,0.05)", glow: "0 0 25px rgba(212,165,116,0.1)", cardBlur: "24px" } },
  { id: "cosmic",   name: "Cosmic Void",      icon: Stars,     desc: "Deep space purples", accent: "#c084fc", colors: { bg: "#0d0a1a", bg2: "#1a0f2e", bg3: "#241540", accent: "#c084fc", card: "rgba(13,10,26,0.8)", text: "#f3e8ff", border: "rgba(192,132,252,0.15)", inputBg: "rgba(192,132,252,0.05)", glow: "0 0 35px rgba(192,132,252,0.18)", cardBlur: "26px" } },
];

function generatePortalHTML({ templateId, companyName, welcomeText, logoUrl, primaryColor, phoneNumber, showTerms, packages }) {
  const tpl = HOTSPOT_TEMPLATES.find(t => t.id === templateId) || HOTSPOT_TEMPLATES[0];
  const { bg, bg2, bg3, accent, card, text, border, inputBg, glow, cardBlur } = tpl.colors;
  const accent2 = primaryColor || accent;
  const company = companyName || "My WiFi";
  const welcome = welcomeText || "Welcome to our HotSpot";
  const pkgList = (packages && packages.length > 0) ? packages : [
    { name: "1 Hour", price: "50", duration: "1h" },
    { name: "1 Day",  price: "100", duration: "1d" },
    { name: "1 Week", price: "500", duration: "7d" },
  ];
  const isPremium = tpl.type === "premium";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${company} — WiFi</title>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: linear-gradient(135deg, ${bg}, ${bg2}, ${bg3}); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; position: relative; overflow: hidden; }
    ${isPremium ? `
    @keyframes moveGradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
    @keyframes float { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-10px) scale(1.02); } }
    body { background-size: 400% 400%; animation: moveGradient 15s ease infinite; }
    .orb { position: absolute; border-radius: 50%; filter: blur(60px); opacity: 0.3; pointer-events: none; animation: float 8s ease-in-out infinite; }
    .orb-1 { width: 300px; height: 300px; background: radial-gradient(circle, ${accent2}66, transparent); top: -5%; left: 10%; }
    .orb-2 { width: 200px; height: 200px; background: radial-gradient(circle, ${accent2}44, transparent); bottom: -10%; right: 15%; animation-delay: 2s; animation-duration: 10s; }
    ` : `
    body::before { content: ''; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse at 30% 20%, ${accent2}08 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, ${accent2}05 0%, transparent 50%); }
    `}
    @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes shimmer { 0% { background-position: -200px 0; } 100% { background-position: 200px 0; } }
    .container { width: 100%; max-width: 420px; position: relative; z-index: 2; }
    .logo { text-align: center; margin-bottom: 24px; animation: fadeUp 0.6s ease-out; }
    .logo-icon { width: 64px; height: 64px; margin: 0 auto 14px; background: linear-gradient(135deg, ${accent2}33, ${accent2}10); border: 2px solid ${border}; border-radius: 20px; display: flex; align-items: center; justify-content: center; box-shadow: ${glow}; }
    .logo-icon span { font-size: 28px; }
    .brand-name { font-size: 28px; font-weight: 800; color: ${text}; letter-spacing: -0.5px; }
    .welcome { color: ${text}; opacity: 0.55; font-size: 14px; margin-top: 5px; }
    .card { background: ${card}; backdrop-filter: blur(${cardBlur}) saturate(140%); -webkit-backdrop-filter: blur(${cardBlur}) saturate(140%); border: 1.5px solid ${border}; border-radius: 24px; padding: 36px 28px; box-shadow: ${glow}; animation: fadeUp 0.7s ease-out 0.1s; position: relative; overflow: hidden; }
    .packages { display: grid; grid-template-columns: repeat(${Math.min(pkgList.length, 4)}, 1fr); gap: 8px; margin-bottom: 24px; }
    .pkg-card { background: linear-gradient(135deg, ${inputBg}, rgba(255,255,255,0.02)); border: 2px solid ${border}; border-radius: 16px; padding: 16px 8px; text-align: center; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); position: relative; }
    .pkg-card:hover { border-color: ${accent2}77; background: ${accent2}12; transform: translateY(-2px); }
    .pkg-card.selected { border-color: ${accent2}; background: ${accent2}20; box-shadow: 0 0 20px ${accent2}33; transform: translateY(-3px); }
    .pkg-badge { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, ${accent2}, ${accent2}dd); color: ${bg}; font-size: 9px; font-weight: 700; padding: 3px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; display: none; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
    .pkg-card.selected .pkg-badge { display: block; }
    .pkg-name { font-size: 13px; font-weight: 700; color: ${text}; margin-bottom: 8px; }
    .pkg-price { font-size: 22px; font-weight: 800; color: ${accent2}; line-height: 1; }
    .pkg-price span { font-size: 10px; font-weight: 500; opacity: 0.5; display: block; margin-top: 3px; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; color: ${text}; font-size: 11px; font-weight: 700; margin-bottom: 8px; opacity: 0.65; letter-spacing: 0.5px; text-transform: uppercase; }
    .input-wrap { position: relative; }
    .input-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-size: 16px; opacity: 0.4; pointer-events: none; }
    .input-wrap input { width: 100%; padding: 16px 16px 16px 42px; background: ${inputBg}; border: 2px solid ${border}; border-radius: 16px; color: ${text}; font-size: 15px; outline: none; transition: all 0.3s; font-family: inherit; }
    .input-wrap input:focus { border-color: ${accent2}; box-shadow: 0 0 0 4px ${accent2}18; background: ${accent2}0a; }
    .input-wrap input::placeholder { color: ${text}; opacity: 0.2; }
    .btn-connect { width: 100%; padding: 18px; background: linear-gradient(135deg, ${accent2}, ${accent2}cc); color: ${bg}; border: none; border-radius: 16px; font-size: 17px; font-weight: 700; cursor: pointer; margin-top: 14px; transition: all 0.3s; box-shadow: 0 6px 30px ${accent2}44; letter-spacing: 0.5px; }
    .btn-connect:hover { transform: translateY(-2px); box-shadow: 0 8px 40px ${accent2}66; }
    .btn-connect:active { transform: scale(0.97); }
    .btn-connect:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
    .terms { text-align: center; margin-top: 16px; }
    .terms label { color: ${text}; opacity: 0.45; font-size: 11px; cursor: pointer; }
    .terms input { margin-right: 8px; accent-color: ${accent2}; }
    .status { text-align: center; margin-top: 14px; font-size: 14px; font-weight: 600; display: none; }
    .status.show { display: block; }
    .status.error { color: #f87171; }
    .status.success { color: #4ade80; }
    .selected-pkg { text-align: center; margin-bottom: 16px; font-size: 12px; color: ${text}; opacity: 0.5; font-weight: 600; }
    .footer { text-align: center; margin-top: 24px; color: ${text}; opacity: 0.25; font-size: 11px; }
    .footer strong { color: ${accent2}; opacity: 0.7; }
    @media (max-width: 480px) { .container { max-width: 370px; } .card { padding: 28px 20px; border-radius: 20px; } .brand-name { font-size: 22px; } }
  </style>
  <script src="/md5.js"></script>
  <script>
    var selectedPackage = ${pkgList.length > 0 ? `{ name: '${pkgList[0].name}', price: '${pkgList[0].price}' }` : 'null'};
    function selectPackage(el, name, price) {
      document.querySelectorAll('.pkg-card').forEach(function(c) { c.classList.remove('selected'); });
      el.classList.add('selected'); selectedPackage = { name: name, price: price };
      var label = document.getElementById('sel-pkg-label');
      if (label) { label.textContent = 'Selected: ' + name + ' — KES ' + price; label.style.display = 'block'; }
    }
    function doLogin() {
      var u = document.getElementById('username').value;
      var p = document.getElementById('password').value;
      var s = document.getElementById('status');
      if (!u || !p) { s.textContent = 'Please fill in both fields'; s.className = 'status show error'; return; }
      ${showTerms ? `var terms = document.getElementById('terms'); if (terms && !terms.checked) { s.textContent = 'Accept the terms to continue'; s.className = 'status show error'; return; }` : ''}
      s.className = 'status'; var btn = document.getElementById('connect'); btn.disabled = true; btn.textContent = 'Connecting...';
      var chal = '${Math.random().toString(36).substring(2, 10)}';
      var pass = typeof hexMD5 === 'function' ? hexMD5('\\0' + p + chal) : p;
      var url = 'http://' + location.hostname + '/login?username=' + encodeURIComponent(u) + '&password=' + encodeURIComponent(pass) + '&dst=' + encodeURIComponent(location.href);
      if (selectedPackage) { url += '&comment=' + encodeURIComponent(selectedPackage.name + '|' + selectedPackage.price); }
      var req = new XMLHttpRequest();
      req.open('GET', url, true);
      req.onload = function() {
        if (req.status === 200) { s.textContent = 'Connected! Redirecting...'; s.className = 'status show success'; setTimeout(function() { location.href = 'https://google.com'; }, 1500); }
        else { btn.disabled = false; btn.textContent = 'Connect to WiFi'; s.textContent = 'Login failed. Check your details.'; s.className = 'status show error'; }
      };
      req.onerror = function() { btn.disabled = false; btn.textContent = 'Connect to WiFi'; s.textContent = 'Connection error. Try again.'; s.className = 'status show error'; };
      req.send();
    }
  </script>
</head>
<body>
  ${isPremium ? '<div class="orb orb-1"></div><div class="orb orb-2"></div>' : ''}
  <div class="container">
    <div class="logo">
      <div class="logo-icon">
        <span>${logoUrl ? `<img src="${logoUrl}" alt="" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:8px" />` : '📶'}</span>
      </div>
      <div class="brand-name">${company}</div>
      <p class="welcome">${welcome}</p>
    </div>
    <div class="card">
      ${pkgList.length > 0 ? `
      <div class="packages">
        ${pkgList.map((pkg, i) => `
        <div class="pkg-card${i === 0 ? ' selected' : ''}" onclick="selectPackage(this, '${pkg.name.replace(/'/g, "\\'")}', '${pkg.price}')">
          ${i === 0 ? '<div class="pkg-badge">BEST</div>' : ''}
          <div class="pkg-name">${pkg.name}</div>
          <div class="pkg-price">KES ${pkg.price}<span>${pkg.duration || ''}</span></div>
        </div>`).join('')}
      </div>
      <p id="sel-pkg-label" class="selected-pkg" style="display:block">Selected: ${pkgList[0].name} — KES ${pkgList[0].price}</p>
      ` : ''}
      <form onsubmit="event.preventDefault(); doLogin();">
        <div class="form-group">
          <label>Phone Number</label>
          <div class="input-wrap"><span class="input-icon">📱</span><input id="username" type="text" placeholder="0712 345 678" autocomplete="off" inputmode="tel" /></div>
        </div>
        <div class="form-group">
          <label>Password / Voucher Code</label>
          <div class="input-wrap"><span class="input-icon">🔒</span><input id="password" type="password" placeholder="Enter your code" /></div>
        </div>
        <button type="submit" id="connect" class="btn-connect">Connect to WiFi</button>
      </form>
      ${showTerms ? '<div class="terms"><label><input type="checkbox" id="terms" /> I accept the Terms of Service</label></div>' : ''}
      <div id="status" class="status"></div>
    </div>
    <div class="footer">Powered by <strong>${company}</strong>${phoneNumber ? ` &middot; 📞 ${phoneNumber}` : ''}</div>
  </div>
</body>
</html>`;
}

/* ── small helpers ── */
function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function DarkInput({ value, onChange, placeholder, type = "text", className = "" }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full bg-zinc-800/60 border border-zinc-700/50 hover:border-zinc-600/50 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition-all ${className}`}
    />
  );
}

export default function CaptivePortalBuilder() {
  const addToast = useToastStore((state) => state.addToast);
  const toast = {
    success: (msg) => addToast("success", msg, "", 3000),
    error:   (msg) => addToast("error",   msg, "", 4000),
  };

  const [selectedTemplate, setSelectedTemplate] = useState("prism");
  const [companyName,   setCompanyName]   = useState(() => localStorage.getItem("portal_company")  || "");
  const [welcomeText,   setWelcomeText]   = useState(() => localStorage.getItem("portal_welcome")  || "");
  const [logoUrl,       setLogoUrl]       = useState(() => localStorage.getItem("portal_logo")     || "");
  const [primaryColor,  setPrimaryColor]  = useState(() => localStorage.getItem("portal_color")    || "");
  const [phoneNumber,   setPhoneNumber]   = useState(() => localStorage.getItem("portal_phone")    || "");
  const [showTerms,     setShowTerms]     = useState(true);
  const [previewMode,   setPreviewMode]   = useState("desktop");
  const [connections,   setConnections]   = useState([]);
  const [selectedConn,  setSelectedConn]  = useState("");
  const [pushing,       setPushing]       = useState(false);
  const [copied,        setCopied]        = useState(false);
  const [savedPortals,  setSavedPortals]  = useState([]);
  const [packagesOpen,  setPackagesOpen]  = useState(true);
  const [packages, setPackages] = useState(() => {
    try { return JSON.parse(localStorage.getItem("portal_packages") || "null") || [
      { name: "1 Hour", price: "50",  duration: "1h" },
      { name: "1 Day",  price: "100", duration: "1d" },
      { name: "1 Week", price: "500", duration: "7d" },
    ]; } catch (e) { return []; }
  });

  useEffect(() => {
    axios.get(`${API}/mikrotik`).then(r => setConnections(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    axios.get(`${API}/resellers/captive-portals`).then(r => setSavedPortals(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const save = (key, val) => localStorage.setItem(key, val);
  const savePkgs = (pkgs) => { setPackages(pkgs); localStorage.setItem("portal_packages", JSON.stringify(pkgs)); };

  const getHtml = () => generatePortalHTML({ templateId: selectedTemplate, companyName, welcomeText, logoUrl, primaryColor, phoneNumber, showTerms, packages });

  const handlePush = async () => {
    if (!selectedConn) { toast.error("Select a router first"); return; }
    setPushing(true);
    try {
      await axios.post(`${API}/resellers/captive-portals/push`, { connection_id: selectedConn, html: getHtml(), profile: "default", portal_name: companyName || "hotspot-portal" });
      toast.success("Portal pushed to router!");
    } catch (e) { toast.error("Push failed — check router connection"); }
    finally { setPushing(false); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getHtml());
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    toast.success("HTML copied to clipboard");
  };

  const handleDownload = () => {
    const blob = new Blob([getHtml()], { type: "text/html" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${(companyName || "hotspot-portal").replace(/\s+/g, "-").toLowerCase()}.html`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const handleSave = async () => {
    try {
      await axios.post(`${API}/resellers/captive-portals`, { name: companyName || "Untitled", elements: [], styles: {}, html: getHtml() });
      toast.success("Portal saved");
      const { data } = await axios.get(`${API}/resellers/captive-portals`);
      setSavedPortals(Array.isArray(data) ? data : []);
    } catch (e) { toast.error("Save failed"); }
  };

  const activeTpl = HOTSPOT_TEMPLATES.find(t => t.id === selectedTemplate) || HOTSPOT_TEMPLATES[0];

  return (
    <div className="relative min-h-full animate-fade-in">
      <div className="absolute inset-0 bg-mesh pointer-events-none" />
      <div className="absolute inset-0 bg-noise pointer-events-none" />

      {/* ── Top bar ── */}
      <div className="relative border-b border-zinc-800/60 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-20 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Wifi className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">Captive Portal Builder</h1>
              <p className="text-[11px] text-zinc-500">
                {activeTpl.name} &middot; {HOTSPOT_TEMPLATES.length} themes &middot; live preview
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/40 transition-all">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy HTML"}
            </button>
            <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/40 transition-all">
              <Download className="w-3.5 h-3.5" /> Download
            </button>
            <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/40 transition-all">
              <Save className="w-3.5 h-3.5" /> Save
            </button>
            <button
              onClick={handlePush}
              disabled={pushing || !selectedConn}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-700 disabled:text-zinc-500 transition-all shadow-lg shadow-amber-600/20"
            >
              {pushing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Push to Router
            </button>
          </div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* ── Left panel ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Template picker */}
            <div className="glass rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
                <Palette className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Theme</h3>
                <span className="ml-auto text-[11px] text-zinc-500">{activeTpl.name}</span>
              </div>
              <div className="p-3 grid grid-cols-4 gap-2">
                {HOTSPOT_TEMPLATES.map(tpl => (
                  <button
                    key={tpl.id}
                    onClick={() => setSelectedTemplate(tpl.id)}
                    title={tpl.name}
                    className={`relative flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all group ${
                      selectedTemplate === tpl.id
                        ? "border-amber-500/60 bg-amber-500/8"
                        : "border-zinc-800/50 hover:border-zinc-700/50 hover:bg-zinc-800/30"
                    }`}
                  >
                    {/* colour swatch */}
                    <div className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${tpl.accent}44, ${tpl.accent}11)` }}>
                      <tpl.icon className="w-4 h-4" style={{ color: tpl.accent }} />
                    </div>
                    <span className="text-[10px] text-zinc-400 group-hover:text-zinc-200 leading-tight text-center line-clamp-1">{tpl.name}</span>
                    {tpl.type === "premium" && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                        <span className="text-[7px] font-black text-black">✦</span>
                      </span>
                    )}
                    {selectedTemplate === tpl.id && (
                      <span className="absolute bottom-1 right-1 w-2 h-2 bg-amber-400 rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Customise */}
            <div className="glass rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
                <Settings className="w-4 h-4 text-zinc-400" />
                <h3 className="text-sm font-semibold text-white">Customise</h3>
              </div>
              <div className="p-4 space-y-3">
                <Field label="Company Name">
                  <DarkInput value={companyName} onChange={e => { setCompanyName(e.target.value); save("portal_company", e.target.value); }} placeholder="My WiFi" />
                </Field>
                <Field label="Welcome Message">
                  <DarkInput value={welcomeText} onChange={e => { setWelcomeText(e.target.value); save("portal_welcome", e.target.value); }} placeholder="Welcome to our free WiFi" />
                </Field>
                <Field label="Logo URL">
                  <DarkInput value={logoUrl} onChange={e => { setLogoUrl(e.target.value); save("portal_logo", e.target.value); }} placeholder="https://…/logo.png" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Accent Colour">
                    <input
                      type="color"
                      value={primaryColor || activeTpl.accent}
                      onChange={e => { setPrimaryColor(e.target.value); save("portal_color", e.target.value); }}
                      className="w-full h-9 rounded-lg border border-zinc-700/50 cursor-pointer bg-transparent"
                    />
                  </Field>
                  <Field label="Support Phone">
                    <DarkInput value={phoneNumber} onChange={e => { setPhoneNumber(e.target.value); save("portal_phone", e.target.value); }} placeholder="0712 345 678" />
                  </Field>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <div className={`w-8 h-4.5 rounded-full transition-colors relative ${showTerms ? "bg-amber-500" : "bg-zinc-700"}`} onClick={() => setShowTerms(!showTerms)}>
                    <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-all ${showTerms ? "left-4" : "left-0.5"}`} />
                  </div>
                  <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors select-none" onClick={() => setShowTerms(!showTerms)}>Show "Accept Terms" checkbox</span>
                </label>
              </div>
            </div>

            {/* Packages */}
            <div className="glass rounded-2xl overflow-hidden">
              <button
                onClick={() => setPackagesOpen(!packagesOpen)}
                className="w-full px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2 hover:bg-zinc-800/20 transition-colors"
              >
                <Zap className="w-4 h-4 text-zinc-400" />
                <h3 className="text-sm font-semibold text-white">Hotspot Packages</h3>
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-500">{packages.length} plan{packages.length !== 1 ? "s" : ""}</span>
                  {packagesOpen ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
                </span>
              </button>
              {packagesOpen && (
                <div className="p-4 space-y-2">
                  {/* header row */}
                  <div className="grid grid-cols-[1fr_80px_72px_32px] gap-2 px-1">
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Name</span>
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">KES</span>
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Duration</span>
                    <span />
                  </div>
                  {packages.map((pkg, i) => (
                    <div key={i} className="grid grid-cols-[1fr_80px_72px_32px] gap-2 items-center">
                      <DarkInput value={pkg.name} onChange={e => { const n = [...packages]; n[i].name = e.target.value; savePkgs(n); }} placeholder="Name" />
                      <DarkInput value={pkg.price} onChange={e => { const n = [...packages]; n[i].price = e.target.value; savePkgs(n); }} placeholder="50" type="number" />
                      <DarkInput value={pkg.duration} onChange={e => { const n = [...packages]; n[i].duration = e.target.value; savePkgs(n); }} placeholder="1h" />
                      <button onClick={() => savePkgs(packages.filter((_, j) => j !== i))} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {packages.length < 4 && (
                    <button onClick={() => savePkgs([...packages, { name: "", price: "", duration: "" }])}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-zinc-700/50 hover:border-zinc-600/50 text-xs text-zinc-500 hover:text-zinc-300 transition-all">
                      <Plus className="w-3.5 h-3.5" /> Add package
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Push to router */}
            {connections.length > 0 && (
              <div className="glass rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
                  <Router className="w-4 h-4 text-zinc-400" />
                  <h3 className="text-sm font-semibold text-white">Push to Router</h3>
                </div>
                <div className="p-4">
                  <select
                    value={selectedConn}
                    onChange={e => setSelectedConn(e.target.value)}
                    className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500/60 transition-all"
                  >
                    <option value="">Select router…</option>
                    {connections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.ip_address})</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* ── Preview ── */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            <div className="glass rounded-2xl overflow-hidden flex flex-col">
              {/* preview toolbar */}
              <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white">Live Preview</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400">live</span>
                </div>
                <div className="flex gap-1 bg-zinc-800/60 rounded-lg p-0.5">
                  <button
                    onClick={() => setPreviewMode("mobile")}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${previewMode === "mobile" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                  >
                    <Smartphone className="w-3.5 h-3.5" /> Mobile
                  </button>
                  <button
                    onClick={() => setPreviewMode("desktop")}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${previewMode === "desktop" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                  >
                    <Monitor className="w-3.5 h-3.5" /> Desktop
                  </button>
                </div>
              </div>

              {/* device chrome */}
              <div className="bg-zinc-950/80 p-4 flex justify-center items-start min-h-[600px]">
                {previewMode === "mobile" ? (
                  <div className="relative w-[320px]">
                    {/* phone frame */}
                    <div className="relative bg-zinc-900 rounded-[36px] border-2 border-zinc-700 shadow-2xl overflow-hidden" style={{ height: "640px" }}>
                      {/* notch */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-zinc-900 rounded-b-2xl z-10 flex items-center justify-center">
                        <div className="w-8 h-1.5 bg-zinc-700 rounded-full" />
                      </div>
                      <iframe
                        srcDoc={getHtml()}
                        className="w-full h-full border-0"
                        title="Portal Preview Mobile"
                        sandbox="allow-scripts allow-forms allow-same-origin"
                        style={{ marginTop: "20px", height: "calc(100% - 20px)" }}
                      />
                    </div>
                    {/* home bar */}
                    <div className="mt-3 flex justify-center">
                      <div className="w-20 h-1 bg-zinc-600 rounded-full" />
                    </div>
                  </div>
                ) : (
                  <div className="w-full">
                    {/* browser chrome */}
                    <div className="bg-zinc-800 rounded-t-xl border border-zinc-700/50 px-3 py-2 flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-rose-500/60" />
                        <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                        <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
                      </div>
                      <div className="flex-1 bg-zinc-700/50 rounded-md px-3 py-1 text-[11px] text-zinc-500 truncate">
                        192.168.1.1/login
                      </div>
                    </div>
                    <div className="border border-t-0 border-zinc-700/50 rounded-b-xl overflow-hidden" style={{ height: "560px" }}>
                      <iframe
                        srcDoc={getHtml()}
                        className="w-full h-full border-0"
                        title="Portal Preview Desktop"
                        sandbox="allow-scripts allow-forms allow-same-origin"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Saved portals */}
            {savedPortals.length > 0 && (
              <div className="glass rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800/50">
                  <h3 className="text-sm font-semibold text-white">Saved Portals ({savedPortals.length})</h3>
                </div>
                <div className="p-4 flex gap-2 overflow-x-auto pb-2">
                  {savedPortals.map(p => (
                    <div key={p.id} className="shrink-0 w-44 p-3 rounded-xl bg-zinc-800/30 border border-zinc-800/50 hover:border-zinc-700/50 transition-all cursor-pointer">
                      <p className="text-sm font-medium text-white truncate">{p.name}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
