'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../app/gps.css';
import { Camera, AlertTriangle, Info, MapPin, Maximize2, Flag, Navigation, Crosshair, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Search, X as XIcon, Route, CornerUpRight, CheckCircle2 } from 'lucide-react';

// ── Leaflet default icon fix ──────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Custom camera icon factory ────────────────────────────────────────────────
const getMarkerIcon = (type, status = 'active') => {
  let color = 'blue';
  if (type === 'Speed')     color = 'red';
  if (type === 'Red Light') color = 'orange';
  if (status === 'unavailable') color = 'grey';
  if (status === 'heavy')       color = 'gold';

  return new L.Icon({
    iconUrl:    `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl:  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize:   [25, 41],
    iconAnchor: [12, 41],
    popupAnchor:[1, -34],
    shadowSize: [41, 41],
  });
};

// Waypoint icon – vibrant emerald flag
const waypointIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:32px; height:32px; border-radius:50% 50% 50% 0; transform:rotate(-45deg);
    background:linear-gradient(135deg,#10b981,#059669);
    border:2px solid white; box-shadow:0 4px 12px rgba(16,185,129,0.6);
    display:flex; align-items:center; justify-content:center;
  "><span style="transform:rotate(45deg); font-size:14px;">📍</span></div>`,
  iconSize:   [32, 32],
  iconAnchor: [16, 32],
  popupAnchor:[0, -34],
});

// User GPS dot icon
const userIcon = L.divIcon({
  className: '',
  html: `<div class="user-location-dot"></div>`,
  iconSize:   [14, 14],
  iconAnchor: [7, 7],
});

// Cluster icon
const createClusterCustomIcon = (cluster) => L.divIcon({
  html: `<span>${cluster.getChildCount()}</span>`,
  className: 'custom-cluster-icon',
  iconSize: L.point(40, 40, true),
});

// ── Haversine distance (km) ───────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// ── GPS Location Controller ───────────────────────────────────────────────────
function GPSController({ enabled, setUserPos, trafficCameras, onProximityAlert }) {
  const map = useMap();
  const circleRef    = useRef(null);
  const markerRef    = useRef(null);
  const watchRef     = useRef(null);
  const alertedRef   = useRef(new Set());

  useEffect(() => {
    if (!enabled) {
      // Clean up when disabled
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      if (circleRef.current)  map.removeLayer(circleRef.current);
      if (markerRef.current)  map.removeLayer(markerRef.current);
      circleRef.current = null;
      markerRef.current = null;
      alertedRef.current.clear();
      return;
    }

    if (!navigator.geolocation) return;

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const accuracy = pos.coords.accuracy;
        setUserPos(latlng);

        // Update or create accuracy circle
        if (circleRef.current) {
          circleRef.current.setLatLng(latlng).setRadius(accuracy);
        } else {
          circleRef.current = L.circle(latlng, {
            radius:      accuracy,
            color:       '#3b82f6',
            fillColor:   '#3b82f6',
            fillOpacity: 0.1,
            weight:      1,
          }).addTo(map);
          map.setView(latlng, 14);
        }

        // Update or create GPS dot marker
        if (markerRef.current) {
          markerRef.current.setLatLng(latlng);
        } else {
          markerRef.current = L.marker(latlng, { icon: userIcon, zIndexOffset: 1000 })
            .addTo(map)
            .bindPopup(`<b>Your Location</b><br>Accuracy: ±${Math.round(accuracy)}m`);
        }

        // Proximity alerts – fire once per camera within 5 km
        trafficCameras.forEach((cam) => {
          const dist = haversine(latlng.lat, latlng.lng, cam.latitude, cam.longitude);
          if (dist < 5 && !alertedRef.current.has(cam.id)) {
            alertedRef.current.add(cam.id);
            onProximityAlert({
              name:    cam.name,
              dist:    dist.toFixed(1),
              latlng:  cam,
            });
          }
        });
      },
      (err) => console.warn('GPS error:', err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      if (circleRef.current)  map.removeLayer(circleRef.current);
      if (markerRef.current)  map.removeLayer(markerRef.current);
    };
  }, [enabled]);

  return null;
}

// ── Waypoint Controller ───────────────────────────────────────────────────────
function WaypointController({ waypointMode, waypoints, setWaypoints }) {
  const map = useMap();

  useMapEvents({
    contextmenu(e) {
      addWaypoint(e.latlng);
    },
    click(e) {
      if (waypointMode) addWaypoint(e.latlng);
    },
  });

  function addWaypoint(latlng) {
    if (!waypointMode && !window._rightClickWaypoint) return;

    const id = Date.now();
    const marker = L.marker(latlng, { icon: waypointIcon, draggable: true })
      .addTo(map)
      .bindPopup(`
        <div style="font-family:inherit; min-width:180px;">
          <div style="font-weight:700; margin-bottom:6px; color:#10b981;">📍 Custom Waypoint</div>
          <div style="font-size:0.8em; color:#aaa; margin-bottom:2px;">Lat: ${latlng.lat.toFixed(5)}</div>
          <div style="font-size:0.8em; color:#aaa; margin-bottom:10px;">Lng: ${latlng.lng.toFixed(5)}</div>
          <button
            onclick="document.dispatchEvent(new CustomEvent('removeWaypoint', {detail: ${id}}))"
            style="font-size:0.75em; background:#ef4444; border:none; color:white; padding:4px 10px; border-radius:6px; cursor:pointer;"
          >Remove</button>
        </div>
      `)
      .openPopup();

    marker.on('dragend', () => {
      const newPos = marker.getLatLng();
      marker.setPopupContent(`
        <div style="font-family:inherit; min-width:180px;">
          <div style="font-weight:700; margin-bottom:6px; color:#10b981;">📍 Custom Waypoint</div>
          <div style="font-size:0.8em; color:#aaa; margin-bottom:2px;">Lat: ${newPos.lat.toFixed(5)}</div>
          <div style="font-size:0.8em; color:#aaa; margin-bottom:10px;">Lng: ${newPos.lng.toFixed(5)}</div>
          <button
            onclick="document.dispatchEvent(new CustomEvent('removeWaypoint', {detail: ${id}}))"
            style="font-size:0.75em; background:#ef4444; border:none; color:white; padding:4px 10px; border-radius:6px; cursor:pointer;"
          >Remove</button>
        </div>
      `);
    });

    setWaypoints(prev => [...prev, { id, marker }]);
  }

  // Listen for remove events dispatched from popup HTML
  useEffect(() => {
    const handler = (e) => {
      setWaypoints(prev => {
        const wp = prev.find(w => w.id === e.detail);
        if (wp) map.removeLayer(wp.marker);
        return prev.filter(w => w.id !== e.detail);
      });
    };
    document.addEventListener('removeWaypoint', handler);
    return () => document.removeEventListener('removeWaypoint', handler);
  }, []);

  // Also handle right-click (contextmenu) for non-waypointMode
  useEffect(() => {
    window._rightClickWaypoint = true;
    return () => { window._rightClickWaypoint = false; };
  }, []);

  return null;
}

// ── Camera popup component ────────────────────────────────────────────────────
function CameraPopup({ cam, type }) {
  const [imgLoaded, setImgLoaded]   = useState(false);
  const isUnavailable = cam.offline || cam.imageUrl?.includes('Unavailable');

  const timeAgo = useMemo(() => {
    try { return formatDistanceToNow(new Date(cam.updatedAt || Date.now()), { addSuffix: true }); }
    catch { return 'Recently'; }
  }, [cam.updatedAt]);

  return (
    <div style={{ padding: 0, minWidth: '280px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px', borderBottom: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px',
            color: type === 'traffic' ? 'var(--primary)' : (cam.type === 'Speed' ? 'var(--danger)' : 'var(--warning)') }}>
            {type === 'traffic' ? <Camera size={18}/> : <AlertTriangle size={18}/>}
            <strong style={{ fontSize: '1.1em' }}>{cam.name || cam.type + ' Camera'}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div className="pulse-dot"></div>
            <span style={{ fontSize: '0.7em', textTransform: 'uppercase', opacity: 0.8 }}>Live</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8em', color: '#888' }}>
          <MapPin size={12}/><span>{cam.description || cam.location}</span>
        </div>
      </div>

      {/* Image */}
      <div style={{ width: '100%', height: '180px', background: '#000', position: 'relative' }}>
        {!imgLoaded && !isUnavailable && <div className="skeleton" style={{ width: '100%', height: '100%' }}/>}
        {isUnavailable ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', background: '#1a1a1a', padding: '20px', textAlign: 'center' }}>
            <Info size={32} style={{ color: '#555', marginBottom: '8px' }}/>
            <p style={{ fontSize: '0.85em', color: '#888' }}>Feed temporarily unavailable</p>
          </div>
        ) : (
          <img
            src={cam.imageUrl} alt={cam.name}
            onLoad={() => setImgLoaded(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover',
              opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s' }}
            onError={(e) => { e.target.src = 'https://via.placeholder.com/600x400/1a1a1a/666?text=Unavailable'; }}
          />
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.8em', color: '#888' }}>{timeAgo}</span>
          <button style={{ fontSize: '0.8em', color: '#666', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Flag size={12}/> Report
          </button>
        </div>
        {cam.type && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.9em' }}>Speed Limit:</span>
            <span style={{ fontWeight: 'bold', border: '2px solid red', borderRadius: '50%',
              width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: '0.8em' }}>{cam.speedLimit}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Proximity Alert Toast ─────────────────────────────────────────────────────
function ProximityToast({ alert, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="proximity-alert">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <span style={{ fontSize: '1.5em' }}>📡</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9em', color: 'var(--warning)', marginBottom: '4px' }}>
            Camera Nearby
          </div>
          <div style={{ fontSize: '0.82em', color: '#ccc' }}>
            <strong style={{ color: 'white' }}>{alert.name}</strong> is {alert.dist} km away.
          </div>
        </div>
        <button onClick={onDismiss} style={{ marginLeft: 'auto', color: '#555', fontSize: '1em' }}>✕</button>
      </div>
    </div>
  );
}

// ── Search controller: geocodes query → calls onDestFound with latlng ────────────
function SearchRouteController({ query, userPos, onDestFound, onError }) {
  const map = useMap();
  const prevMarkerRef = useRef(null);

  useEffect(() => {
    if (!query) return;
    if (prevMarkerRef.current) map.removeLayer(prevMarkerRef.current);

    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=nz&limit=1`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'NZTAWatch/2.5' } }
    )
      .then(r => r.json())
      .then(data => {
        if (!data.length) { onError('No results found for that destination.'); return; }
        const dest = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), name: data[0].display_name };

        // Drop destination pin
        const destIcon = L.divIcon({
          className: '',
          html: `<div style="
            background:linear-gradient(135deg,#3b82f6,#6366f1);
            width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
            border:3px solid white;box-shadow:0 4px 16px rgba(99,102,241,0.7);
            display:flex;align-items:center;justify-content:center;
          "><span style="transform:rotate(45deg);font-size:16px;">🎯</span></div>`,
          iconSize:[36,36], iconAnchor:[18,36], popupAnchor:[0,-38],
        });
        prevMarkerRef.current = L.marker([dest.lat, dest.lng], { icon: destIcon })
          .addTo(map)
          .bindPopup(`<b style="color:#3b82f6;">🎯 Destination</b><br><span style="font-size:0.85em;color:#ccc;">${dest.name}</span>`);

        onDestFound(dest); // hand off to LiveNavController
      })
      .catch(() => onError('Geocoding failed – check your connection.'));
  }, [query]);

  return null;
}

// ── Live Nav Controller: OSRM routing + GPS recalculate + turn-by-turn HUD ────
// Rendered inside MapContainer; owns the LRM control imperatively
function LiveNavController({ dest, userPos, onTurnInfo, onArrival, active }) {
  const map = useMap();
  const controlRef = useRef(null);
  const prevUserPos = useRef(null);

  // Create / recreate routing control when dest changes
  useEffect(() => {
    if (!dest || !active) {
      if (controlRef.current) { map.removeControl(controlRef.current); controlRef.current = null; }
      return;
    }

    const origin = userPos || map.getCenter();

    // Lazy-load LRM to avoid SSR issues
    import('leaflet-routing-machine').then(() => {
      if (controlRef.current) map.removeControl(controlRef.current);

      controlRef.current = L.Routing.control({
        waypoints: [
          L.latLng(origin.lat, origin.lng),
          L.latLng(dest.lat, dest.lng),
        ],
        router: L.Routing.osrmv1({
          serviceUrl: 'https://router.project-osrm.org/route/v1',
          profile: 'driving',
        }),
        lineOptions: {
          styles: [{ color: '#3b82f6', opacity: 0.85, weight: 6 }],
          extendToWaypoints: true,
          missingRouteTolerance: 0,
        },
        show: false,           // hide default panel – we have our own HUD
        addWaypoints: false,
        routeWhileDragging: false,
        fitSelectedRoutes: true,
        showAlternatives: false,
      }).addTo(map);

      controlRef.current.on('routesfound', (e) => {
        const route     = e.routes[0];
        const totalKm   = (route.summary.totalDistance / 1000).toFixed(1);
        const totalMins = Math.round(route.summary.totalTime / 60);
        // next instruction
        const nextStep  = route.instructions?.[0];
        onTurnInfo({
          totalKm, totalMins,
          nextText: nextStep?.text || 'Follow the route',
          nextDistM: nextStep?.distance || 0,
          allSteps: route.instructions || [], // Store all steps for the detail view
        });
      });

      // Cinematic zoom to route bounds
      controlRef.current.on('routesfound', (e) => {
        const bounds = e.routes[0].bounds;
        if (bounds) map.flyToBounds(bounds, { padding: [60, 60], duration: 1.4 });
      });
    });

    return () => {
      if (controlRef.current) { map.removeControl(controlRef.current); controlRef.current = null; }
    };
  }, [dest, active]);

  // GPS update handler – splice waypoint 0 and check arrival
  useEffect(() => {
    if (!controlRef.current || !userPos || !active) return;

    // Skip tiny movements < 20m
    if (prevUserPos.current) {
      const moved = haversine(prevUserPos.current.lat, prevUserPos.current.lng, userPos.lat, userPos.lng) * 1000;
      if (moved < 20) return;
    }
    prevUserPos.current = userPos;

    controlRef.current.spliceWaypoints(0, 1, L.latLng(userPos.lat, userPos.lng));

    // Arrival detection: < 50 m to destination
    if (dest) {
      const distToDestM = haversine(userPos.lat, userPos.lng, dest.lat, dest.lng) * 1000;
      if (distToDestM < 50) onArrival();
    }
  }, [userPos, active]);

  return null;
}


// ── Main Map ──────────────────────────────────────────────────────────────────
export default function Map({ trafficCameras, safetyCameras, filters }) {
  const [mounted, setMounted]           = useState(false);
  const [gpsEnabled, setGpsEnabled]     = useState(false);
  const [waypointMode, setWaypointMode] = useState(false);
  const [waypoints, setWaypoints]       = useState([]);
  const [userPos, setUserPos]           = useState(null);
  const [proximityAlert, setProximityAlert] = useState(null);
  const [searchInput, setSearchInput]   = useState('');
  const [pendingQuery, setPendingQuery] = useState(null);
  const [routeResult, setRouteResult]   = useState(null);
  const [routeError, setRouteError]     = useState(null);
  // Navigation state
  const [navDest, setNavDest]           = useState(null);   // {lat,lng,name}
  const [navActive, setNavActive]       = useState(false);
  const [turnInfo, setTurnInfo]         = useState(null);   // {totalKm, totalMins, nextText, nextDistM, allSteps}
  const [arrived, setArrived]           = useState(false);
  const [showFullRouteSteps, setShowFullRouteSteps] = useState(false);
  const searchRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  const clearWaypoints = useCallback(() => {
    waypoints.forEach(wp => {
      if (mapRef.current) mapRef.current.removeLayer(wp.marker);
    });
    setWaypoints([]);
  }, [waypoints]);

  const handleProximityAlert = useCallback((alert) => {
    setProximityAlert(alert);
  }, []);

  const recenterOnUser = useCallback(() => {
    if (userPos && mapRef.current) {
      mapRef.current.setView(userPos, 15);
    }
  }, [userPos, mapRef]);

  if (!mounted) return (
    <div style={{ height: '100%', width: '100%', background: 'var(--surface)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
      Loading Map…
    </div>
  );

  const submitSearch = () => {
    const q = searchInput.trim();
    if (!q) return;
    setRouteError(null);
    setRouteResult(null);
    setPendingQuery(q);
  };

  const clearSearch = () => {
    setSearchInput('');
    setPendingQuery(null);
    setRouteResult(null);
    setRouteError(null);
    setNavActive(false);
    setTurnInfo(null);
    setArrived(false);
    setShowFullRouteSteps(false);
  };

  const startNavigation = () => {
    if (!navDest) return;
    setNavActive(true);
    setArrived(false);
    setTurnInfo(null);
    if (!gpsEnabled) setGpsEnabled(true); // auto-enable GPS
  };

  const stopNavigation = () => {
    setNavActive(false);
    setTurnInfo(null);
    setShowFullRouteSteps(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: '#121212' }}>
      {/* ── Search Header ────────────────────────────────────────────────── */}
      <div className="search-header">
        <div style={{ width: '90%', maxWidth: '440px', position: 'relative' }}>
          <div className="glass-panel" style={{
            borderRadius: '999px',
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 16px',
            border: '1px solid var(--glass-border)',
          }}>
            <Search size={18} color="#555" style={{ flexShrink: 0 }} />
            <input
              ref={searchRef}
              type="text"
              value={searchInput}
              placeholder="Search destination in NZ…"
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitSearch()}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: 'white', fontSize: '0.95em', fontFamily: 'inherit',
              }}
            />
            {searchInput && (
              <button onClick={clearSearch} style={{ color: '#555', display: 'flex' }}>
                <XIcon size={16}/>
              </button>
            )}
            <button
              onClick={submitSearch}
              style={{
                background: 'var(--primary)', borderRadius: '999px',
                padding: '6px 14px', fontSize: '0.8em', fontWeight: 600,
                color: 'white', display: 'flex', alignItems: 'center', gap: '4px',
                flexShrink: 0,
              }}
            >
              <Route size={14}/> Go
            </button>
          </div>

          {/* Result / Error feedback floating below the bar but still in header space */}
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1010 }}>
            {routeResult && !navActive && (
              <div style={{
                marginTop: '8px', background: 'rgba(16,185,129,0.95)',
                border: '1px solid rgba(16,185,129,0.4)', borderRadius: '12px',
                padding: '8px 14px', fontSize: '0.8em', color: 'white',
                display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)'
              }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <Route size={14}/>
                  <span>Found: <strong>{routeResult.substring(0, 30)}…</strong></span>
                </div>
                <button
                  onClick={startNavigation}
                  style={{
                    background: 'white', borderRadius: '999px',
                    padding: '4px 12px', fontSize: '0.8em', fontWeight: 700,
                    color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
                  }}
                >
                  <Navigation size={12}/> Start
                </button>
              </div>
            )}
            {routeError && (
              <div style={{
                marginTop: '8px', background: 'rgba(239,68,68,0.95)',
                border: '1px solid rgba(239,68,68,0.4)', borderRadius: '12px',
                padding: '8px 14px', fontSize: '0.8em', color: 'white',
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)'
              }}>
                ⚠ {routeError}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        {/* Proximity Alert Toast */}
        {proximityAlert && (
          <ProximityToast alert={proximityAlert} onDismiss={() => setProximityAlert(null)} />
        )}


      {/* FAB Group */}
      <div className={`fab-group ${navActive ? 'nav-active' : ''}`}>
        {/* GPS Toggle */}
        <button
          title={gpsEnabled ? 'Disable GPS' : 'Enable GPS'}
          onClick={() => { setGpsEnabled(g => !g); if (!gpsEnabled) setWaypointMode(false); }}
          className={`fab-btn glass-panel ${gpsEnabled ? 'active' : ''}`}
          style={{ background: gpsEnabled ? 'rgba(59,130,246,0.3)' : undefined }}
        >
          <Crosshair size={20} color={gpsEnabled ? '#3b82f6' : '#aaa'} />
        </button>

        {/* Waypoint Drop Mode Toggle */}
        <button
          title={waypointMode ? 'Exit Waypoint Mode (click map to place)' : 'Enter Waypoint Mode'}
          onClick={() => setWaypointMode(m => !m)}
          className={`fab-btn glass-panel ${waypointMode ? 'active' : ''}`}
          style={{ background: waypointMode ? 'rgba(16,185,129,0.3)' : undefined }}
        >
          <MapPin size={20} color={waypointMode ? '#10b981' : '#aaa'} />
        </button>

        {/* Clear All Waypoints */}
        {waypoints.length > 0 && (
          <button
            title="Clear all waypoints"
            onClick={clearWaypoints}
            className="fab-btn glass-panel"
          >
            <Trash2 size={20} color="#ef4444" />
          </button>
        )}

        {/* Stop Navigation FAB */}
        {navActive && (
          <button
            title="Stop Navigation"
            onClick={stopNavigation}
            className="fab-btn glass-panel"
            style={{ background: 'rgba(239,68,68,0.3)' }}
          >
            <XIcon size={20} color="#ef4444" />
          </button>
        )}

        {/* Re-center on user */}
        {gpsEnabled && userPos && (
          <button
            title="Re-center on my location"
            onClick={recenterOnUser}
            className="fab-btn glass-panel"
          >
            <Navigation size={20} color="#3b82f6" />
          </button>
        )}
      </div>

      {/* Waypoint Mode Banner */}
      {waypointMode && (
        <div style={{
          position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: 'rgba(16,185,129,0.9)', color: 'white',
          padding: '8px 20px', borderRadius: '20px', fontSize: '0.82em', fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)', pointerEvents: 'none',
        }}>
          📍 Tap anywhere on the map to drop a waypoint · Right-click also works
        </div>
      )}

      {/* ── Full Route Steps List ────────────────────────────────────────── */}
      {navActive && showFullRouteSteps && turnInfo && (
        <div className="route-details-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '1em', color: 'white' }}>Route Instructions</h3>
            <button onClick={() => setShowFullRouteSteps(false)} style={{ color: '#888' }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {turnInfo.allSteps.map((step, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '12px', fontSize: '0.85em', color: '#ccc' }}>
                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{idx + 1}.</span>
                <div>
                  <div style={{ color: 'white', marginBottom: '2px' }}>{step.text}</div>
                  {step.distance > 0 && (
                    <div style={{ fontSize: '0.8em', color: '#666' }}>
                      {step.distance > 1000 ? `${(step.distance/1000).toFixed(1)} km` : `${Math.round(step.distance)} m`}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Turn-by-Turn HUD ──────────────────────────────────────────────── */}
      {navActive && turnInfo && !arrived && (
        <div className="glass-panel turn-hud">
          {/* Next turn */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <div style={{ background: 'rgba(59,130,246,0.2)', padding: '10px', borderRadius: '50%', flexShrink: 0 }}>
              <CornerUpRight size={24} color="var(--primary)" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.95em', fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {turnInfo.nextText}
              </div>
              {turnInfo.nextDistM > 0 && (
                <div style={{ fontSize: '0.75em', color: '#aaa', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>in {turnInfo.nextDistM > 1000 ? `${(turnInfo.nextDistM/1000).toFixed(1)} km` : `${Math.round(turnInfo.nextDistM)} m`}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#555' }}>
                    <span className="pulse-dot" style={{ width: 6, height: 6 }} /> Live
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div style={{ width: '1px', height: '40px', background: 'var(--glass-border)', flexShrink: 0 }} />
          
          {/* Journey summary & Steps Toggle */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.2em', fontWeight: 800, color: 'white' }}>{turnInfo.totalMins}</div>
              <div style={{ fontSize: '0.65em', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>min</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.2em', fontWeight: 800, color: 'white' }}>{turnInfo.totalKm}</div>
              <div style={{ fontSize: '0.65em', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>km</div>
            </div>
            <button 
              onClick={() => setShowFullRouteSteps(!showFullRouteSteps)}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid #333',
                borderRadius: '8px', padding: '6px 10px', color: '#ccc', fontSize: '0.7em',
                fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px'
              }}
            >
              <Info size={14} />
              <span>STEPS</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Arrival Celebration ────────────────────────────────────────────── */}
      {arrived && (
        <div className="glass-panel" style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1010, borderRadius: '24px', padding: '32px 40px',
          textAlign: 'center', border: '1px solid rgba(16,185,129,0.5)',
          minWidth: '260px', animation: 'slideInRight 0.5s ease',
        }}>
          <CheckCircle2 size={52} color="var(--accent)" style={{ marginBottom: '16px' }} />
          <div style={{ fontSize: '1.4em', fontWeight: 800, color: 'white', marginBottom: '6px' }}>Arrived!</div>
          <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '20px' }}>
            You have reached <strong style={{ color: '#ccc' }}>{navDest?.name?.substring(0, 40)}</strong>
          </div>
          <button
            onClick={() => { setArrived(false); stopNavigation(); clearSearch(); }}
            style={{
              background: 'var(--accent)', color: 'white', borderRadius: '999px',
              padding: '10px 24px', fontWeight: 700, fontSize: '0.9em',
            }}
          >
            Done
          </button>
        </div>
      )}

      <MapContainer
        center={[-40.9006, 174.8860]}
        zoom={6}
        style={{ height: '100%', width: '100%', zIndex: 1 }}
        zoomControl={false}
        ref={mapRef}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {/* GPS controller */}
        <GPSController
          enabled={gpsEnabled}
          setUserPos={setUserPos}
          trafficCameras={trafficCameras}
          onProximityAlert={handleProximityAlert}
        />

        {/* Waypoint controller */}
        <WaypointController
          waypointMode={waypointMode}
          waypoints={waypoints}
          setWaypoints={setWaypoints}
        />

        {/* Search-to-Route controller */}
        {pendingQuery && (
          <SearchRouteController
            query={pendingQuery}
            userPos={userPos}
            onDestFound={(dest) => { setNavDest(dest); setRouteResult(dest.name); }}
            onError={(msg) => setRouteError(msg)}
          />
        )}

        {/* Live Navigation controller */}
        {navDest && (
          <LiveNavController
            dest={navDest}
            userPos={userPos}
            active={navActive}
            onTurnInfo={setTurnInfo}
            onArrival={() => setArrived(true)}
          />
        )}

        {/* Clustered Camera Markers */}
        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={createClusterCustomIcon}
          showCoverageOnHover={false}
          spiderfyOnMaxZoom={true}
        >
          {filters.showTrafficCameras && trafficCameras.map(cam => (
            <Marker
              key={cam.id}
              position={[cam.latitude, cam.longitude]}
              icon={getMarkerIcon('traffic', cam.offline ? 'unavailable' : (cam.flow > 80 ? 'heavy' : 'active'))}
            >
              <Popup className="custom-popup">
                <CameraPopup cam={cam} type="traffic" />
              </Popup>
            </Marker>
          ))}

          {filters.showSafetyCameras && safetyCameras.map(cam => (
            <Marker
              key={cam.id}
              position={[cam.latitude, cam.longitude]}
              icon={getMarkerIcon(cam.type, cam.status === 'Active' ? 'active' : 'unavailable')}
            >
              <Popup className="custom-popup">
                <CameraPopup cam={cam} type="safety" />
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
      </div>
    </div>
  );
}
