'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Camera, AlertTriangle, Info } from 'lucide-react';
import RoutingControl from './RoutingControl';

// Fix Leaflet's default icon paths in Next.js
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Icons
const createIcon = (color) => new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const trafficIcon = createIcon('blue');
const speedIcon = createIcon('red');
const redLightIcon = createIcon('orange');

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

      {filters.showTrafficCameras && trafficCameras.map(cam => (
        <Marker key={cam.id} position={[cam.latitude, cam.longitude]} icon={trafficIcon}>
          <Popup className="custom-popup">
            <div style={{ padding: '8px', minWidth: '250px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--primary)' }}>
                <Camera size={18} />
                <strong style={{ fontSize: '1.1em' }}>{cam.name}</strong>
              </div>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.9em', color: '#ccc' }}>{cam.description}</p>
              <div style={{ width: '100%', height: '150px', backgroundColor: '#333', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                <img 
                  src={cam.imageUrl} 
                  alt={cam.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/600x400/333333/ffffff?text=Image+Unavailable'; }}
                />
                <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.7)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75em' }}>
                  Live
                </div>
              </div>
              <div style={{ marginTop: '12px', fontSize: '0.8em', color: '#888' }}>
                Updated: {new Date(cam.updatedAt).toLocaleTimeString()}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {filters.showSafetyCameras && safetyCameras.map(cam => (
        <Marker 
          key={cam.id} 
          position={[cam.latitude, cam.longitude]} 
          icon={cam.type === 'Speed' ? speedIcon : redLightIcon}
        >
          <Popup>
            <div style={{ padding: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: cam.type === 'Speed' ? 'var(--danger)' : 'var(--warning)' }}>
                <AlertTriangle size={18} />
                <strong style={{ fontSize: '1.1em' }}>{cam.type} Camera</strong>
              </div>
              <p style={{ margin: '0 0 8px 0' }}>{cam.location}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-hover)', padding: '8px', borderRadius: '6px' }}>
                <span>Speed Limit:</span>
                <span style={{ fontWeight: 'bold', border: '2px solid red', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                  {cam.speedLimit}
                </span>
              </div>
              <div style={{ marginTop: '8px', fontSize: '0.85em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Info size={14} /> Status: <span style={{ color: cam.status === 'Active' ? 'var(--accent)' : '#888' }}>{cam.status}</span>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      <RoutingControl />
    </MapContainer>
  );
}
