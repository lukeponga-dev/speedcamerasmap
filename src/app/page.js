'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';

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
    <main style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative' }}>
      {/* Mobile Sidebar Toggle Button */}
      <button 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          zIndex: 20,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--foreground)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
        }}
        className="mobile-toggle-btn"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>

      {/* Sidebar Container */}
      <div 
        className={`sidebar-container ${sidebarOpen ? 'open' : ''}`}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 15,
          transition: 'transform 0.3s ease',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          width: '320px',
          maxWidth: '80vw'
        }}
      >
        <Sidebar 
          filters={filters} 
          setFilters={setFilters} 
          stats={{
            trafficCount: trafficCameras.length,
            safetyCount: safetyCameras.length
          }}
          closeSidebar={() => setSidebarOpen(false)}
        />
      </div>
      
      {/* Overlay for mobile when sidebar is open */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="sidebar-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 14,
            display: 'block'
          }}
        />
      )}

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
