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
function GPSController({ enabled, setUserPos, trafficCameras, safetyCameras, onProximityAlert }) {
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

        // Proximity alerts – fire once per camera within 3 km
        const allCams = [...trafficCameras, ...safetyCameras];
        allCams.forEach((cam) => {
          const dist = haversine(latlng.lat, latlng.lng, cam.latitude, cam.longitude);
          if (dist < 3 && !alertedRef.current.has(cam.id)) {
            alertedRef.current.add(cam.id);
            onProximityAlert({
              id:      cam.id,
              name:    cam.name || cam.location || (cam.type + ' Camera'),
              type:    cam.type || 'Traffic',
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

// ── Nearest Camera Tracker ────────────────────────────────────────────────────
function NearestCameraTracker({ userPos, safetyCameras, onNearestUpdate }) {
  useEffect(() => {
    if (!userPos || !safetyCameras.length) return;

    const sorted = [...safetyCameras]
      .map(cam => ({
        ...cam,
        dist: haversine(userPos.lat, userPos.lng, cam.latitude, cam.longitude)
      }))
      .sort((a, b) => a.dist - b.dist);

    const nearest = sorted[0];
    onNearestUpdate(nearest.dist < 5 ? nearest : null); // Only track if within 5km
  }, [userPos, safetyCameras]);

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

  const handleNavigate = () => {
    const dest = { lat: cam.latitude, lng: cam.longitude, name: cam.name || cam.location };
    document.dispatchEvent(new CustomEvent('startNavTo', { detail: dest }));
  };

  return (
    <div style={{ padding: 0, minWidth: '300px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px',
            color: type === 'traffic' ? 'var(--primary)' : (cam.type === 'Speed' ? 'var(--danger)' : 'var(--warning)') }}>
            {type === 'traffic' ? <Camera size={20}/> : <AlertTriangle size={20}/>}
            <strong style={{ fontSize: '1.15em', letterSpacing: '-0.3px' }}>{cam.name || cam.type + ' Camera'}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div className="pulse-dot" style={{ width: 6, height: 6 }}></div>
            <span style={{ fontSize: '0.65em', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px', opacity: 0.8 }}>Live</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85em', color: '#aaa' }}>
          <MapPin size={14} style={{ flexShrink: 0 }}/>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cam.description || cam.location}</span>
        </div>
      </div>

      {/* Image */}
      <div style={{ width: '100%', height: '200px', background: '#000', position: 'relative', overflow: 'hidden' }}>
        {!imgLoaded && !isUnavailable && <div className="skeleton" style={{ width: '100%', height: '100%' }}/>}
        {isUnavailable ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', background: '#0f0f12', padding: '24px', textAlign: 'center' }}>
            <Info size={40} style={{ color: '#333', marginBottom: '12px' }}/>
            <p style={{ fontSize: '0.9em', color: '#666', fontWeight: 500 }}>Feed temporarily offline</p>
          </div>
        ) : (
          <img
            src={cam.imageUrl} alt={cam.name}
            onLoad={() => setImgLoaded(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover',
              opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
              filter: 'contrast(1.1) brightness(0.9)' }}
            onError={(e) => { e.target.src = 'https://via.placeholder.com/600x400/0f0f12/666?text=Unavailable'; }}
          />
        )}
      </div>

      {/* Footer / Actions */}
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.8em', color: '#777', fontWeight: 500 }}>{timeAgo}</span>
          <button style={{ fontSize: '0.8em', color: '#555', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <Flag size={14}/> Report Issue
          </button>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          {cam.speedLimit && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1,
              background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '0.85em', color: '#888', fontWeight: 500 }}>Limit</span>
              <span style={{ fontWeight: 800, border: '2px solid var(--danger)', borderRadius: '50%',
                width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: '0.9em', boxShadow: '0 0 10px rgba(239, 68, 68, 0.3)' }}>{cam.speedLimit}</span>
            </div>
          )}
          
          <button 
            onClick={handleNavigate}
            style={{
              flex: 2,
              background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
              color: 'white',
              borderRadius: '12px',
              padding: '10px',
              fontSize: '0.9em',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px var(--primary-glow)'
            }}
          >
            <Navigation size={18} />
            Navigate
          </button>
        </div>
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
    <div className="proximity-alert" style={{ 
      borderColor: alert.type === 'Speed' ? 'var(--danger)' : 'rgba(245, 158, 11, 0.4)',
      background: alert.type === 'Speed' ? 'rgba(239, 68, 68, 0.15)' : 'var(--glass)'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ 
          background: alert.type === 'Speed' ? 'var(--danger)' : 'var(--warning)', 
          padding: '8px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' 
        }}>
          {alert.type === 'Speed' ? <AlertTriangle size={20} color="white" /> : <Camera size={20} color="white" />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '0.85em', color: alert.type === 'Speed' ? 'var(--danger)' : 'var(--warning)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {alert.type} Camera Nearby
          </div>
          <div style={{ fontSize: '0.9em', color: 'white', fontWeight: 600 }}>
            {alert.name}
          </div>
          <div style={{ fontSize: '0.75em', color: '#aaa', marginTop: '4px' }}>
            Distance: <strong style={{ color: 'white' }}>{alert.dist} km</strong>
          </div>
        </div>
        <button onClick={onDismiss} style={{ color: '#555', padding: '4px' }}><XIcon size={16} /></button>
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


// ── Incident icon factory ─────────────────────────────────────────────────────
const getIncidentIcon = (type, severity) => {
  const emoji = type === 'Crash'      ? '💥'
              : type === 'Roadworks'  ? '🚧'
              : type === 'Road Closure' ? '🚫'
              : type === 'Weather'    ? '❄️'
              : type === 'Congestion' ? '🚗'
              : '⚠️';

  const bg = severity === 'Road Closure' ? '#dc2626'
            : severity === 'Major'       ? '#f97316'
            : severity === 'Moderate'    ? '#eab308'
            : '#6b7280'; // Minor

  return L.divIcon({
    className: '',
    html: `<div style="
      width: 36px; height: 36px; border-radius: 50%;
      background: ${bg};
      border: 3px solid white;
      box-shadow: 0 4px 16px rgba(0,0,0,0.6);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; line-height: 1;
    ">${emoji}</div>`,
    iconSize:    [36, 36],
    iconAnchor:  [18, 18],
    popupAnchor: [0, -20],
  });
};

// ── Incident popup component ──────────────────────────────────────────────────
function IncidentPopup({ incident }) {
  const severityColor = incident.severity === 'Road Closure' ? 'var(--danger)'
                      : incident.severity === 'Major'        ? '#f97316'
                      : incident.severity === 'Moderate'     ? '#eab308'
                      : '#6b7280';

  const handleNavigate = () => {
    document.dispatchEvent(new CustomEvent('startNavTo', {
      detail: { lat: incident.latitude, lng: incident.longitude, name: incident.location }
    }));
  };

  return (
    <div style={{ padding: 0, minWidth: '280px' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2em' }}>
              {incident.type === 'Crash' ? '💥' : incident.type === 'Roadworks' ? '🚧' : incident.type === 'Road Closure' ? '🚫' : incident.type === 'Weather' ? '❄️' : '⚠️'}
            </span>
            <strong style={{ fontSize: '1.05em', color: 'white' }}>{incident.type}</strong>
          </div>
          <span style={{
            background: severityColor, color: 'white', fontSize: '0.7em', fontWeight: 800,
            padding: '3px 10px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.5px'
          }}>{incident.severity}</span>
        </div>
        <div style={{ fontSize: '0.82em', color: '#aaa', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MapPin size={12} />
          {incident.location}
        </div>
      </div>

      {/* Description */}
      <div style={{ padding: '14px 16px' }}>
        <p style={{ fontSize: '0.85em', color: '#ccc', lineHeight: 1.5, margin: '0 0 14px 0' }}>
          {incident.description}
        </p>
        <button
          onClick={handleNavigate}
          style={{
            width: '100%', background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
            color: 'white', borderRadius: '12px', padding: '10px', fontSize: '0.9em', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            boxShadow: '0 4px 12px var(--primary-glow)'
          }}
        >
          <Navigation size={16} /> Avoid This Route
        </button>
      </div>
    </div>
  );
}

// ── Police station icon factory ───────────────────────────────────────────────
const getPoliceIcon = (type) => {
  const emoji = type === 'Traffic Police'   ? '🚔'
              : type === 'Dog Unit'         ? '🐕'
              : type === 'Marine Unit'      ? '⛵'
              : type === 'Airport Police'   ? '✈️'
              : type === 'Community Station'? '🏠'
              : '🚨';

  return L.divIcon({
    className: '',
    html: `<div style="
      width: 34px; height: 34px; border-radius: 10px;
      background: linear-gradient(135deg, #1d4ed8, #1e40af);
      border: 2.5px solid #93c5fd;
      box-shadow: 0 4px 16px rgba(29,78,216,0.6);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; line-height: 1;
    ">${emoji}</div>`,
    iconSize:    [34, 34],
    iconAnchor:  [17, 17],
    popupAnchor: [0, -20],
  });
};

// ── Police station popup component ────────────────────────────────────────────
function PolicePopup({ station }) {
  const emoji = station.type === 'Traffic Police'   ? '🚔'
              : station.type === 'Dog Unit'         ? '🐕'
              : station.type === 'Marine Unit'      ? '⛵'
              : station.type === 'Airport Police'   ? '✈️'
              : station.type === 'Community Station'? '🏠'
              : '🚨';

  return (
    <div style={{ padding: 0, minWidth: '280px' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--glass-border)', background: 'rgba(29,78,216,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <span style={{ fontSize: '1.4em' }}>{emoji}</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1em', color: 'white', lineHeight: 1.2 }}>{station.name}</div>
            <div style={{ fontSize: '0.72em', color: '#93c5fd', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>{station.type}</div>
          </div>
        </div>
        {station.district && (
          <div style={{ fontSize: '0.78em', color: '#888', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <MapPin size={11} />{station.district}
          </div>
        )}
      </div>
      <div style={{ padding: '14px 16px' }}>
        {station.address && (
          <div style={{ fontSize: '0.82em', color: '#ccc', marginBottom: '10px', display: 'flex', gap: '8px' }}>
            <MapPin size={13} style={{ flexShrink: 0, marginTop: '2px', color: '#93c5fd' }} />
            <span>{station.address}</span>
          </div>
        )}
        {station.phone && (
          <div style={{ fontSize: '0.82em', color: '#ccc', marginBottom: '10px', display: 'flex', gap: '8px' }}>
            <span>📞</span>
            <a href={`tel:${station.phone}`} style={{ color: '#93c5fd', fontWeight: 600 }}>{station.phone}</a>
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '0.7em', fontWeight: 800, padding: '3px 10px', borderRadius: '20px',
            background: 'rgba(29,78,216,0.3)', color: '#93c5fd', border: '1px solid rgba(29,78,216,0.4)'
          }}>{station.openingHours}</span>
          {station.emergency === 'yes' && (
            <span style={{
              fontSize: '0.7em', fontWeight: 800, padding: '3px 10px', borderRadius: '20px',
              background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)'
            }}>Emergency ✓</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Map ──────────────────────────────────────────────────────────────────
export default function Map({ trafficCameras, safetyCameras, incidents = [], policeStations = [], filters }) {
  const [mounted, setMounted]           = useState(false);
  const [gpsEnabled, setGpsEnabled]     = useState(false);
  const [waypointMode, setWaypointMode] = useState(false);
  const [waypoints, setWaypoints]       = useState([]);
  const [userPos, setUserPos]           = useState(null);
  const [proximityAlert, setProximityAlert] = useState(null);
  const [searchInput, setSearchInput]   = useState('');
  const [suggestions, setSuggestions]   = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [pendingQuery, setPendingQuery] = useState(null);
  const [routeResult, setRouteResult]   = useState(null);
  const [routeError, setRouteError]     = useState(null);
  // Navigation state
  const [navDest, setNavDest]           = useState(null);   // {lat,lng,name}
  const [navActive, setNavActive]       = useState(false);
  const [turnInfo, setTurnInfo]         = useState(null);   // {totalKm, totalMins, nextText, nextDistM, allSteps}
  const [arrived, setArrived]           = useState(false);
  const [showFullRouteSteps, setShowFullRouteSteps] = useState(false);
  const [nearestCam, setNearestCam]     = useState(null);
  const searchRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  // Listen for 'focusCamera' events from sidebar
  useEffect(() => {
    const handler = (e) => {
      const cam = e.detail;
      if (mapRef.current) {
        mapRef.current.flyTo([cam.latitude, cam.longitude], 16, {
          duration: 1.5,
          easeLinearity: 0.25
        });
      }
    };
    document.addEventListener('focusCamera', handler);
    return () => document.removeEventListener('focusCamera', handler);
  }, []);

  // Listen for 'startNavTo' events from popups
  useEffect(() => {
    const handler = (e) => {
      const dest = e.detail;
      setNavDest(dest);
      setRouteResult(dest.name);
      setSearchInput(dest.name);
      startNavigation();
    };
    document.addEventListener('startNavTo', handler);
    return () => document.removeEventListener('startNavTo', handler);
  }, []);

  // Search autocomplete logic
  useEffect(() => {
    if (searchInput.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchInput)}&countrycodes=nz&limit=5`)
        .then(r => r.json())
        .then(data => {
          setSuggestions(data.map(item => ({
            name: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon)
          })));
        })
        .catch(err => console.error("Search suggestion error:", err));
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

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
            borderRadius: '16px',
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '10px 16px',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            transition: 'all 0.3s ease'
          }}>
            <Search size={20} color="var(--primary)" style={{ flexShrink: 0, opacity: 0.8 }} />
            <input
              ref={searchRef}
              type="text"
              value={searchInput}
              placeholder="Search destination in NZ…"
              onChange={e => { setSearchInput(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={e => e.key === 'Enter' && submitSearch()}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: 'white', fontSize: '1em', fontWeight: 500, fontFamily: 'inherit',
              }}
            />
            {searchInput && (
              <button onClick={clearSearch} style={{ color: '#666', display: 'flex', padding: '4px' }}>
                <XIcon size={18}/>
              </button>
            )}
            <button
              onClick={submitSearch}
              style={{
                background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                borderRadius: '10px',
                padding: '8px 16px', fontSize: '0.85em', fontWeight: 700,
                color: 'white', display: 'flex', alignItems: 'center', gap: '6px',
                flexShrink: 0, boxShadow: '0 4px 12px var(--primary-glow)'
              }}
            >
              <Route size={16}/> Go
            </button>
          </div>

          {/* Autocomplete Suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="glass-panel" style={{
              position: 'absolute', top: '110%', left: 0, right: 0,
              zIndex: 1100, borderRadius: '16px', padding: '8px',
              maxHeight: '300px', overflowY: 'auto'
            }}>
              {suggestions.map((s, i) => (
                <div 
                  key={i}
                  onClick={() => {
                    setSearchInput(s.name);
                    setNavDest(s);
                    setRouteResult(s.name);
                    setShowSuggestions(false);
                    startNavigation();
                  }}
                  style={{
                    padding: '12px 16px', borderRadius: '10px', cursor: 'pointer',
                    fontSize: '0.9em', color: '#ccc', transition: 'background 0.2s',
                    borderBottom: i < suggestions.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                    display: 'flex', alignItems: 'center', gap: '10px'
                  }}
                  className="suggestion-item"
                >
                  <MapPin size={14} color="#555" />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Result / Error feedback floating below the bar but still in header space */}
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1010 }}>
            {routeResult && !navActive && (
              <div className="glass-panel" style={{
                marginTop: '12px', background: 'rgba(16,185,129,0.15)',
                borderColor: 'rgba(16,185,129,0.3)', borderRadius: '14px',
                padding: '10px 16px', fontSize: '0.85em', color: 'white',
                display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between',
                animation: 'slideUp 0.3s ease-out'
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: 0 }}>
                  <div style={{ background: 'var(--accent)', padding: '6px', borderRadius: '50%' }}>
                    <CheckCircle2 size={16} color="white" />
                  </div>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Found: <strong>{routeResult}</strong></span>
                </div>
                <button
                  onClick={startNavigation}
                  style={{
                    background: 'white', borderRadius: '10px',
                    padding: '6px 14px', fontSize: '0.85em', fontWeight: 800,
                    color: '#000', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0,
                  }}
                >
                  <Navigation size={14}/> Start
                </button>
              </div>
            )}
            {routeError && (
              <div className="glass-panel" style={{
                marginTop: '12px', background: 'rgba(239,68,68,0.15)',
                borderColor: 'rgba(239,68,68,0.3)', borderRadius: '14px',
                padding: '12px 16px', fontSize: '0.85em', color: 'white',
                animation: 'slideUp 0.3s ease-out', display: 'flex', alignItems: 'center', gap: '10px'
              }}>
                <AlertTriangle size={18} color="var(--danger)" />
                <span>{routeError}</span>
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


      {/* ── Nearest Camera Widget ── */}
      {gpsEnabled && nearestCam && !navActive && (
        <div style={{ 
          position: 'absolute', top: '100px', right: '24px', zIndex: 1000,
          animation: 'slideInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <div className="glass-panel" style={{ 
            padding: '16px', borderRadius: '20px', minWidth: '220px',
            border: `1px solid ${nearestCam.type === 'Speed' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.1)'}`,
            background: nearestCam.type === 'Speed' ? 'rgba(239, 68, 68, 0.05)' : 'var(--glass)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ 
                background: nearestCam.type === 'Speed' ? 'var(--danger)' : 'var(--primary)',
                padding: '8px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
              }}>
                <Camera size={20} color="white" />
              </div>
              <div>
                <div style={{ fontSize: '0.7em', fontWeight: 800, color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Nearest Radar</div>
                <div style={{ fontSize: '0.95em', fontWeight: 800, color: 'white' }}>{nearestCam.type} Camera</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '1.4em', fontWeight: 900, color: 'white', lineHeight: 1 }}>{nearestCam.dist.toFixed(1)}</span>
                <span style={{ fontSize: '0.65em', color: '#555', fontWeight: 800, textTransform: 'uppercase' }}>km away</span>
              </div>
              {nearestCam.speedLimit && (
                <div style={{ textAlign: 'right' }}>
                   <div style={{ 
                     width: '36px', height: '36px', border: '3px solid red', borderRadius: '50%',
                     display: 'flex', alignItems: 'center', justifyContent: 'center',
                     fontWeight: 900, color: 'white', fontSize: '0.9em', background: 'black'
                   }}>{nearestCam.speedLimit}</div>
                </div>
              )}
            </div>
          </div>
        </div>
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
        <div className="glass-panel turn-hud" style={{ border: '1px solid rgba(255,255,255,0.1)', animation: 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          {/* Next turn */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
            <div style={{ 
              background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))', 
              padding: '12px', borderRadius: '14px', flexShrink: 0,
              boxShadow: '0 8px 20px var(--primary-glow)'
            }}>
              <CornerUpRight size={28} color="white" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '1.1em', fontWeight: 800, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.3px' }}>
                {turnInfo.nextText}
              </div>
              {turnInfo.nextDistM > 0 && (
                <div style={{ fontSize: '0.85em', color: '#999', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                  <span style={{ color: 'var(--primary)' }}>in {turnInfo.nextDistM > 1000 ? `${(turnInfo.nextDistM/1000).toFixed(1)} km` : `${Math.round(turnInfo.nextDistM)} m`}</span>
                  <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#444' }} />
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#666', fontSize: '0.8em', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <span className="pulse-dot" style={{ width: 6, height: 6 }} /> Active
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div style={{ width: '1px', height: '48px', background: 'var(--glass-border)', flexShrink: 0 }} />
          
          {/* Journey summary & Steps Toggle */}
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5em', fontWeight: 900, color: 'white', lineHeight: 1 }}>{turnInfo.totalMins}</div>
              <div style={{ fontSize: '0.7em', color: '#666', textTransform: 'uppercase', letterSpacing: '1.2px', marginTop: '4px', fontWeight: 800 }}>min</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5em', fontWeight: 900, color: 'white', lineHeight: 1 }}>{turnInfo.totalKm}</div>
              <div style={{ fontSize: '0.7em', color: '#666', textTransform: 'uppercase', letterSpacing: '1.2px', marginTop: '4px', fontWeight: 800 }}>km</div>
            </div>
            <button 
              onClick={() => setShowFullRouteSteps(!showFullRouteSteps)}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px', padding: '8px 12px', color: 'white',
                transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
              <Info size={18} color="var(--primary)" />
              <span style={{ fontSize: '0.65em', fontWeight: 800, letterSpacing: '0.5px' }}>STEPS</span>
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
          safetyCameras={safetyCameras}
          onProximityAlert={handleProximityAlert}
        />

        {/* Nearest Camera Tracker */}
        {gpsEnabled && userPos && (
          <NearestCameraTracker 
            userPos={userPos} 
            safetyCameras={safetyCameras} 
            onNearestUpdate={setNearestCam} 
          />
        )}

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

        {/* Incident Markers */}
        {filters.showIncidents && incidents.map(incident => {
          if (!incident.latitude || !incident.longitude) return null;
          return (
            <Marker
              key={incident.id}
              position={[incident.latitude, incident.longitude]}
              icon={getIncidentIcon(incident.type, incident.severity)}
              zIndexOffset={500}
            >
              <Popup className="custom-popup">
                <IncidentPopup incident={incident} />
              </Popup>
            </Marker>
          );
        })}

        {/* Police Station Markers */}
        {filters.showPolice && policeStations.map(station => {
          if (!station.latitude || !station.longitude) return null;
          return (
            <Marker
              key={station.id}
              position={[station.latitude, station.longitude]}
              icon={getPoliceIcon(station.type)}
              zIndexOffset={400}
            >
              <Popup className="custom-popup">
                <PolicePopup station={station} />
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      </div>
    </div>
  );
}
