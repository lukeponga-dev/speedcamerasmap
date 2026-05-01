'use client';

import { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';
import 'leaflet-control-geocoder';

// Import CSS
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-control-geocoder/dist/Control.Geocoder.css';

export default function RoutingControl() {
  const map = useMap();
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    if (!map) return;

    // Get user location
    map.locate({ setView: true, maxZoom: 14 });

    const onLocationFound = (e) => {
      setUserLocation(e.latlng);
      
      // Add a custom marker for the user
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: '<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(59, 130, 246, 0.8);"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });
      
      L.marker(e.latlng, { icon: userIcon })
        .addTo(map)
        .bindPopup("You are here");

      // Setup Routing Machine
      const routingControl = L.Routing.control({
        waypoints: [
          e.latlng,
          null // The user will set the destination via the geocoder UI
        ],
        routeWhileDragging: true,
        showAlternatives: true,
        geocoder: L.Control.Geocoder.nominatim(),
        createMarker: function(i, wp, nWps) {
          if (i === 0) {
            // Start marker (user location)
            return L.marker(wp.latLng, { icon: userIcon, draggable: true });
          } else {
            // Destination marker
            return L.marker(wp.latLng, { draggable: true });
          }
        },
        // Make the UI look better in dark mode
        lineOptions: {
          styles: [{ color: '#3b82f6', opacity: 0.8, weight: 6 }]
        }
      }).addTo(map);

      // Save to map instance to prevent duplicate controls
      map.routingControl = routingControl;
    };

    const onLocationError = (e) => {
      alert("Could not access your location. " + e.message);
      // Still add routing control without starting waypoint
      L.Routing.control({
        routeWhileDragging: true,
        geocoder: L.Control.Geocoder.nominatim(),
        lineOptions: {
          styles: [{ color: '#3b82f6', opacity: 0.8, weight: 6 }]
        }
      }).addTo(map);
    };

    map.on('locationfound', onLocationFound);
    map.on('locationerror', onLocationError);

    return () => {
      map.off('locationfound', onLocationFound);
      map.off('locationerror', onLocationError);
      if (map.routingControl) {
        map.removeControl(map.routingControl);
      }
    };
  }, [map]);

  return null;
}
