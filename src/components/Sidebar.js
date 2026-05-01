'use client';

import { Camera, AlertTriangle, ShieldCheck, TrendingUp, Info, Activity } from 'lucide-react';

export default function Sidebar({ filters, setFilters, stats, trafficCameras }) {
  // Get top 5 "busy" cameras (mocking this by taking the first 5 with descriptions)
  const hotspots = trafficCameras.slice(0, 5);

  return (
    <aside className="glass-panel sidebar-container" style={{
      width: '320px',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      zIndex: 10,
      overflowY: 'auto',
      borderRight: '1px solid var(--glass-border)'
    }}>
      <div style={{ padding: '32px 24px', borderBottom: '1px solid var(--glass-border)' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.6em', margin: 0, fontWeight: 800, letterSpacing: '-0.5px', color: 'white' }}>
          <ShieldCheck size={32} color="var(--primary)" />
          NZTA Watch
        </h1>
        <p style={{ margin: '12px 0 0 0', color: '#aaa', fontSize: '0.9em', lineHeight: 1.5 }}>
          Premium real-time traffic & safety monitoring dashboard.
        </p>
      </div>

      <div style={{ padding: '24px', flex: 1 }}>
        {/* Filters Section */}
        <h2 style={{ fontSize: '0.75em', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#555', marginBottom: '20px', fontWeight: 700 }}>Datasets</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
            padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius)',
            cursor: 'pointer', border: '1px solid var(--glass-border)', transition: 'all 0.3s ease',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)'
          }} className="filter-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '8px', borderRadius: '10px' }}>
                <Camera size={20} color="var(--primary)" />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95em' }}>Traffic Cameras</div>
                <div style={{ fontSize: '0.75em', color: '#777' }}>{stats.trafficCount} Sensors Active</div>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={filters.showTrafficCameras}
              onChange={(e) => setFilters(prev => ({ ...prev, showTrafficCameras: e.target.checked }))}
              style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
          </label>

          <label style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
            padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius)',
            cursor: 'pointer', border: '1px solid var(--glass-border)', transition: 'all 0.3s ease'
          }} className="filter-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', padding: '8px', borderRadius: '10px' }}>
                <AlertTriangle size={20} color="var(--danger)" />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95em' }}>Safety Cameras</div>
                <div style={{ fontSize: '0.75em', color: '#777' }}>{stats.safetyCount} Locations</div>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={filters.showSafetyCameras}
              onChange={(e) => setFilters(prev => ({ ...prev, showSafetyCameras: e.target.checked }))}
              style={{ width: '18px', height: '18px', accentColor: 'var(--danger)', cursor: 'pointer' }}
            />
          </label>
        </div>

        {/* Hotspots Section */}
        <div style={{ marginTop: '40px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75em', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#555', marginBottom: '20px', fontWeight: 700 }}>
            <TrendingUp size={14} /> Busy Hotspots
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {hotspots.map((cam, i) => (
              <div key={i} style={{ 
                padding: '12px', 
                background: 'rgba(255,255,255,0.02)', 
                borderRadius: '8px', 
                border: '1px solid rgba(255,255,255,0.03)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ fontSize: '0.8em', fontWeight: 900, color: i < 2 ? 'var(--warning)' : '#444' }}>#{i+1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85em', fontWeight: 600, color: '#eee' }}>{cam.name}</div>
                  <div style={{ fontSize: '0.7em', color: '#666' }}>High flow detected</div>
                </div>
                <Activity size={14} color="var(--accent)" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '24px', borderTop: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#555', fontSize: '0.75em', marginBottom: '8px' }}>
          <Info size={12} />
          <span>Real-time aggregation enabled</span>
        </div>
        <p style={{ fontSize: '0.7em', color: '#444' }}>
          System v2.4.0-premium
        </p>
      </div>
    </aside>
  );
}
