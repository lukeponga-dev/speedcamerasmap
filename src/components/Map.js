'use client';

import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Camera, AlertTriangle, Info, MapPin, Maximize2, Flag, Navigation } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// Fix Leaflet's default icon paths in Next.js
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Icon Factory
const getMarkerIcon = (type, status = 'active') => {
  let color = 'blue';
  if (type === 'Speed') color = 'red';
  if (type === 'Red Light') color = 'orange';
  if (status === 'unavailable') color = 'grey';
  if (status === 'heavy') color = 'gold';

  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

const createClusterCustomIcon = function (cluster) {
  return L.divIcon({
    html: `<span>${cluster.getChildCount()}</span>`,
    className: 'custom-cluster-icon',
    iconSize: L.point(40, 40, true),
  });
};

function CameraPopup({ cam, type, onZoomTo }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const isUnavailable = cam.offline || cam.imageUrl?.includes('Unavailable');
  
  const timeAgo = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(cam.updatedAt || Date.now()), { addSuffix: true });
    } catch (e) {
      return 'Recently';
    }
  }, [cam.updatedAt]);

  return (
    <div style={{ padding: '0', minWidth: '280px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px', borderBottom: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: type === 'traffic' ? 'var(--primary)' : (cam.type === 'Speed' ? 'var(--danger)' : 'var(--warning)') }}>
            {type === 'traffic' ? <Camera size={18} /> : <AlertTriangle size={18} />}
            <strong style={{ fontSize: '1.1em' }}>{cam.name || cam.type + ' Camera'}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
             <div className="pulse-dot"></div>
             <span style={{ fontSize: '0.7em', textTransform: 'uppercase', opacity: 0.8 }}>Live</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8em', color: '#888' }}>
          <MapPin size={12} />
          <span>{cam.description || cam.location}</span>
        </div>
      </div>

      {/* Image Section */}
      <div style={{ width: '100%', height: '180px', background: '#000', position: 'relative' }}>
        {!imgLoaded && !isUnavailable && <div className="skeleton" style={{ width: '100%', height: '100%' }}></div>}
        
        {isUnavailable ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a', padding: '20px', textAlign: 'center' }}>
            <Info size={32} style={{ color: '#555', marginBottom: '8px' }} />
            <p style={{ fontSize: '0.85em', color: '#888' }}>Feed temporarily unavailable</p>
            <button 
              onClick={() => onZoomTo(cam)}
              style={{ marginTop: '12px', fontSize: '0.75em', background: 'var(--surface-hover)', padding: '6px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)' }}
            >
              <Navigation size={12} /> View Nearest Camera
            </button>
          </div>
        ) : (
          <img 
            src={cam.imageUrl} 
            alt={cam.name}
            onLoad={() => setImgLoaded(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s' }}
            onError={(e) => { e.target.src = 'https://via.placeholder.com/600x400/333333/ffffff?text=Image+Unavailable'; }}
          />
        )}
        
        <button 
          onClick={() => setIsFull(!isFull)}
          style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.5)', p: '4px', borderRadius: '4px', color: 'white' }}
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* Footer Info */}
      <div style={{ padding: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.8em', color: '#888' }}>{timeAgo}</span>
          <button style={{ fontSize: '0.8em', color: '#666', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Flag size={12} /> Report
          </button>
        </div>
        
        {cam.type && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.9em' }}>Speed Limit:</span>
            <span style={{ fontWeight: 'bold', border: '2px solid red', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.8em' }}>
              {cam.speedLimit}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Map({ trafficCameras, safetyCameras, filters }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div style={{ height: '100%', width: '100%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Map...</div>;

  return (
    <MapContainer 
      center={[-40.9006, 174.8860]} 
      zoom={6} 
      style={{ height: '100%', width: '100%', zIndex: 1 }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />

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
  );
}
