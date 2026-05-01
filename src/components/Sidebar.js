'use client';

import { Camera, AlertTriangle, ShieldCheck, TrendingUp, Info, Activity, ChevronRight, Layers, TriangleAlert, Construction, CloudSnow, CircleSlash } from 'lucide-react';

function FilterToggle({ label, sublabel, icon, color, checked, onChange }) {
  return (
    <label className="glass-card" style={{ 
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
      padding: '16px', borderRadius: '16px',
      cursor: 'pointer', transition: 'all 0.3s ease',
      background: checked ? `rgba(${color}, 0.08)` : 'rgba(255, 255, 255, 0.02)',
      borderColor: checked ? `rgba(${color}, 0.3)` : 'var(--glass-border)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ 
          background: checked ? `rgb(${color})` : 'rgba(255,255,255,0.05)', 
          padding: '10px', borderRadius: '12px', transition: 'all 0.3s ease'
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95em', color: checked ? 'white' : '#aaa' }}>{label}</div>
          <div style={{ fontSize: '0.75em', color: checked ? `rgba(${color}, 0.9)` : '#555', fontWeight: 600 }}>
            {sublabel}
          </div>
        </div>
      </div>
      <div style={{ position: 'relative', width: '20px', height: '20px' }}>
        <input 
          type="checkbox" 
          checked={checked}
          onChange={onChange}
          style={{ cursor: 'pointer', opacity: 0, position: 'absolute', inset: 0, zIndex: 2 }}
        />
        <div style={{ 
          width: '100%', height: '100%', border: '2px solid', 
          borderColor: checked ? `rgb(${color})` : '#444',
          borderRadius: '6px', background: checked ? `rgb(${color})` : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
        }}>
          {checked && <div style={{ width: '6px', height: '10px', borderBottom: '2px solid white', borderRight: '2px solid white', transform: 'rotate(45deg) translate(-1px, -1px)' }} />}
        </div>
      </div>
    </label>
  );
}

const INCIDENT_ICONS = {
  'Crash':        { emoji: '💥', label: 'Crash' },
  'Roadworks':    { emoji: '🚧', label: 'Roadworks' },
  'Road Closure': { emoji: '🚫', label: 'Road Closure' },
  'Weather':      { emoji: '❄️', label: 'Weather' },
  'Congestion':   { emoji: '🚗', label: 'Congestion' },
  'Hazard':       { emoji: '⚠️', label: 'Hazard' },
};

const SEVERITY_COLORS = {
  'Road Closure': '#dc2626',
  'Major':        '#f97316',
  'Moderate':     '#eab308',
  'Minor':        '#6b7280',
};

export default function Sidebar({ filters, setFilters, stats, trafficCameras, incidents = [], closeSidebar }) {
  const hotspots = trafficCameras.slice(0, 5);

  // Get top incidents sorted by severity
  const topIncidents = [...incidents]
    .sort((a, b) => {
      const order = { 'Road Closure': 0, 'Major': 1, 'Moderate': 2, 'Minor': 3 };
      return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
    })
    .slice(0, 5);

  return (
    <aside className="glass-panel" style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      zIndex: 10,
      overflowY: 'auto',
      borderRight: '1px solid var(--glass-border)',
      background: 'linear-gradient(180deg, rgba(15, 15, 18, 0.9) 0%, rgba(5, 5, 5, 0.95) 100%)'
    }}>
      {/* Header */}
      <div style={{ padding: '40px 24px 32px', borderBottom: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
          <div style={{ 
            background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
            padding: '10px', borderRadius: '14px', boxShadow: '0 8px 20px var(--primary-glow)'
          }}>
            <ShieldCheck size={28} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4em', margin: 0, fontWeight: 900, letterSpacing: '-0.8px', color: 'white', lineHeight: 1.1 }}>
              NZTA Watch
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <div className="pulse-dot" style={{ width: 6, height: 6, backgroundColor: 'var(--accent)' }}></div>
              <span style={{ fontSize: '0.65em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 800, letterSpacing: '1px' }}>System Live</span>
            </div>
          </div>
        </div>
        <p style={{ margin: '16px 0 0 0', color: '#888', fontSize: '0.85em', lineHeight: 1.6, fontWeight: 500 }}>
          Advanced real-time traffic aggregation and safety monitoring platform.
        </p>
      </div>

      <div style={{ padding: '32px 24px', flex: 1 }}>
        {/* Datasets Section */}
        <h2 style={{ 
          fontSize: '0.7em', textTransform: 'uppercase', letterSpacing: '2px', 
          color: '#555', marginBottom: '20px', fontWeight: 800,
          display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <Layers size={14} /> Active Datasets
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FilterToggle
            label="Traffic Cameras"
            sublabel={`${stats.trafficCount} sensors connected`}
            color="59, 130, 246"
            checked={filters.showTrafficCameras}
            icon={<Camera size={20} color={filters.showTrafficCameras ? 'white' : '#666'} />}
            onChange={(e) => setFilters(prev => ({ ...prev, showTrafficCameras: e.target.checked }))}
          />
          <FilterToggle
            label="Safety Cameras"
            sublabel={`${stats.safetyCount} active zones`}
            color="239, 68, 68"
            checked={filters.showSafetyCameras}
            icon={<AlertTriangle size={20} color={filters.showSafetyCameras ? 'white' : '#666'} />}
            onChange={(e) => setFilters(prev => ({ ...prev, showSafetyCameras: e.target.checked }))}
          />
          <FilterToggle
            label="Incidents & Events"
            sublabel={stats.incidentSource === 'live'
              ? `${stats.incidentCount} live incidents`
              : `${stats.incidentCount} incidents (sample data)`}
            color="245, 158, 11"
            checked={filters.showIncidents}
            icon={<TriangleAlert size={20} color={filters.showIncidents ? 'white' : '#666'} />}
            onChange={(e) => setFilters(prev => ({ ...prev, showIncidents: e.target.checked }))}
          />
          <FilterToggle
            label="Police Stations"
            sublabel={stats.policeSource === 'osm-live'
              ? `${stats.policeCount} stations · OSM live`
              : `${stats.policeCount} stations`}
            color="29, 78, 216"
            checked={filters.showPolice}
            icon={<span style={{ fontSize: '1.1em', lineHeight: 1 }}>🚨</span>}
            onChange={(e) => setFilters(prev => ({ ...prev, showPolice: e.target.checked }))}
          />
        </div>

        {/* Live Incidents Section */}
        {incidents.length > 0 && (
          <div style={{ marginTop: '40px' }}>
            <h2 style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7em', 
              textTransform: 'uppercase', letterSpacing: '2px', color: '#555', 
              marginBottom: '16px', fontWeight: 800 
            }}>
              <TriangleAlert size={14} color="var(--warning)" /> Active Incidents
              {stats.incidentSource === 'live' && (
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div className="pulse-dot" style={{ width: 5, height: 5 }}></div>
                  <span style={{ color: 'var(--accent)' }}>Live</span>
                </span>
              )}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {topIncidents.map((incident, i) => {
                const ic = INCIDENT_ICONS[incident.type] || { emoji: '⚠️' };
                const color = SEVERITY_COLORS[incident.severity] || '#6b7280';
                return (
                  <div key={i} className="glass-card" style={{ 
                    padding: '12px 14px', borderRadius: '14px', cursor: 'pointer',
                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                    borderLeft: `3px solid ${color}`,
                  }} onClick={() => {
                    document.dispatchEvent(new CustomEvent('focusCamera', { 
                      detail: { latitude: incident.latitude, longitude: incident.longitude }
                    }));
                    if (window.innerWidth < 768) closeSidebar();
                  }}>
                    <span style={{ fontSize: '1.3em', lineHeight: 1 }}>{ic.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.85em', fontWeight: 700, color: '#eee' }}>{incident.type}</span>
                        <span style={{ 
                          fontSize: '0.6em', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px',
                          padding: '2px 8px', borderRadius: '20px', background: color, color: 'white'
                        }}>{incident.severity}</span>
                      </div>
                      <div style={{ fontSize: '0.75em', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {incident.location}
                      </div>
                    </div>
                    <ChevronRight size={14} color="#333" style={{ flexShrink: 0, marginTop: '2px' }} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Hotspots Section */}
        <div style={{ marginTop: '40px' }}>
          <h2 style={{ 
            display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7em', 
            textTransform: 'uppercase', letterSpacing: '2px', color: '#555', 
            marginBottom: '20px', fontWeight: 800 
          }}>
            <TrendingUp size={14} /> Traffic Hotspots
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {hotspots.length > 0 ? hotspots.map((cam, i) => (
              <div key={i} className="glass-card" style={{ 
                padding: '14px', borderRadius: '14px',
                display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer'
              }} onClick={() => {
                document.dispatchEvent(new CustomEvent('focusCamera', { detail: cam }));
                if (window.innerWidth < 768) closeSidebar();
              }}>
                <div style={{ 
                  fontSize: '0.75em', fontWeight: 900, 
                  color: i < 2 ? 'var(--warning)' : '#444', width: '24px', textAlign: 'center'
                }}>0{i+1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85em', fontWeight: 700, color: '#eee', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cam.name}</div>
                  <div style={{ fontSize: '0.7em', color: '#666', fontWeight: 600 }}>High congestion density</div>
                </div>
                <ChevronRight size={14} color="#333" />
              </div>
            )) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#444', fontSize: '0.8em', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.05)' }}>
                Searching for hotspots...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '24px', borderTop: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#666', fontSize: '0.75em', marginBottom: '12px', fontWeight: 600 }}>
          <Activity size={14} color="var(--accent)" />
          <span>Real-time telemetry active · Incidents refresh every 2 min</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7em', color: '#444', fontWeight: 700 }}>v2.6.0-PRO</span>
          <div style={{ display: 'flex', gap: '12px' }}>
             <Info size={14} color="#333" style={{ cursor: 'pointer' }} />
          </div>
        </div>
      </div>
    </aside>
  );
}
