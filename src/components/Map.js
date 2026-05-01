'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../app/gps.css';
import { Camera, AlertTriangle, Info, MapPin, Maximize2, Flag, Navigation, Crosshair, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

// ── Main Map ──────────────────────────────────────────────────────────────────
export default function Map({ trafficCameras, safetyCameras, filters }) {
  const [mounted, setMounted]       = useState(false);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [waypointMode, setWaypointMode] = useState(false);
  const [waypoints, setWaypoints]   = useState([]);
  const [userPos, setUserPos]       = useState(null);
  const [proximityAlert, setProximityAlert] = useState(null);
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

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {/* Proximity Alert Toast */}
      {proximityAlert && (
        <ProximityToast alert={proximityAlert} onDismiss={() => setProximityAlert(null)} />
      )}

      {/* FAB Group */}
      <div className="fab-group">
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
  );
}
