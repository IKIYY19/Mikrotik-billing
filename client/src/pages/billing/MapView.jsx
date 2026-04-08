import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || '/api';

export function MapView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    fetchData();
    // Load Leaflet CSS and JS dynamically
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => initMap();
    document.head.appendChild(script);
  }, []);

  const fetchData = async () => {
    try {
      const { data } = await axios.get(`${API}/advanced/map/data`);
      setData(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const initMap = () => {
    if (!data || !window.L || mapInstanceRef.current) return;

    const map = window.L.map(mapRef.current).setView(data.center || [-1.2921, 36.8219], data.zoom || 10);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    mapInstanceRef.current = map;
    renderMarkers();
  };

  const renderMarkers = () => {
    if (!mapInstanceRef.current || !window.L || !data) return;

    // Clear existing markers
    markersRef.current.forEach(m => mapInstanceRef.current.removeLayer(m));
    markersRef.current = [];

    const filteredCustomers = filter === 'all' ? data.customers : data.customers.filter(c => c.status === filter);

    // Branch markers (larger)
    data.branches.forEach(branch => {
      const icon = window.L.divIcon({
        html: `<div style="background:#3b82f6;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
        className: '',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      const marker = window.L.marker([branch.lat, branch.lng], { icon })
        .bindPopup(`
          <b>${branch.name}</b><br/>
          City: ${branch.city}<br/>
          Active PPPoE: ${branch.active_pppoe}<br/>
          Routers: ${branch.online_routers}/${branch.total_routers} online
        `)
        .addTo(mapInstanceRef.current);
      markersRef.current.push(marker);
    });

    // Customer markers
    filteredCustomers.forEach(customer => {
      const color = customer.status === 'active' ? '#22c55e' : customer.status === 'throttled' ? '#f59e0b' : '#ef4444';
      const icon = window.L.divIcon({
        html: `<div style="background:${color};width:10px;height:10px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
        className: '',
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });
      const marker = window.L.marker([customer.lat, customer.lng], { icon })
        .bindPopup(`
          <b>${customer.name}</b><br/>
          Status: <span style="color:${color}">${customer.status}</span><br/>
          Plan: ${customer.plan || 'N/A'}<br/>
          Phone: ${customer.phone || 'N/A'}<br/>
          <button onclick="window._selectCustomer('${customer.id}')" style="margin-top:4px;padding:2px 8px;background:#3b82f6;color:white;border:none;border-radius:3px;cursor:pointer">View Details</button>
        `)
        .addTo(mapInstanceRef.current);
      markersRef.current.push(marker);
    });
  };

  useEffect(() => { renderMarkers(); }, [data, filter]);

  window._selectCustomer = (id) => {
    const customer = data?.customers.find(c => c.id === id);
    if (customer) setSelectedCustomer(customer);
  };

  if (loading) return <div className="p-8 text-white">Loading map...</div>;

  const stats = {
    total: data?.customers?.length || 0,
    active: data?.customers?.filter(c => c.status === 'active').length || 0,
    throttled: data?.customers?.filter(c => c.status === 'throttled').length || 0,
    suspended: data?.customers?.filter(c => c.status === 'suspended').length || 0,
    branches: data?.branches?.length || 0,
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-white font-semibold">Network Map</h3>
          <p className="text-xs text-slate-400 mt-1">Customer & Branch locations</p>
        </div>

        {/* Stats */}
        <div className="p-4 grid grid-cols-2 gap-2">
          <div className="bg-green-600/10 border border-green-600/30 rounded p-2 text-center">
            <div className="text-xl font-bold text-green-400">{stats.active}</div>
            <div className="text-xs text-slate-400">Active</div>
          </div>
          <div className="bg-amber-600/10 border border-amber-600/30 rounded p-2 text-center">
            <div className="text-xl font-bold text-amber-400">{stats.throttled}</div>
            <div className="text-xs text-slate-400">Throttled</div>
          </div>
          <div className="bg-red-600/10 border border-red-600/30 rounded p-2 text-center">
            <div className="text-xl font-bold text-red-400">{stats.suspended}</div>
            <div className="text-xs text-slate-400">Suspended</div>
          </div>
          <div className="bg-blue-600/10 border border-blue-600/30 rounded p-2 text-center">
            <div className="text-xl font-bold text-blue-400">{stats.branches}</div>
            <div className="text-xs text-slate-400">Branches</div>
          </div>
        </div>

        {/* Filter */}
        <div className="p-4 border-t border-slate-700">
          <div className="flex gap-1 flex-wrap">
            {['all', 'active', 'throttled', 'suspended'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-xs capitalize ${
                  filter === f ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Customer list */}
        <div className="flex-1 overflow-y-auto p-4">
          {data?.customers?.filter(c => filter === 'all' || c.status === filter).map(c => (
            <div key={c.id} onClick={() => setSelectedCustomer(c)}
              className={`p-2 rounded mb-1 cursor-pointer text-sm flex items-center gap-2 ${
                selectedCustomer?.id === c.id ? 'bg-blue-600/20 border border-blue-600/50' : 'bg-slate-700/50 hover:bg-slate-700'
              }`}>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                c.status === 'active' ? 'bg-green-500' : c.status === 'throttled' ? 'bg-amber-500' : 'bg-red-500'
              }`} />
              <div className="truncate">
                <div className="text-white text-xs truncate">{c.name}</div>
                <div className="text-slate-500 text-xs">{c.plan || 'No plan'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="absolute inset-0" />
        {selectedCustomer && (
          <div className="absolute bottom-4 left-4 right-4 bg-slate-800 border border-slate-700 rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="text-white font-semibold">{selectedCustomer.name}</div>
              <div className="text-sm text-slate-400">{selectedCustomer.phone} • {selectedCustomer.plan}</div>
            </div>
            <button onClick={() => setSelectedCustomer(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
        )}
      </div>
    </div>
  );
}
