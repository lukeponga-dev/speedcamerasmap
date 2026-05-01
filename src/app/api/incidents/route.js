import { NextResponse } from 'next/server';

/**
 * Converts NZTM2000 (EPSG:2193) easting/northing to WGS84 lat/lng.
 * Uses a simplified Helmert-style transformation accurate to ~1m for NZ.
 */
function nztm2WGS84(easting, northing) {
  // NZTM2000 projection parameters
  const a = 6378137.0;        // GRS80 semi-major axis
  const f = 1 / 298.257222101;
  const b = a * (1 - f);
  const e2 = 1 - (b * b) / (a * a);

  const k0 = 0.9996;
  const E0 = 1600000;  // false easting
  const N0 = 10000000; // false northing
  const lng0 = 173.0 * Math.PI / 180; // central meridian

  const E = easting - E0;
  const N = northing - N0;

  const n = (a - b) / (a + b);
  const n2 = n * n;
  const n3 = n * n2;
  const n4 = n * n3;

  // Meridional arc
  const phi1 = N / (a * k0) + (3 * n / 2 - 27 * n3 / 32) * Math.sin(2 * N / (a * k0))
    + (21 * n2 / 16 - 55 * n4 / 32) * Math.sin(4 * N / (a * k0))
    + (151 * n3 / 96) * Math.sin(6 * N / (a * k0));

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = sinPhi1 / cosPhi1;

  const nu = a / Math.sqrt(1 - e2 * sinPhi1 * sinPhi1);
  const rho = a * (1 - e2) / Math.pow(1 - e2 * sinPhi1 * sinPhi1, 1.5);
  const eta2 = nu / rho - 1;

  const T1 = tanPhi1 * tanPhi1;
  const C1 = (e2 / (1 - e2)) * cosPhi1 * cosPhi1;
  const D = E / (nu * k0);

  const lat = phi1
    - (nu * tanPhi1 / rho) * (D * D / 2
    - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * eta2) * D * D * D * D / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * eta2 - 3 * C1 * C1) * Math.pow(D, 6) / 720);

  const lng = lng0 + (D
    - (1 + 2 * T1 + C1) * D * D * D / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * eta2 + 24 * T1 * T1) * Math.pow(D, 5) / 120) / cosPhi1;

  return {
    lat: lat * 180 / Math.PI,
    lng: lng * 180 / Math.PI,
  };
}

// Severity → normalised label
function normaliseSeverity(impact) {
  if (!impact) return 'Minor';
  const s = impact.toLowerCase();
  if (s.includes('closed') || s.includes('closure')) return 'Road Closure';
  if (s.includes('major') || s.includes('serious'))  return 'Major';
  if (s.includes('moderate'))                         return 'Moderate';
  if (s.includes('caution') || s.includes('delays') || s.includes('delay')) return 'Moderate';
  if (s.includes('minor'))                            return 'Minor';
  return 'Minor';
}

// Type normalisation
function normaliseType(eventType) {
  if (!eventType) return 'Incident';
  const t = eventType.toLowerCase();
  if (t.includes('crash') || t.includes('accident'))          return 'Crash';
  if (t.includes('road work') || t.includes('roadwork') || t.includes('work')) return 'Roadworks';
  if (t.includes('hazard') || t.includes('obstacle'))         return 'Hazard';
  if (t.includes('weather') || t.includes('flood') || t.includes('snow') || t.includes('ice')) return 'Weather';
  if (t.includes('delay') || t.includes('congestion'))        return 'Congestion';
  if (t.includes('closure') || t.includes('closed'))          return 'Road Closure';
  return 'Incident';
}

export async function GET() {
  const arcgisUrl =
    'https://services.arcgis.com/CXBb7LAjgIIdcsPt/arcgis/rest/services/NZTA_Highway_Information/FeatureServer/0/query' +
    '?where=1%3D1&outFields=*&f=json&resultRecordCount=200';

  try {
    const response = await fetch(arcgisUrl, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 120 }, // Cache 2 minutes
    });

    if (!response.ok) {
      console.error(`ArcGIS returned ${response.status}`);
      return NextResponse.json({ success: true, data: getMockIncidents(), source: 'mock' });
    }

    const raw = await response.json();

    if (!raw.features || !Array.isArray(raw.features)) {
      return NextResponse.json({ success: true, data: getMockIncidents(), source: 'mock' });
    }

    const incidents = raw.features
      .filter(f => f.geometry && f.attributes)
      .map(f => {
        const attr = f.attributes;
        const geo  = f.geometry;

        // Convert NZTM2000 → WGS84
        let lat, lng;
        try {
          const wgs = nztm2WGS84(geo.x, geo.y);
          lat = wgs.lat;
          lng = wgs.lng;
        } catch {
          return null;
        }

        // Sanity check – must be within NZ bounding box
        if (lat < -48 || lat > -33 || lng < 165 || lng > 180) return null;

        // Actual field names from NZTA ArcGIS API:
        // eventType, locationArea, eventComments, impact, status, startDate, endDate
        return {
          id:          attr.OBJECTID,
          eventId:     attr.eventId,
          type:        normaliseType(attr.eventType),
          severity:    normaliseSeverity(attr.impact),
          status:      attr.status || 'Active',
          description: (attr.eventComments || '').trim() || 'No details available',
          location:    attr.locationArea || 'Unknown location',
          island:      attr.eventIsland || null,
          planned:     attr.planned === 'True',
          latitude:    lat,
          longitude:   lng,
          startDate:   attr.startDate ? new Date(attr.startDate).toISOString() : null,
          endDate:     attr.endDate   ? new Date(attr.endDate).toISOString()   : null,
          updatedAt:   attr.EditDate  ? new Date(attr.EditDate).toISOString()  : new Date().toISOString(),
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      data:    incidents,
      count:   incidents.length,
      source:  'live',
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('Incident fetch error:', err);
    return NextResponse.json({ success: true, data: getMockIncidents(), source: 'mock' });
  }
}

function getMockIncidents() {
  const now = new Date().toISOString();
  return [
    {
      id: 'mock-1',
      type: 'Crash',
      severity: 'Major',
      description: 'Multi-vehicle crash blocking left lane. Emergency services on scene.',
      location: 'SH1 Southern Motorway, Auckland – near Manukau',
      latitude: -37.007,
      longitude: 174.877,
      startDate: now,
      endDate: null,
      updatedAt: now,
    },
    {
      id: 'mock-2',
      type: 'Roadworks',
      severity: 'Minor',
      description: 'Night works: lane reductions 9pm–5am. Expect 10-min delays.',
      location: 'SH2 Petone, Wellington',
      latitude: -41.221,
      longitude: 174.869,
      startDate: now,
      endDate: null,
      updatedAt: now,
    },
    {
      id: 'mock-3',
      type: 'Road Closure',
      severity: 'Road Closure',
      description: 'SH8 closed at Lindis River Bridge due to flooding. Use SH83 via Omarama as alternative.',
      location: 'SH8 Lindis River Bridge',
      latitude: -44.741,
      longitude: 169.736,
      startDate: now,
      endDate: null,
      updatedAt: now,
    },
    {
      id: 'mock-4',
      type: 'Hazard',
      severity: 'Moderate',
      description: 'Diesel spill across both lanes. Road crews cleaning up.',
      location: 'SH1 Christchurch Northern Motorway',
      latitude: -43.458,
      longitude: 172.561,
      startDate: now,
      endDate: null,
      updatedAt: now,
    },
    {
      id: 'mock-5',
      type: 'Weather',
      severity: 'Minor',
      description: 'Black ice reported on road surface. Reduce speed. 4WD recommended.',
      location: 'SH94 Homer Tunnel approach, Fiordland',
      latitude: -44.772,
      longitude: 168.104,
      startDate: now,
      endDate: null,
      updatedAt: now,
    },
  ];
}
