import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Copy, X } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "/api";
const GMAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || "";

export function MapView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [clickedCoords, setClickedCoords] = useState(null);
  const [coordCopied, setCoordCopied] = useState(false);
  const clickMarkerRef = useRef(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!GMAPS_KEY) return;
    if (window.google?.maps) return;
    if (document.getElementById("gmaps-script")) return;
    const script = document.createElement("script");
    script.id = "gmaps-script";
    script.src =
      "https://maps.googleapis.com/maps/api/js?key=" +
      GMAPS_KEY +
      "&libraries=places";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (data && window.google?.maps) initMap();
  }, [data]);

  const fetchData = async () => {
    try {
      const { data } = await axios.get(`${API}/advanced/map/data`);
      setData(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const initMap = () => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = new window.google.maps.Map(mapRef.current, {
      center: data.center || { lat: -1.2921, lng: 36.8219 },
      zoom: data.zoom || 10,
      mapTypeControl: false,
      fullscreenControl: false,
    });
    mapInstanceRef.current = map;

    map.addListener("click", (e) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setClickedCoords({ lat: lat.toFixed(6), lng: lng.toFixed(6) });
      if (clickMarkerRef.current) clickMarkerRef.current.setMap(null);
      clickMarkerRef.current = new window.google.maps.Marker({
        map,
        position: { lat, lng },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: "#f59e0b",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      });
    });

    renderMarkers();
  };

  const renderMarkers = () => {
    if (!mapInstanceRef.current || !data) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const customers = Array.isArray(data.customers) ? data.customers : [];
    const branches = Array.isArray(data.branches) ? data.branches : [];
    const filteredCustomers =
      filter === "all"
        ? customers
        : customers.filter((c) => c.status === filter);
    const customersWithCoords = filteredCustomers.filter(
      (c) => c.lat != null && c.lng != null,
    );

    // Branch markers (blue circles)
    branches.forEach((branch) => {
      const marker = new window.google.maps.Marker({
        map: mapInstanceRef.current,
        position: { lat: branch.lat, lng: branch.lng },
        title: branch.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#3b82f6",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      });
      const info = new window.google.maps.InfoWindow({
        content:
          "<b>" +
          branch.name +
          "</b><br/>City: " +
          (branch.city || "") +
          "<br/>Active PPPoE: " +
          (branch.active_pppoe || 0) +
          "<br/>Routers: " +
          (branch.online_routers || 0) +
          "/" +
          (branch.total_routers || 0) +
          " online",
      });
      marker.addListener("click", () =>
        info.open(mapInstanceRef.current, marker),
      );
      markersRef.current.push(marker);
    });

    // Customer markers
    customersWithCoords.forEach((customer) => {
      const color =
        customer.status === "active"
          ? "#22c55e"
          : customer.status === "throttled"
            ? "#f59e0b"
            : "#ef4444";
      const marker = new window.google.maps.Marker({
        map: mapInstanceRef.current,
        position: { lat: customer.lat, lng: customer.lng },
        title: customer.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 5,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 1.5,
        },
      });
      const info = new window.google.maps.InfoWindow({
        content:
          "<b>" +
          customer.name +
          "</b><br/>Status: <span style='color:" +
          color +
          "'>" +
          customer.status +
          "</span><br/>Plan: " +
          (customer.plan || "N/A") +
          "<br/>Phone: " +
          (customer.phone || "N/A"),
      });
      marker.addListener("click", () => {
        info.open(mapInstanceRef.current, marker);
        setSelectedCustomer(customer);
      });
      markersRef.current.push(marker);
    });
  };

  useEffect(() => {
    renderMarkers();
  }, [data, filter]);

  if (loading) return <div className="p-8 text-white">Loading map...</div>;

  const stats = {
    total: data?.customers?.length || 0,
    active: data?.customers?.filter((c) => c.status === "active").length || 0,
    throttled:
      data?.customers?.filter((c) => c.status === "throttled").length || 0,
    suspended:
      data?.customers?.filter((c) => c.status === "suspended").length || 0,
    branches: data?.branches?.length || 0,
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-white font-semibold">Network Map</h3>
          <p className="text-xs text-slate-400 mt-1">
            Customer & Branch locations
          </p>
        </div>

        {/* Stats */}
        <div className="p-4 grid grid-cols-2 gap-2">
          <div className="bg-green-600/10 border border-green-600/30 rounded p-2 text-center">
            <div className="text-xl font-bold text-green-400">
              {stats.active}
            </div>
            <div className="text-xs text-slate-400">Active</div>
          </div>
          <div className="bg-amber-600/10 border border-amber-600/30 rounded p-2 text-center">
            <div className="text-xl font-bold text-amber-400">
              {stats.throttled}
            </div>
            <div className="text-xs text-slate-400">Throttled</div>
          </div>
          <div className="bg-red-600/10 border border-red-600/30 rounded p-2 text-center">
            <div className="text-xl font-bold text-red-400">
              {stats.suspended}
            </div>
            <div className="text-xs text-slate-400">Suspended</div>
          </div>
          <div className="bg-blue-600/10 border border-blue-600/30 rounded p-2 text-center">
            <div className="text-xl font-bold text-blue-400">
              {stats.branches}
            </div>
            <div className="text-xs text-slate-400">Branches</div>
          </div>
        </div>

        {/* Filter */}
        <div className="p-4 border-t border-slate-700">
          <div className="flex gap-1 flex-wrap">
            {["all", "active", "throttled", "suspended"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-xs capitalize ${
                  filter === f
                    ? "bg-blue-600 text-white"
                    : "bg-slate-700 text-slate-300"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Customer list */}
        <div className="flex-1 overflow-y-auto p-4">
          {data?.customers
            ?.filter((c) => filter === "all" || c.status === filter)
            .map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedCustomer(c)}
                className={`p-2 rounded mb-1 cursor-pointer text-sm flex items-center gap-2 ${
                  selectedCustomer?.id === c.id
                    ? "bg-blue-600/20 border border-blue-600/50"
                    : "bg-slate-700/50 hover:bg-slate-700"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    c.status === "active"
                      ? "bg-green-500"
                      : c.status === "throttled"
                        ? "bg-amber-500"
                        : "bg-red-500"
                  }`}
                />
                <div className="truncate">
                  <div className="text-white text-xs truncate">{c.name}</div>
                  <div className="text-slate-500 text-xs">
                    {c.plan || "No plan"}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="absolute inset-0" />
        {clickedCoords && (
          <div className="absolute top-4 right-4 bg-slate-800 border border-amber-500/30 rounded-lg p-3 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-amber-400 font-semibold">
                Clicked Location
              </span>
              <button
                onClick={() => {
                  if (clickMarkerRef.current)
                    clickMarkerRef.current.setMap(null);
                  setClickedCoords(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="font-mono text-xs text-white">
              {clickedCoords.lat}, {clickedCoords.lng}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `${clickedCoords.lat}, ${clickedCoords.lng}`,
                );
                setCoordCopied(true);
                setTimeout(() => setCoordCopied(false), 2000);
              }}
              className="mt-2 text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300"
            >
              <Copy className="w-3 h-3" />{" "}
              {coordCopied ? "Copied!" : "Copy Coordinates"}
            </button>
          </div>
        )}
        {selectedCustomer && (
          <div className="absolute bottom-4 left-4 right-4 bg-slate-800 border border-slate-700 rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="text-white font-semibold">
                {selectedCustomer.name}
              </div>
              <div className="text-sm text-slate-400">
                {selectedCustomer.phone} • {selectedCustomer.plan}
              </div>
            </div>
            <button
              onClick={() => setSelectedCustomer(null)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
