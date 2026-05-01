'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import { Menu, X, Layers } from 'lucide-react';

// Dynamically import the Map component with ssr disabled
const Map = dynamic(() => import('@/components/Map'), { 
  ssr: false,
  loading: () => (
    <div style={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center', 
      background: 'var(--background)', 
      color: 'var(--primary)',
      gap: '20px'
    }}>
      <div className="pulse-dot" style={{ width: '12px', height: '12px' }}></div>
      <div style={{ fontWeight: 800, letterSpacing: '2px', fontSize: '0.8em', textTransform: 'uppercase', opacity: 0.6 }}>
        Initializing Navigation Engine
      </div>
    </div>
  )
});

export default function Home() {
  const [trafficCameras, setTrafficCameras] = useState([]);
  const [safetyCameras, setSafetyCameras] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [policeStations, setPoliceStations] = useState([]);
  const [incidentSource, setIncidentSource] = useState(null);
  const [policeSource, setPoliceSource] = useState(null);
  const [filters, setFilters] = useState({
    showTrafficCameras: true,
    showSafetyCameras: true,
    showIncidents: true,
    showPolice: true,
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [trafficRes, safetyRes, incidentsRes] = await Promise.all([
          fetch('/api/cameras').then(res => res.json()),
          fetch('/api/safety-cameras').then(res => res.json()),
          fetch('/api/incidents').then(res => res.json()),
        ]);

        if (trafficRes.success) setTrafficCameras(trafficRes.data);
        if (safetyRes.success) setSafetyCameras(safetyRes.data);
        if (incidentsRes.success) {
          setIncidents(incidentsRes.data);
          setIncidentSource(incidentsRes.source || 'mock');
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };

    // Police stations fetched separately (1hr cache, slower source)
    const fetchPolice = async () => {
      try {
        const res = await fetch('/api/police').then(r => r.json());
        if (res.success) {
          setPoliceStations(res.data);
          setPoliceSource(res.source || 'mock');
        }
      } catch (e) {
        console.error('Failed to fetch police data:', e);
      }
    };

    fetchData();
    fetchPolice();

    // Refresh incidents every 2 minutes
    const timer = setInterval(() => {
      fetch('/api/incidents').then(r => r.json()).then(d => {
        if (d.success) { setIncidents(d.data); setIncidentSource(d.source || 'mock'); }
      }).catch(() => {});
    }, 120_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main style={{ 
      display: 'flex', 
      height: '100vh', 
      width: '100vw', 
      overflow: 'hidden', 
      position: 'relative', 
      background: 'var(--background)' 
    }}>
      {/* Mobile Sidebar Toggle Button */}
      <button 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="mobile-toggle-btn glass-panel"
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 100,
          borderRadius: '14px',
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          border: '1px solid var(--glass-border)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Sidebar Container */}
      <div 
        className={`sidebar-container ${sidebarOpen ? 'open' : ''}`}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 50,
          transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          width: '320px',
          maxWidth: '85vw',
          boxShadow: sidebarOpen ? '20px 0 60px rgba(0,0,0,0.8)' : 'none'
        }}
      >
        <Sidebar 
          filters={filters} 
          setFilters={setFilters} 
          stats={{
            trafficCount: trafficCameras.length,
            safetyCount: safetyCameras.length,
            incidentCount: incidents.length,
            incidentSource,
            policeCount: policeStations.length,
            policeSource,
          }}
          trafficCameras={trafficCameras}
          incidents={incidents}
          policeStations={policeStations}
          closeSidebar={() => setSidebarOpen(false)}
        />
      </div>
      
      {/* Overlay for mobile when sidebar is open */}
      <div 
        onClick={() => setSidebarOpen(false)}
        className="sidebar-overlay"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 40,
          display: sidebarOpen ? 'block' : 'none',
          opacity: sidebarOpen ? 1 : 0,
          transition: 'opacity 0.5s ease',
          animation: sidebarOpen ? 'fadeIn 0.5s ease' : 'none'
        }}
      />

      {/* Map Container */}
      <div style={{ flex: 1, position: 'relative', height: '100%', width: '100%' }}>
        <Map 
          trafficCameras={trafficCameras} 
          safetyCameras={safetyCameras} 
          incidents={incidents}
          policeStations={policeStations}
          filters={filters} 
        />
      </div>
    </main>
  );
}
