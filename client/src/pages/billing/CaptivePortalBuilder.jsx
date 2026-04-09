import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  Palette, Eye, Save, Upload, Plus, Trash2, Type, Image, Square,
  MoveUp, MoveDown, Download, Settings, Monitor, Smartphone, RefreshCw,
  Palette as PaletteIcon, Layout, FileText, Send, Undo, Redo, GripVertical,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline, Layers,
  ArrowUp, ArrowDown, Maximize2, Minimize2, Copy, Clipboard, Check
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';

const API = import.meta.env.VITE_API_URL || '/api';

/* ─── Default Portal Templates ─── */
const templates = {
  blank: { 
    elements: [], 
    styles: { bgType: 'solid', bgColor: '#0f1117', accentColor: '#3b82f6' },
    settings: { language: 'en', showTerms: false, showTimeout: false, redirectUrl: '' }
  },
  modern: {
    elements: [
      { id: '1', type: 'logo', content: 'MyISP WiFi', x: 50, y: 10, width: 40, height: 8, size: 'large', style: { color: '#ffffff', fontSize: '32px', fontWeight: 'bold', textAlign: 'center' } },
      { id: '2', type: 'text', content: 'Welcome to our HotSpot', x: 50, y: 22, width: 60, height: 5, size: 'medium', style: { color: '#a1a1aa', fontSize: '16px', textAlign: 'center' } },
      { id: '3', type: 'login-form', x: 50, y: 40, width: 60, height: 30, style: { borderRadius: '16px', bgColor: 'rgba(24,24,27,0.8)' } },
      { id: '4', type: 'text', content: 'Need help? Call +254 700 000 000', x: 50, y: 85, width: 60, height: 4, size: 'small', style: { color: '#71717a', fontSize: '12px', textAlign: 'center' } },
    ],
    styles: { bgType: 'gradient', bgColor1: '#0f1117', bgColor2: '#1a1a2e', accentColor: '#3b82f6', bgImage: '' },
    settings: { language: 'en', showTerms: true, showTimeout: true, redirectUrl: 'https://google.com' }
  },
  colorful: {
    elements: [
      { id: '1', type: 'logo', content: '🌐 HotSpot', x: 50, y: 8, width: 50, height: 10, size: 'large', style: { color: '#fbbf24', fontSize: '36px', fontWeight: 'bold', textAlign: 'center' } },
      { id: '2', type: 'text', content: 'Free WiFi • Fast Internet', x: 50, y: 18, width: 60, height: 5, size: 'medium', style: { color: '#e4e4e7', fontSize: '18px', textAlign: 'center' } },
      { id: '3', type: 'promo-banner', x: 50, y: 28, width: 80, height: 12, style: { bgColor: 'rgba(251,191,36,0.1)', textColor: '#fbbf24', borderRadius: '12px' }, content: '🔥 Special Offer: 50% OFF Daily Pass!' },
      { id: '4', type: 'login-form', x: 50, y: 45, width: 50, height: 28, style: { borderRadius: '20px', bgColor: 'rgba(0,0,0,0.7)' } },
      { id: '5', type: 'social-login', x: 50, y: 75, width: 50, height: 8, style: {} },
      { id: '6', type: 'text', content: 'By connecting, you agree to our Terms of Service', x: 50, y: 88, width: 60, height: 4, size: 'small', style: { color: '#52525b', fontSize: '11px', textAlign: 'center' } },
    ],
    styles: { bgType: 'gradient', bgColor1: '#1e1b4b', bgColor2: '#312e81', accentColor: '#fbbf24', bgImage: '' },
    settings: { language: 'en', showTerms: true, showTimeout: false, redirectUrl: '' }
  },
  withWidgets: {
    elements: [
      { id: '1', type: 'logo', content: '☕ Café WiFi', x: 50, y: 5, width: 40, height: 8, size: 'large', style: { color: '#ffffff', fontSize: '28px', fontWeight: 'bold', textAlign: 'center' } },
      { id: '2', type: 'announcement', x: 50, y: 15, width: 70, height: 10, style: { bgColor: 'rgba(16,185,129,0.1)', textColor: '#10b981', borderRadius: '12px' }, content: '✅ Free 30min trial available | Premium: $2/hr' },
      { id: '3', type: 'login-form', x: 50, y: 32, width: 55, height: 28, style: { borderRadius: '16px', bgColor: 'rgba(24,24,27,0.85)' } },
      { id: '4', type: 'speed-test', x: 50, y: 65, width: 45, height: 12, style: { bgColor: 'rgba(59,130,246,0.1)', accentColor: '#3b82f6' } },
      { id: '5', type: 'social-links', x: 50, y: 80, width: 40, height: 6, style: { iconColor: '#a1a1aa', spacing: '16px' }, social: { facebook: 'https://facebook.com/myisp', twitter: '', instagram: 'https://instagram.com/myisp' } },
      { id: '6', type: 'text', content: 'Enjoy your stay! 🎉', x: 50, y: 90, width: 50, height: 4, size: 'small', style: { color: '#71717a', fontSize: '12px', textAlign: 'center' } },
    ],
    styles: { bgType: 'gradient', bgColor1: '#0f172a', bgColor2: '#1e293b', accentColor: '#10b981', bgImage: '' },
    settings: { language: 'en', showTerms: true, showTimeout: true, redirectUrl: 'https://myisp.com/welcome' }
  }
};

/* ─── Language Translations ─── */
const translations = {
  en: {
    welcome: 'Welcome',
    username: 'Username',
    password: 'Password',
    connect: 'Connect',
    disconnect: 'Disconnect',
    login: 'Login',
    logout: 'Logout',
    termsAccept: 'I agree to the Terms of Service and Privacy Policy',
    termsRequired: 'You must accept the terms to continue',
    sessionTimeout: 'Your session will expire in',
    sessionExpired: 'Your session has expired',
    sessionWarning: 'You have {minutes} minutes remaining',
    continue: 'Continue',
    extend: 'Extend Session',
    speedTest: 'Test Your Speed',
    announcement: 'Announcement',
    followUs: 'Follow Us',
    needHelp: 'Need help? Contact support',
    freeTrial: 'Free Trial',
    buyPackage: 'Buy Package'
  },
  sw: {
    welcome: 'Karibu',
    username: 'Jina la mtumiaji',
    password: 'Nenosiri',
    connect: 'Unganisha',
    disconnect: 'Tenganisha',
    login: 'Ingia',
    logout: 'Ondoka',
    termsAccept: 'Ninakubali Masharti na Sera ya Faragha',
    termsRequired: 'Lazima ukubali masharti ili kuendelea',
    sessionTimeout: 'Muda wako utaisha ndani ya',
    sessionExpired: 'Muda wako umeisha',
    sessionWarning: 'Umebakiza dakika {minutes}',
    continue: 'Endelea',
    extend: 'Ongeza Muda',
    speedTest: 'Jaribu Kasi',
    announcement: 'Tangazo',
    followUs: 'Tufuate',
    needHelp: 'Unahitaji msaada? Wasiliana nasi',
    freeTrial: 'Jaribio la Bure',
    buyPackage: 'Nunua Kifurushi'
  },
  fr: {
    welcome: 'Bienvenue',
    username: 'Nom d\'utilisateur',
    password: 'Mot de passe',
    connect: 'Connecter',
    disconnect: 'Déconnecter',
    login: 'Connexion',
    logout: 'Déconnexion',
    termsAccept: 'J\'accepte les conditions d\'utilisation et la politique de confidentialité',
    termsRequired: 'Vous devez accepter les conditions pour continuer',
    sessionTimeout: 'Votre session expirera dans',
    sessionExpired: 'Votre session a expiré',
    sessionWarning: 'Il vous reste {minutes} minutes',
    continue: 'Continuer',
    extend: 'Prolonger',
    speedTest: 'Tester la vitesse',
    announcement: 'Annonce',
    followUs: 'Suivez-nous',
    needHelp: 'Besoin d\'aide? Contactez-nous',
    freeTrial: 'Essai gratuit',
    buyPackage: 'Acheter un forfait'
  }
};

export function CaptivePortalBuilder() {
  const toast = useToast();
  const [portals, setPortals] = useState([]);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(false);
  const [previewDevice, setPreviewDevice] = useState('mobile');
  const [elements, setElements] = useState([]);
  const [styles, setStyles] = useState({ bgType: 'solid', bgColor: '#0f1117', bgColor1: '#0f1117', bgColor2: '#1a1a2e', accentColor: '#3b82f6', bgImage: '', bgOverlay: 0.5 });
  const [selectedElement, setSelectedElement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [connections, setConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState('');
  const [settings, setSettings] = useState({ language: 'en', showTerms: false, showTimeout: true, redirectUrl: '', timeoutMinutes: 60, warningMinutes: 10 });
  
  // Drag and resize state
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize] = useState(5);
  
  // Undo/Redo state
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // BG Image upload
  const [bgImageFile, setBgImageFile] = useState(null);
  const fileInputRef = useRef(null);
  
  // Canvas ref for measurements
  const canvasRef = useRef(null);

  useEffect(() => {
    fetchPortals();
    axios.get(`${API}/mikrotik`).then(r => setConnections(r.data)).catch(() => {});
  }, []);

  // Save to history for undo
  const saveToHistory = useCallback((newElements) => {
    const snapshot = JSON.parse(JSON.stringify(newElements));
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(snapshot);
      const trimmed = newHistory.slice(-20);
      setHistoryIndex(trimmed.length - 1);
      return trimmed;
    });
  }, [historyIndex]);

  const undo = useCallback(() => {
    setHistory(prev => {
      setHistoryIndex(prevIdx => {
        if (prevIdx > 0) {
          const newIndex = prevIdx - 1;
          setElements(JSON.parse(JSON.stringify(prev[newIndex])));
          return newIndex;
        }
        return prevIdx;
      });
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setHistory(prev => {
      setHistoryIndex(prevIdx => {
        if (prevIdx < prev.length - 1) {
          const newIndex = prevIdx + 1;
          setElements(JSON.parse(JSON.stringify(prev[newIndex])));
          return newIndex;
        }
        return prevIdx;
      });
      return prev;
    });
  }, []);

  const fetchPortals = async () => {
    try {
      const { data } = await axios.get(`${API}/captive-portals`).catch(() => ({ data: [] }));
      setPortals(data);
    } catch (error) { console.error('Failed to fetch portals:', error); toast.error('Failed to load portals', error.response?.data?.error || error.message); }
  };

  /* ─── Template & Element Helpers ─── */
  const loadTemplate = (name) => {
    const t = templates[name];
    setElements(JSON.parse(JSON.stringify(t.elements)));
    setStyles({ ...t.styles });
    setSelectedElement(null);
    saveToHistory(JSON.parse(JSON.stringify(t.elements)));
  };

  const addElement = (type) => {
    const newEl = {
      id: Date.now().toString(),
      type,
      content: type === 'text' ? 'Your text here' : type === 'logo' ? 'MyISP' : type === 'button' ? 'Click Here' : '',
      x: 50, y: 50, width: type === 'login-form' ? 60 : undefined,
      style: { color: '#ffffff', fontSize: '14px', borderRadius: '8px' },
    };
    const newElements = [...elements, newEl];
    setElements(newElements);
    setSelectedElement(newEl.id);
    saveToHistory(newElements);
  };

  const updateElement = (id, updates) => {
    setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const updateElementStyle = (id, styleUpdates) => {
    setElements(elements.map(el => el.id === id ? { ...el, style: { ...el.style, ...styleUpdates } } : el));
  };

  const deleteElement = (id) => {
    const newElements = elements.filter(el => el.id !== id);
    setElements(newElements);
    if (selectedElement === id) setSelectedElement(null);
    saveToHistory(newElements);
  };

  const moveElement = (id, dir) => {
    const idx = elements.findIndex(el => el.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= elements.length) return;
    const newEls = [...elements];
    [newEls[idx], newEls[newIdx]] = [newEls[newIdx], newEls[idx]];
    setElements(newEls);
    saveToHistory(newEls);
  };

  const savePortal = async () => {
    if (!editing?.name && !editing) {
      const name = prompt('Portal name:', 'My HotSpot Portal');
      if (!name) return;
      setEditing({ name });
    }
    setLoading(true);
    try {
      await axios.post(`${API}/captive-portals`, {
        name: editing?.name || 'Untitled',
        elements,
        styles,
        settings,
        hotspot_profile: editing?.hotspot_profile || '',
        connection_id: selectedConnection,
      });
      fetchPortals();
      alert('Portal saved!');
    } catch (e) { alert('Failed to save: ' + (e.response?.data?.error || e.message)); }
    setLoading(false);
  };

  const pushToMikroTik = async () => {
    if (!selectedConnection) { alert('Select a router first'); return; }
    setLoading(true);
    try {
      const html = generateHTML();
      await axios.post(`${API}/captive-portals/push`, {
        connection_id: selectedConnection,
        html,
        profile: editing?.hotspot_profile || '',
      });
      alert('Portal pushed to MikroTik!');
    } catch (e) { alert('Push failed: ' + (e.response?.data?.error || e.message)); }
    setLoading(false);
  };

  /* ─── Alignment Guides (snap lines) ─── */
  const [guides, setGuides] = useState({ vertical: [], horizontal: [] });

  const computeGuides = useCallback((elId) => {
    const el = elements.find(e => e.id === elId);
    if (!el) return { vertical: [], horizontal: [] };
    const vertical = [];
    const horizontal = [];
    const snapThreshold = 5;
    const elCenterX = el.x + (el.width || 0) / 2;
    const elCenterY = el.y + 3; // approximate height

    elements.forEach(other => {
      if (other.id === elId) return;
      const otherCenterX = other.x + (other.width || 0) / 2;
      const otherCenterY = other.y + 3;
      if (Math.abs(elCenterX - otherCenterX) < snapThreshold) {
        vertical.push(otherCenterX);
      }
      if (Math.abs(el.y - other.y) < snapThreshold) {
        horizontal.push(other.y);
      }
      if (Math.abs(elCenterY - otherCenterY) < snapThreshold) {
        horizontal.push(otherCenterY);
      }
    });

    // Snap to center
    if (Math.abs(elCenterX - 50) < snapThreshold) vertical.push(50);
    if (Math.abs(el.y - 50) < snapThreshold) horizontal.push(50);

    return { vertical: [...new Set(vertical)], horizontal: [...new Set(horizontal)] };
  }, [elements]);

  const snapValue = useCallback((value, guides) => {
    if (!snapToGrid || guides.length === 0) return value;
    for (const g of guides) {
      if (Math.abs(value - g) < 5) return g;
    }
    return value;
  }, [snapToGrid]);

  /* ─── Drag Handlers ─── */
  const handleMouseDown = useCallback((e, elId) => {
    e.stopPropagation();
    const el = elements.find(el => el.id === elId);
    if (!el) return;
    setSelectedElement(elId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const canvasWidth = 375;
    const canvasHeight = 667;
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;
    const elPixelX = (el.x / 100) * canvasWidth;
    const elPixelY = (el.y / 100) * canvasHeight;
    setDragOffset({
      x: mouseX - elPixelX,
      y: mouseY - elPixelY,
    });
    setDragging(elId);
  }, [elements]);

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const canvasWidth = 375;
    const canvasHeight = 667;
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    let newX = ((mouseX - dragOffset.x) / canvasWidth) * 100;
    let newY = ((mouseY - dragOffset.y) / canvasHeight) * 100;

    // Snap to grid
    if (snapToGrid) {
      newX = Math.round(newX / gridSize) * gridSize;
      newY = Math.round(newY / gridSize) * gridSize;
    }

    // Snap to guides
    const currentGuides = computeGuides(dragging);
    newX = snapValue(newX, currentGuides.vertical);
    newY = snapValue(newY, currentGuides.horizontal);
    setGuides(currentGuides);

    // Clamp
    newX = Math.max(0, Math.min(100, newX));
    newY = Math.max(0, Math.min(95, newY));

    updateElement(dragging, { x: newX, y: newY });
  }, [dragging, dragOffset, snapToGrid, gridSize, computeGuides, snapValue]);

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      saveToHistory(elements);
    }
    setDragging(null);
    setGuides({ vertical: [], horizontal: [] });
  }, [dragging, elements, saveToHistory]);

  /* ─── Resize Handlers ─── */
  const handleResizeStart = useCallback((e, handle) => {
    e.stopPropagation();
    if (!selectedElement) return;
    const el = elements.find(el => el.id === selectedElement);
    if (!el) return;
    setResizing({ handle, startX: e.clientX, startY: e.clientY, startWidth: el.width || 20, startXPos: el.x });
  }, [selectedElement, elements]);

  const handleResizeMove = useCallback((e) => {
    if (!resizing || !selectedElement) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const canvasWidth = 375;
    const scaleX = canvasWidth / rect.width;
    const deltaX = (e.clientX - resizing.startX) * scaleX;
    const deltaPercent = (deltaX / canvasWidth) * 100;

    if (resizing.handle === 'right') {
      const newWidth = Math.max(5, resizing.startWidth + deltaPercent);
      updateElement(selectedElement, { width: Math.round(newWidth) });
    } else if (resizing.handle === 'left') {
      const newWidth = Math.max(5, resizing.startWidth - deltaPercent);
      const newX = resizing.startXPos + (resizing.startWidth - newWidth);
      updateElement(selectedElement, { width: Math.round(newWidth), x: Math.round(newX) });
    }
  }, [resizing, selectedElement]);

  const handleResizeUp = useCallback(() => {
    if (resizing) {
      saveToHistory(elements);
    }
    setResizing(null);
  }, [resizing, elements, saveToHistory]);

  /* ─── Global mouse up ─── */
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragging) {
        saveToHistory(elements);
      }
      if (resizing) {
        saveToHistory(elements);
      }
      setDragging(null);
      setResizing(null);
      setGuides({ vertical: [], horizontal: [] });
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [dragging, resizing, elements, saveToHistory]);

  /* ─── Keyboard shortcuts for undo/redo ─── */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      if (e.key === 'Delete' && selectedElement) {
        deleteElement(selectedElement);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedElement]);

  /* ─── Background Image Upload ─── */
  const handleBgImageUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      setBgImageFile(dataUrl);
      setStyles({ ...styles, bgImage: dataUrl, bgType: 'image' });
    };
    reader.readAsDataURL(file);
  }, [styles]);

  /* ─── Custom Widget Elements ─── */
  const customWidgetTypes = [
    { type: 'speed-test', icon: Wifi, label: 'Speed Test' },
    { type: 'promo-banner', icon: Bell, label: 'Promo Banner' },
    { type: 'announcement', icon: Globe, label: 'Announcement' },
    { type: 'social-links', icon: Facebook, label: 'Social Links' },
    { type: 'social-login', icon: Send, label: 'Social Login' },
  ];

  const addCustomElement = (type) => {
    const defaults = {
      id: Date.now().toString(),
      type,
      content: '',
      x: 50,
      y: 50,
      width: type === 'login-form' ? 60 : type === 'social-login' ? 50 : 50,
      style: {
        color: '#ffffff',
        fontSize: '14px',
        borderRadius: '12px',
        bgColor: 'rgba(24,24,27,0.8)',
        textColor: '#ffffff',
      },
      social: { facebook: '', twitter: '', instagram: '' },
    };

    switch (type) {
      case 'speed-test':
        defaults.content = 'Test Your Speed';
        defaults.style = { ...defaults.style, bgColor: 'rgba(59,130,246,0.1)', accentColor: '#3b82f6' };
        break;
      case 'promo-banner':
        defaults.content = 'Special Offer: 50% OFF!';
        defaults.style = { ...defaults.style, bgColor: 'rgba(251,191,36,0.1)', textColor: '#fbbf24' };
        break;
      case 'announcement':
        defaults.content = 'Free 30min trial available';
        defaults.style = { ...defaults.style, bgColor: 'rgba(16,185,129,0.1)', textColor: '#10b981' };
        break;
      case 'social-links':
        defaults.style = { ...defaults.style, iconColor: '#a1a1aa', spacing: '16px' };
        break;
      case 'social-login':
        defaults.width = 50;
        break;
      default:
        break;
    }

    const newEl = { ...defaults };
    setElements([...elements, newEl]);
    setSelectedElement(newEl.id);
    saveToHistory([...elements, newEl]);
  };

  /* ─── Element Content Rendering ─── */
  const renderElementContent = (el, isPreview = false) => {
    const t = translations[settings.language] || translations.en;

    switch (el.type) {
      case 'logo':
        return <div style={{ textAlign: 'center', ...el.style, color: el.style.color }}>{el.content}</div>;

      case 'text':
        return <div style={{ textAlign: 'center', ...el.style }}>{el.content}</div>;

      case 'image':
        return (
          <img
            src={el.content}
            alt=""
            style={{ maxWidth: '100%', borderRadius: el.style.borderRadius, opacity: el.style.opacity ?? 1, objectFit: 'cover' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        );

      case 'login-form': {
        const formBg = el.style.bgColor || 'rgba(24,24,27,0.8)';
        const radius = el.style.borderRadius || '16px';
        return (
          <div style={{
            background: formBg,
            backdropFilter: 'blur(16px)',
            borderRadius: radius,
            padding: '16px',
            border: '1px solid rgba(63,63,70,0.4)',
          }}>
            <div style={{ marginBottom: '8px' }}>
              <input
                readOnly={!isPreview}
                placeholder={t.username}
                style={{ width: '100%', padding: '8px 12px', background: 'rgba(39,39,42,0.6)', border: '1px solid rgba(63,63,70,0.6)', borderRadius: '8px', color: '#fff', fontSize: '12px', outline: 'none' }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <input
                readOnly={!isPreview}
                type="password"
                placeholder={t.password}
                style={{ width: '100%', padding: '8px 12px', background: 'rgba(39,39,42,0.6)', border: '1px solid rgba(63,63,70,0.6)', borderRadius: '8px', color: '#fff', fontSize: '12px', outline: 'none' }}
              />
            </div>
            {settings.showTerms && (
              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="checkbox" id={`terms-${el.id}`} style={{ accentColor: styles.accentColor }} />
                <label htmlFor={`terms-${el.id}`} style={{ color: '#a1a1aa', fontSize: '10px' }}>{t.termsAccept}</label>
              </div>
            )}
            <div style={{
              width: '100%', padding: '8px', background: styles.accentColor, borderRadius: '8px',
              color: '#fff', fontSize: '12px', textAlign: 'center', fontWeight: 600,
            }}>
              {t.connect}
            </div>
            {settings.showTimeout && (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: '#71717a', fontSize: '10px' }}>
                <Clock className="w-3 h-3" />
                <span>{t.sessionTimeout}: {settings.timeoutMinutes}m</span>
              </div>
            )}
          </div>
        );
      }

      case 'button':
        return (
          <div style={{
            display: 'inline-block', padding: '8px 16px',
            background: styles.accentColor, color: '#fff',
            borderRadius: '8px', fontSize: '12px', fontWeight: 500,
          }}>{el.content}</div>
        );

      case 'speed-test':
        return (
          <div style={{
            background: el.style.bgColor || 'rgba(59,130,246,0.1)',
            borderRadius: el.style.borderRadius || '12px',
            padding: '12px',
            textAlign: 'center',
            border: '1px solid rgba(59,130,246,0.2)',
          }}>
            <Wifi className="w-5 h-5 mx-auto mb-1" style={{ color: el.style.accentColor || '#3b82f6' }} />
            <div style={{ color: el.style.textColor || el.style.color || '#3b82f6', fontSize: '12px', fontWeight: 600 }}>
              {t.speedTest}
            </div>
            <div style={{ color: '#71717a', fontSize: '10px', marginTop: '2px' }}>Click to start</div>
          </div>
        );

      case 'promo-banner':
        return (
          <div style={{
            background: el.style.bgColor || 'rgba(251,191,36,0.1)',
            borderRadius: el.style.borderRadius || '12px',
            padding: '12px 16px',
            textAlign: 'center',
            border: '1px solid rgba(251,191,36,0.2)',
          }}>
            <div style={{ color: el.style.textColor || '#fbbf24', fontSize: '13px', fontWeight: 600 }}>
              {el.content}
            </div>
          </div>
        );

      case 'announcement':
        return (
          <div style={{
            background: el.style.bgColor || 'rgba(16,185,129,0.1)',
            borderRadius: el.style.borderRadius || '12px',
            padding: '12px 16px',
            textAlign: 'center',
            border: '1px solid rgba(16,185,129,0.2)',
          }}>
            <div style={{ color: el.style.textColor || '#10b981', fontSize: '12px' }}>
              {el.content}
            </div>
          </div>
        );

      case 'social-links': {
        const spacing = el.style.spacing || '16px';
        const iconColor = el.style.iconColor || '#a1a1aa';
        const social = el.social || { facebook: '', twitter: '', instagram: '' };
        return (
          <div style={{ display: 'flex', justifyContent: 'center', gap: spacing }}>
            {social.facebook && (
              <a href={social.facebook} target="_blank" rel="noopener noreferrer" style={{ color: iconColor }}>
                <Facebook className="w-4 h-4" />
              </a>
            )}
            {social.twitter && (
              <a href={social.twitter} target="_blank" rel="noopener noreferrer" style={{ color: iconColor }}>
                <Twitter className="w-4 h-4" />
              </a>
            )}
            {social.instagram && (
              <a href={social.instagram} target="_blank" rel="noopener noreferrer" style={{ color: iconColor }}>
                <Instagram className="w-4 h-4" />
              </a>
            )}
            {!social.facebook && !social.twitter && !social.instagram && (
              <div style={{ color: '#52525b', fontSize: '10px' }}>Configure social links in properties</div>
            )}
          </div>
        );
      }

      case 'social-login':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '8px', background: 'rgba(39,39,42,0.6)', border: '1px solid rgba(63,63,70,0.6)',
              borderRadius: '8px', color: '#fff', fontSize: '12px', cursor: 'pointer',
            }}>
              <Facebook className="w-4 h-4" style={{ color: '#1877f2' }} /> Continue with Facebook
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '8px', background: 'rgba(39,39,42,0.6)', border: '1px solid rgba(63,63,70,0.6)',
              borderRadius: '8px', color: '#fff', fontSize: '12px', cursor: 'pointer',
            }}>
              <Globe className="w-4 h-4" style={{ color: '#ea4335' }} /> Continue with Google
            </div>
          </div>
        );

      default:
        return <div style={{ ...el.style }}>{el.content}</div>;
    }
  };

  /* ─── Resize Handles Component ─── */
  const ResizeHandles = () => {
    if (!selectedElement) return null;
    const handleSize = 8;
    const handleStyle = (cursor) => ({
      position: 'absolute',
      width: handleSize,
      height: handleSize,
      background: '#3b82f6',
      border: '2px solid #fff',
      borderRadius: '50%',
      cursor,
      zIndex: 50,
    });

    return (
      <>
        <div
          style={{ ...handleStyle('ew-resize'), right: 0, top: '50%', transform: 'translateY(-50%)' }}
          onMouseDown={(e) => handleResizeStart(e, 'right')}
        />
        <div
          style={{ ...handleStyle('ew-resize'), left: 0, top: '50%', transform: 'translateY(-50%)' }}
          onMouseDown={(e) => handleResizeStart(e, 'left')}
        />
      </>
    );
  };

  /* ─── Alignment Guide Lines ─── */
  const GuideLines = () => {
    if (guides.vertical.length === 0 && guides.horizontal.length === 0) return null;
    return (
      <>
        {guides.vertical.map((v, i) => (
          <div
            key={`vg-${i}`}
            style={{
              position: 'absolute',
              left: `${v}%`,
              top: 0,
              bottom: 0,
              width: 1,
              background: 'rgba(59,130,246,0.5)',
              pointerEvents: 'none',
              zIndex: 40,
            }}
          />
        ))}
        {guides.horizontal.map((h, i) => (
          <div
            key={`hg-${i}`}
            style={{
              position: 'absolute',
              top: `${h}%`,
              left: 0,
              right: 0,
              height: 1,
              background: 'rgba(59,130,246,0.5)',
              pointerEvents: 'none',
              zIndex: 40,
            }}
          />
        ))}
      </>
    );
  };

  /* ─── Element List Item ─── */
  const ElementListItem = ({ el }) => {
    const iconMap = {
      logo: PaletteIcon, text: Type, 'login-form': FileText, image: Image,
      button: Square, 'speed-test': Wifi, 'promo-banner': Bell, announcement: Globe,
      'social-links': Facebook, 'social-login': Send,
    };
    const Icon = iconMap[el.type] || Square;
    return (
      <div
        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-all ${
          selectedElement === el.id ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-400 hover:bg-zinc-800/60'
        }`}
        onClick={() => setSelectedElement(el.id)}
      >
        <GripVertical className="w-3 h-3 text-zinc-600" />
        <Icon className="w-3.5 h-3.5" />
        <span className="flex-1 truncate capitalize">{el.type.replace('-', ' ')}</span>
        <button onClick={(e) => { e.stopPropagation(); moveElement(el.id, -1); }} className="p-0.5 hover:text-zinc-200">
          <ArrowUp className="w-3 h-3" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); moveElement(el.id, 1); }} className="p-0.5 hover:text-zinc-200">
          <ArrowDown className="w-3 h-3" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }} className="p-0.5 hover:text-rose-400">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    );
  };

  /* ─── Canvas Background ─── */
  const canvasBackground = () => {
    if (styles.bgType === 'image' && styles.bgImage) {
      return {
        backgroundImage: `url(${styles.bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    if (styles.bgType === 'gradient') {
      return {
        background: `linear-gradient(135deg, ${styles.bgColor1}, ${styles.bgColor2})`,
      };
    }
    return { background: styles.bgColor };
  };

  /* ─── Generate Enhanced HTML ─── */
  const generateHTML = () => {
    const t = translations[settings.language] || translations.en;
    let bgStyle = '';
    if (styles.bgType === 'image' && styles.bgImage) {
      bgStyle = `background-image:url('${styles.bgImage}');background-size:cover;background-position:center;`;
    } else if (styles.bgType === 'gradient') {
      bgStyle = `background:linear-gradient(135deg,${styles.bgColor1},${styles.bgColor2});`;
    } else {
      bgStyle = `background:${styles.bgColor};`;
    }

    let elementsHTML = elements.map(el => {
      const pos = `position:absolute;left:${el.x}%;top:${el.y}%;transform:translateX(-50%);${el.width ? `width:${el.width}%;` : ''}`;
      const st = Object.entries(el.style || {}).map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`).join(';');

      switch (el.type) {
        case 'logo':
        case 'text':
          return `<div style="${pos}${st}text-align:center;">${el.content}</div>`;
        case 'image':
          return `<img src="${el.content}" style="${pos}${st}max-width:100%;object-fit:cover;" />`;
        case 'login-form': {
          const formBg = el.style.bgColor || 'rgba(24,24,27,0.8)';
          const radius = el.style.borderRadius || '16px';
          const termsCheckbox = settings.showTerms
            ? `<div style="margin-bottom:12px;display:flex;align-items:center;gap:6px;">
                <input type="checkbox" id="terms" required style="accent-color:${styles.accentColor}" />
                <label for="terms" style="color:#a1a1aa;font-size:10px;">${t.termsAccept}</label>
              </div>`
            : '';
          const timeoutInfo = settings.showTimeout
            ? `<div style="margin-top:8px;text-align:center;color:#71717a;font-size:10px;display:flex;align-items:center;justify-content:center;gap:4px;">
                <span>Session timeout: ${settings.timeoutMinutes} min</span>
              </div>`
            : '';
          return `<div style="${pos}width:${el.width || 60}%;max-width:320px;">
            <div style="background:${formBg};backdrop-filter:blur(16px);border-radius:${radius};padding:24px;border:1px solid rgba(63,63,70,0.4);">
              <form action="$(link-login-only)" method="post">
                <input type="hidden" name="dst" value="$(link-orig)" />
                <input type="hidden" name="popup" value="true" />
                ${settings.redirectUrl ? `<input type="hidden" name="redirect" value="${settings.redirectUrl}" />` : ''}
                <div style="margin-bottom:12px;">
                  <input name="username" placeholder="${t.username}" style="width:100%;padding:12px 16px;background:rgba(39,39,42,0.6);border:1px solid rgba(63,63,70,0.6);border-radius:10px;color:#fff;font-size:14px;outline:none;" />
                </div>
                <div style="margin-bottom:16px;">
                  <input name="password" type="password" placeholder="${t.password}" style="width:100%;padding:12px 16px;background:rgba(39,39,42,0.6);border:1px solid rgba(63,63,70,0.6);border-radius:10px;color:#fff;font-size:14px;outline:none;" />
                </div>
                ${termsCheckbox}
                <button type="submit" style="width:100%;padding:12px;background:${styles.accentColor};color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">${t.connect}</button>
              </form>
              ${timeoutInfo}
              $(if error)<div style="margin-top:12px;padding:8px 12px;background:rgba(244,63,94,0.1);border:1px solid rgba(244,63,94,0.2);border-radius:8px;color:#f43f5e;font-size:12px;">$(error)</div>$(endif)
            </div>
          </div>`;
        }
        case 'button':
          return `<a href="${el.content}" style="${pos}${st}display:inline-block;padding:10px 24px;background:${styles.accentColor};color:#fff;border-radius:8px;text-decoration:none;font-weight:500;">${el.content}</a>`;
        case 'speed-test':
          return `<div style="${pos}background:${el.style.bgColor || 'rgba(59,130,246,0.1)'};border-radius:${el.style.borderRadius || '12px'};padding:16px;text-align:center;border:1px solid rgba(59,130,246,0.2);">
            <div style="color:${el.style.textColor || '#3b82f6'};font-weight:600;font-size:14px;">${t.speedTest}</div>
            <div style="color:#71717a;font-size:11px;margin-top:4px;">Click to start</div>
          </div>`;
        case 'promo-banner':
          return `<div style="${pos}background:${el.style.bgColor || 'rgba(251,191,36,0.1)'};border-radius:${el.style.borderRadius || '12px'};padding:12px 16px;text-align:center;border:1px solid rgba(251,191,36,0.2);">
            <div style="color:${el.style.textColor || '#fbbf24'};font-weight:600;font-size:13px;">${el.content}</div>
          </div>`;
        case 'announcement':
          return `<div style="${pos}background:${el.style.bgColor || 'rgba(16,185,129,0.1)'};border-radius:${el.style.borderRadius || '12px'};padding:12px 16px;text-align:center;border:1px solid rgba(16,185,129,0.2);">
            <div style="color:${el.style.textColor || '#10b981'};font-size:12px;">${el.content}</div>
          </div>`;
        case 'social-links': {
          const social = el.social || {};
          let icons = '';
          if (social.facebook) icons += `<a href="${social.facebook}" target="_blank" style="color:${el.style.iconColor || '#a1a1aa'};margin:0 8px;">Facebook</a> `;
          if (social.twitter) icons += `<a href="${social.twitter}" target="_blank" style="color:${el.style.iconColor || '#a1a1aa'};margin:0 8px;">Twitter</a> `;
          if (social.instagram) icons += `<a href="${social.instagram}" target="_blank" style="color:${el.style.iconColor || '#a1a1aa'};margin:0 8px;">Instagram</a> `;
          return `<div style="${pos}text-align:center;">${icons}</div>`;
        }
        case 'social-login':
          return `<div style="${pos}display:flex;flex-direction:column;gap:8px;width:100%;max-width:280px;">
            <button style="padding:10px;background:rgba(39,39,42,0.6);border:1px solid rgba(63,63,70,0.6);border-radius:8px;color:#fff;font-size:13px;cursor:pointer;text-align:center;">Continue with Facebook</button>
            <button style="padding:10px;background:rgba(39,39,42,0.6);border:1px solid rgba(63,63,70,0.6);border-radius:8px;color:#fff;font-size:13px;cursor:pointer;text-align:center;">Continue with Google</button>
          </div>`;
        default: return `<div style="${pos}${st}">${el.content}</div>`;
      }
    }).join('\n');

    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HotSpot Login</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{height:100%;overflow:hidden;}
  body{${bgStyle}font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;position:relative;}
  .container{position:relative;width:100%;height:100%;max-width:480px;margin:0 auto;}
  @media(max-width:480px){.container{width:100%;}}
</style></head><body>
<div class="container">${elementsHTML}</div>
</body></html>`;
  };

  const selectedEl = elements.find(el => el.id === selectedElement);

  return (
    <div className="relative min-h-full p-8 animate-fade-in">
      <div className="absolute inset-0 bg-mesh" />
      <div className="absolute inset-0 bg-noise" />

      {/* Header */}
      <div className="relative flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Palette className="w-4 h-4 text-white" />
            </div>
            Captive Portal Builder
          </h1>
          <p className="text-zinc-400 mt-1">Design and deploy branded WiFi login pages to MikroTik hotspots</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 mr-2">
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className={`btn-ghost p-2 ${historyIndex <= 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
              title="Undo (Ctrl+Z)"
            >
              <Undo className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className={`btn-ghost p-2 ${historyIndex >= history.length - 1 ? 'opacity-40 cursor-not-allowed' : ''}`}
              title="Redo (Ctrl+Y)"
            >
              <Redo className="w-4 h-4" />
            </button>
          </div>
          <select value={selectedConnection} onChange={e => setSelectedConnection(e.target.value)} className="modern-input text-sm py-2">
            <option value="">Select router...</option>
            {connections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={savePortal} disabled={loading} className="btn-secondary">
            <Save className="w-4 h-4" /> Save
          </button>
          <button onClick={pushToMikroTik} disabled={loading} className="btn-primary">
            <Upload className="w-4 h-4" /> Push to Router
          </button>
        </div>
      </div>

      <div className="relative grid grid-cols-12 gap-6">
        {/* Left Panel - Elements */}
        <div className="col-span-2 glass rounded-2xl p-4 max-h-[calc(100vh-140px)] overflow-y-auto">
          <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
            <Layout className="w-4 h-4" /> Elements
          </h3>
          <div className="space-y-1.5">
            {[
              { type: 'logo', icon: PaletteIcon, label: 'Logo' },
              { type: 'text', icon: Type, label: 'Text' },
              { type: 'login-form', icon: FileText, label: 'Login Form' },
              { type: 'image', icon: Image, label: 'Image' },
              { type: 'button', icon: Square, label: 'Button' },
            ].map(item => (
              <button key={item.type} onClick={() => { addElement(item.type); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all">
                <item.icon className="w-4 h-4" /> {item.label}
              </button>
            ))}
          </div>

          <h3 className="text-sm font-medium text-zinc-300 mt-6 mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4" /> Widgets
          </h3>
          <div className="space-y-1.5">
            {customWidgetTypes.map(item => (
              <button key={item.type} onClick={() => addCustomElement(item.type)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all">
                <item.icon className="w-4 h-4" /> {item.label}
              </button>
            ))}
          </div>

          <h3 className="text-sm font-medium text-zinc-300 mt-6 mb-3">Templates</h3>
          <div className="space-y-1.5">
            {Object.keys(templates).map(name => (
              <button key={name} onClick={() => { loadTemplate(name); }}
                className="w-full px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 capitalize transition-all">
                {name}
              </button>
            ))}
          </div>

          {/* Element List */}
          {elements.length > 0 && (
            <>
              <h3 className="text-sm font-medium text-zinc-300 mt-6 mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4" /> Layers ({elements.length})
              </h3>
              <div className="space-y-1">
                {elements.map(el => <ElementListItem key={el.id} el={el} />)}
              </div>
            </>
          )}
        </div>

        {/* Canvas */}
        <div className="col-span-7">
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                Canvas
                {showGrid && <span className="text-xs text-zinc-500">({gridSize}% grid)</span>}
              </h3>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => setShowGrid(!showGrid)}
                  className={`btn-ghost text-xs py-1 px-2 ${showGrid ? 'text-blue-400' : ''}`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setSnapToGrid(!snapToGrid)}
                  className={`btn-ghost text-xs py-1 px-2 ${snapToGrid ? 'text-blue-400' : ''}`}
                >
                  Snap
                </button>
                <div className="w-px h-4 bg-zinc-700" />
                <button onClick={() => setPreview(true)} className="btn-ghost text-xs py-1 px-2">
                  <Eye className="w-3.5 h-3.5" /> Preview
                </button>
              </div>
            </div>

            {/* Phone Preview */}
            <div
              ref={canvasRef}
              className="relative mx-auto select-none"
              style={{ width: 375, height: 667 }}
              onMouseMove={handleMouseMove}
            >
              {/* Phone Frame */}
              <div className="absolute inset-0 rounded-[32px] border-[3px] border-zinc-700 overflow-hidden shadow-2xl">
                {/* Background */}
                <div className="absolute inset-0" style={canvasBackground()} />

                {/* Grid Overlay */}
                {showGrid && (
                  <div className="absolute inset-0 pointer-events-none opacity-20" style={{
                    backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                    backgroundSize: `${(gridSize / 100) * 375}px ${gridSize * 6.67}px`,
                  }} />
                )}

                {/* Alignment Guides */}
                <GuideLines />

                {/* Elements */}
                {elements.map((el) => (
                  <div
                    key={el.id}
                    onClick={(e) => { e.stopPropagation(); setSelectedElement(el.id); }}
                    onMouseDown={(e) => handleMouseDown(e, el.id)}
                    className={`absolute cursor-move transition-shadow ${
                      selectedElement === el.id
                        ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-transparent'
                        : 'hover:ring-1 hover:ring-zinc-500'
                    } ${dragging === el.id ? 'opacity-80 z-50' : 'z-10'}`}
                    style={{
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      transform: 'translateX(-50%)',
                      width: el.width ? `${el.width}%` : 'auto',
                    }}
                  >
                    {renderElementContent(el)}
                    {selectedElement === el.id && <ResizeHandles />}
                  </div>
                ))}
              </div>
            </div>

            {/* Canvas click to deselect */}
            <div
              className="absolute inset-0"
              style={{ zIndex: 0 }}
              onClick={() => setSelectedElement(null)}
            />
          </div>
        </div>

        {/* Right Panel - Properties */}
        <div className="col-span-3 glass rounded-2xl p-4 max-h-[calc(100vh-140px)] overflow-y-auto">
          <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
            <Settings className="w-4 h-4" /> Properties
          </h3>

          {selectedEl ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Type</label>
                <div className="text-sm text-white capitalize">{selectedEl.type.replace('-', ' ')}</div>
              </div>

              {/* Content editing for text-based elements */}
              {(selectedEl.type === 'text' || selectedEl.type === 'logo' || selectedEl.type === 'button' ||
                selectedEl.type === 'promo-banner' || selectedEl.type === 'announcement' || selectedEl.type === 'speed-test') && (
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Content</label>
                  <textarea
                    value={selectedEl.content}
                    onChange={e => updateElement(selectedEl.id, { content: e.target.value })}
                    className="modern-input text-xs py-1.5 w-full resize-none"
                    rows={2}
                  />
                </div>
              )}

              {selectedEl.type === 'image' && (
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Image URL</label>
                  <input value={selectedEl.content} onChange={e => updateElement(selectedEl.id, { content: e.target.value })} className="modern-input text-xs py-1.5" placeholder="https://..." />
                </div>
              )}

              {/* Social Links editing */}
              {selectedEl.type === 'social-links' && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Facebook URL</label>
                    <input
                      value={selectedEl.social?.facebook || ''}
                      onChange={e => updateElement(selectedEl.id, {
                        social: { ...selectedEl.social, facebook: e.target.value }
                      })}
                      className="modern-input text-xs py-1.5"
                      placeholder="https://facebook.com/..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Twitter URL</label>
                    <input
                      value={selectedEl.social?.twitter || ''}
                      onChange={e => updateElement(selectedEl.id, {
                        social: { ...selectedEl.social, twitter: e.target.value }
                      })}
                      className="modern-input text-xs py-1.5"
                      placeholder="https://twitter.com/..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Instagram URL</label>
                    <input
                      value={selectedEl.social?.instagram || ''}
                      onChange={e => updateElement(selectedEl.id, {
                        social: { ...selectedEl.social, instagram: e.target.value }
                      })}
                      className="modern-input text-xs py-1.5"
                      placeholder="https://instagram.com/..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Icon Color</label>
                    <input type="color" value={selectedEl.style.iconColor || '#a1a1aa'} onChange={e => updateElementStyle(selectedEl.id, { iconColor: e.target.value })} className="w-full h-8 rounded-lg cursor-pointer bg-transparent" />
                  </div>
                </div>
              )}

              {/* Position */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">X Position (%)</label>
                  <input type="number" value={Math.round(selectedEl.x)} onChange={e => updateElement(selectedEl.id, { x: parseInt(e.target.value) || 0 })} className="modern-input text-xs py-1.5" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Y Position (%)</label>
                  <input type="number" value={Math.round(selectedEl.y)} onChange={e => updateElement(selectedEl.id, { y: parseInt(e.target.value) || 0 })} className="modern-input text-xs py-1.5" />
                </div>
              </div>

              {/* Width */}
              {selectedEl.width !== undefined && (
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Width (%)</label>
                  <input type="number" value={Math.round(selectedEl.width)} onChange={e => updateElement(selectedEl.id, { width: parseInt(e.target.value) || 10 })} className="modern-input text-xs py-1.5" />
                </div>
              )}

              {/* Text Styling */}
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Text Color</label>
                <input type="color" value={selectedEl.style.color || '#ffffff'} onChange={e => updateElementStyle(selectedEl.id, { color: e.target.value })} className="w-full h-8 rounded-lg cursor-pointer bg-transparent" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Font Size</label>
                <input value={selectedEl.style.fontSize || '14px'} onChange={e => updateElementStyle(selectedEl.id, { fontSize: e.target.value })} className="modern-input text-xs py-1.5" placeholder="14px" />
              </div>

              {/* Background for specific types */}
              {(selectedEl.type === 'login-form' || selectedEl.type === 'promo-banner' || selectedEl.type === 'announcement' || selectedEl.type === 'speed-test') && (
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Background</label>
                  <input type="color" value={selectedEl.style.bgColor || '#18181b'} onChange={e => updateElementStyle(selectedEl.id, { bgColor: e.target.value })} className="w-full h-8 rounded-lg cursor-pointer bg-transparent" />
                </div>
              )}

              {/* Text color for widgets */}
              {(selectedEl.type === 'promo-banner' || selectedEl.type === 'announcement' || selectedEl.type === 'speed-test') && (
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Text Color</label>
                  <input type="color" value={selectedEl.style.textColor || '#ffffff'} onChange={e => updateElementStyle(selectedEl.id, { textColor: e.target.value })} className="w-full h-8 rounded-lg cursor-pointer bg-transparent" />
                </div>
              )}

              {/* Border Radius */}
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Border Radius</label>
                <input value={selectedEl.style.borderRadius || '8px'} onChange={e => updateElementStyle(selectedEl.id, { borderRadius: e.target.value })} className="modern-input text-xs py-1.5" placeholder="12px" />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-zinc-800/50">
                <button onClick={() => moveElement(selectedEl.id, -1)} className="btn-ghost p-1.5 flex-1" title="Move Up"><MoveUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => moveElement(selectedEl.id, 1)} className="btn-ghost p-1.5 flex-1" title="Move Down"><MoveDown className="w-3.5 h-3.5" /></button>
                <button onClick={() => { if (selectedEl) { const copy = { ...selectedEl, id: Date.now().toString() }; setElements([...elements, copy]); setSelectedElement(copy.id); } }} className="btn-ghost p-1.5 flex-1" title="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
                <button onClick={() => deleteElement(selectedEl.id)} className="btn-ghost p-1.5 flex-1 text-rose-400" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ) : (
            /* Global Styles */
            <div className="space-y-4">
              <div className="text-xs text-zinc-500">Select an element to edit its properties</div>

              <div className="border-t border-zinc-800/50 pt-4">
                <h4 className="text-xs text-zinc-400 mb-2">Background</h4>
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    {['solid', 'gradient', 'image'].map(type => (
                      <button key={type} onClick={() => setStyles({ ...styles, bgType: type })}
                        className={`flex-1 px-2 py-1 rounded text-xs capitalize transition-all ${
                          styles.bgType === type ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}>
                        {type}
                      </button>
                    ))}
                  </div>
                  {styles.bgType === 'solid' && (
                    <input type="color" value={styles.bgColor} onChange={e => setStyles({ ...styles, bgColor: e.target.value })} className="w-full h-8 rounded-lg cursor-pointer bg-transparent" />
                  )}
                  {styles.bgType === 'gradient' && (
                    <>
                      <input type="color" value={styles.bgColor1} onChange={e => setStyles({ ...styles, bgColor1: e.target.value })} className="w-full h-8 rounded-lg cursor-pointer bg-transparent" />
                      <input type="color" value={styles.bgColor2} onChange={e => setStyles({ ...styles, bgColor2: e.target.value })} className="w-full h-8 rounded-lg cursor-pointer bg-transparent" />
                    </>
                  )}
                  {styles.bgType === 'image' && (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleBgImageUpload}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full px-3 py-2 rounded-lg text-xs bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
                      >
                        <Upload className="w-3.5 h-3.5" /> Upload Background Image
                      </button>
                      {styles.bgImage && (
                        <div className="mt-2">
                          <img src={styles.bgImage} alt="Background" className="w-full h-20 object-cover rounded-lg" />
                          <button
                            onClick={() => setStyles({ ...styles, bgImage: '', bgType: 'solid' })}
                            className="mt-1 text-xs text-rose-400 hover:text-rose-300"
                          >
                            Remove background
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-zinc-800/50 pt-4">
                <h4 className="text-xs text-zinc-400 mb-2">Accent Color</h4>
                <input type="color" value={styles.accentColor} onChange={e => setStyles({ ...styles, accentColor: e.target.value })} className="w-full h-8 rounded-lg cursor-pointer bg-transparent" />
              </div>

              {/* Portal Settings */}
              <div className="border-t border-zinc-800/50 pt-4 space-y-3">
                <h4 className="text-xs text-zinc-400 mb-2 flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5" /> Portal Settings
                </h4>

                {/* Language */}
                <div>
                  <label className="block text-xs text-zinc-500 mb-1 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Language
                  </label>
                  <select
                    value={settings.language}
                    onChange={e => setSettings({ ...settings, language: e.target.value })}
                    className="modern-input text-xs py-1.5 w-full"
                  >
                    <option value="en">English</option>
                    <option value="sw">Kiswahili</option>
                    <option value="fr">French</option>
                  </select>
                </div>

                {/* Redirect URL */}
                <div>
                  <label className="block text-xs text-zinc-500 mb-1 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> Redirect URL
                  </label>
                  <input
                    value={settings.redirectUrl}
                    onChange={e => setSettings({ ...settings, redirectUrl: e.target.value })}
                    className="modern-input text-xs py-1.5 w-full"
                    placeholder="https://example.com"
                  />
                </div>

                {/* Session Timeout */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Timeout (min)
                    </label>
                    <input
                      type="number"
                      value={settings.timeoutMinutes}
                      onChange={e => setSettings({ ...settings, timeoutMinutes: parseInt(e.target.value) || 60 })}
                      className="modern-input text-xs py-1.5 w-full"
                      min={1}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1 flex items-center gap-1">
                      <Bell className="w-3 h-3" /> Warning (min)
                    </label>
                    <input
                      type="number"
                      value={settings.warningMinutes}
                      onChange={e => setSettings({ ...settings, warningMinutes: parseInt(e.target.value) || 10 })}
                      className="modern-input text-xs py-1.5 w-full"
                      min={1}
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showTerms}
                      onChange={e => setSettings({ ...settings, showTerms: e.target.checked })}
                      className="rounded"
                      style={{ accentColor: '#3b82f6' }}
                    />
                    <Shield className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-xs text-zinc-300">Terms & Privacy Acceptance</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showTimeout}
                      onChange={e => setSettings({ ...settings, showTimeout: e.target.checked })}
                      className="rounded"
                      style={{ accentColor: '#3b82f6' }}
                    />
                    <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-xs text-zinc-300">Session Timeout Warning</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {preview && (
        <div className="modal-backdrop" onClick={() => setPreview(false)}>
          <div className="glass-strong rounded-2xl w-full max-w-md animate-fade-in-scale" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-800/50 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Eye className="w-4 h-4" /> Portal Preview
              </h3>
              <div className="flex items-center gap-2">
                {/* Device selector */}
                <div className="flex gap-1 mr-2">
                  <button
                    onClick={() => setPreviewDevice('mobile')}
                    className={`p-1.5 rounded ${previewDevice === 'mobile' ? 'bg-blue-600/30 text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPreviewDevice('tablet')}
                    className={`p-1.5 rounded ${previewDevice === 'tablet' ? 'bg-blue-600/30 text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button onClick={() => setPreview(false)} className="btn-ghost p-2">✕</button>
              </div>
            </div>
            <div className="p-4 flex justify-center">
              <div
                className="relative rounded-[32px] border-[3px] border-zinc-700 overflow-hidden shadow-2xl"
                style={{
                  width: previewDevice === 'mobile' ? 375 : 768,
                  height: previewDevice === 'mobile' ? 667 : 1024,
                  maxWidth: '100%',
                }}
              >
                <div className="absolute inset-0" style={canvasBackground()}>
                  {elements.map(el => (
                    <div key={el.id} style={{ position: 'absolute', left: `${el.x}%`, top: `${el.y}%`, transform: 'translateX(-50%)', width: el.width ? `${el.width}%` : 'auto', zIndex: 10 }}>
                      {renderElementContent(el, true)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-zinc-800/50 flex gap-2">
              <button
                onClick={() => { try { const html = generateHTML(); const blob = new Blob([html], { type: 'text/html' }); const url = URL.createObjectURL(blob); window.open(url); } catch (e) { alert('Failed to generate preview'); } }}
                className="btn-secondary flex-1 text-xs"
              >
                <Download className="w-3.5 h-3.5" /> Open HTML
              </button>
              <button
                onClick={() => { try { navigator.clipboard.writeText(generateHTML()); alert('HTML copied to clipboard!'); } catch (e) { alert('Failed to copy'); } }}
                className="btn-secondary flex-1 text-xs"
              >
                <Clipboard className="w-3.5 h-3.5" /> Copy HTML
              </button>
              <button
                onClick={() => { try { const html = generateHTML(); const blob = new Blob([html], { type: 'text/html' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'portal.html'; a.click(); } catch (e) { alert('Failed to download'); } }}
                className="btn-secondary flex-1 text-xs"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
