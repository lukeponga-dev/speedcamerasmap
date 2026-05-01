import { Camera, AlertTriangle, ShieldCheck, MapPin } from 'lucide-react';

export default function Sidebar({ filters, setFilters, stats }) {
  return (
    <aside style={{
      width: '320px',
      height: '100vh',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      zIndex: 10,
      boxShadow: '4px 0 15px rgba(0,0,0,0.5)',
      overflowY: 'auto'
    }}>
      <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(180deg, rgba(38,38,38,1) 0%, rgba(23,23,23,1) 100%)' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.5em', margin: 0, fontWeight: 700, letterSpacing: '-0.5px' }}>
          <ShieldCheck size={28} color="var(--primary)" />
          NZTA Watch
        </h1>
        <p style={{ margin: '8px 0 0 0', color: '#888', fontSize: '0.9em', lineHeight: 1.4 }}>
          Live traffic & safety camera monitoring across New Zealand.
        </p>
      </div>

      <div style={{ padding: '24px', flex: 1 }}>
        <h2 style={{ fontSize: '0.85em', textTransform: 'uppercase', letterSpacing: '1px', color: '#666', marginBottom: '16px' }}>Filters</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
            padding: '16px', background: 'var(--surface-hover)', borderRadius: 'var(--radius)',
            cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.2s'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '8px', borderRadius: '8px' }}>
                <Camera size={20} color="var(--primary)" />
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>Traffic Cameras</div>
                <div style={{ fontSize: '0.8em', color: '#888' }}>Live road conditions</div>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={filters.showTrafficCameras}
              onChange={(e) => setFilters(prev => ({ ...prev, showTrafficCameras: e.target.checked }))}
              style={{ width: '20px', height: '20px', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
          </label>

          <label style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
            padding: '16px', background: 'var(--surface-hover)', borderRadius: 'var(--radius)',
            cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.2s'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '8px' }}>
                <AlertTriangle size={20} color="var(--danger)" />
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>Safety Cameras</div>
                <div style={{ fontSize: '0.8em', color: '#888' }}>Speed & Red Light</div>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={filters.showSafetyCameras}
              onChange={(e) => setFilters(prev => ({ ...prev, showSafetyCameras: e.target.checked }))}
              style={{ width: '20px', height: '20px', accentColor: 'var(--danger)', cursor: 'pointer' }}
            />
          </label>
        </div>

        <div style={{ marginTop: '32px' }}>
          <h2 style={{ fontSize: '0.85em', textTransform: 'uppercase', letterSpacing: '1px', color: '#666', marginBottom: '16px' }}>Network Stats</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '16px', borderRadius: 'var(--radius)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8em', fontWeight: 'bold', color: 'var(--primary)' }}>{stats.trafficCount}</div>
              <div style={{ fontSize: '0.75em', color: '#888', marginTop: '4px' }}>Traffic Cams</div>
            </div>
            <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '16px', borderRadius: 'var(--radius)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8em', fontWeight: 'bold', color: 'var(--danger)' }}>{stats.safetyCount}</div>
              <div style={{ fontSize: '0.75em', color: '#888', marginTop: '4px' }}>Safety Cams</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '24px', borderTop: '1px solid var(--border)', fontSize: '0.8em', color: '#666', textAlign: 'center' }}>
        <p>Data provided by mock NZTA Open Data.</p>
      </div>
    </aside>
  );
}
