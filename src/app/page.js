'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import { Menu, X } from 'lucide-react';

// Dynamically import the Map component with ssr disabled
const Map = dynamic(() => import('@/components/Map'), { 
  ssr: false,
  loading: () => <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', color: 'var(--primary)' }}>Loading Map Application...</div>
});

export default function Home() {
  const [trafficCameras, setTrafficCameras] = useState([]);
  const [safetyCameras, setSafetyCameras] = useState([]);
  const [filters, setFilters] = useState({
    showTrafficCameras: true,
    showSafetyCameras: true
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Fetch data from our API routes
    const fetchData = async () => {
      try {
        const [trafficRes, safetyRes] = await Promise.all([
          fetch('/api/cameras').then(res => res.json()),
          fetch('/api/safety-cameras').then(res => res.json())
        ]);

        if (trafficRes.success) setTrafficCameras(trafficRes.data);
        if (safetyRes.success) setSafetyCameras(safetyRes.data);
      } catch (error) {
        console.error("Failed to fetch camera data:", error);
      }
    };

    fetchData();
  }, []);

  return (
    <main style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative', background: '#000' }}>
      {/* Mobile Sidebar Toggle Button */}
      <button 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="mobile-toggle-btn glass-panel"
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 25,
          borderRadius: '12px',
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          transition: 'all 0.2s ease'
        }}
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar Container */}
      <div 
        className={`sidebar-container ${sidebarOpen ? 'open' : ''}`}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 20,
          transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          width: '320px',
          maxWidth: '85vw'
        }}
      >
        <Sidebar 
          filters={filters} 
          setFilters={setFilters} 
          stats={{
            trafficCount: trafficCameras.length,
            safetyCount: safetyCameras.length
          }}
          trafficCameras={trafficCameras}
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
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 15,
          display: sidebarOpen ? 'block' : 'none',
          opacity: sidebarOpen ? 1 : 0,
          transition: 'opacity 0.4s ease'
        }}
      />

      {/* Map Container */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Map 
          trafficCameras={trafficCameras} 
          safetyCameras={safetyCameras} 
          filters={filters} 
        />
      </div>
    </main>
  );
}
