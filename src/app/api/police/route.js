import { NextResponse } from 'next/server';

// ── Overpass API query for all NZ police amenities ──────────────────────────
// Uses [out:json] with center output so ways/relations get a lat/lon centroid.
// outSrs=4326 ensures WGS84 output where supported; nodes always have lat/lon.
const OVERPASS_QUERY = `[out:json][timeout:40];
area["ISO3166-1"="NZ"][admin_level=2]->.nz;
nwr["amenity"="police"](area.nz);
out center tags;`.trim();

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Determine station type from tags
function classifyStation(tags) {
  const name = (tags.name || tags['name:en'] || '').toLowerCase();
  const description = (tags.description || '').toLowerCase();

  if (name.includes('dog') || name.includes('k9'))        return 'Dog Unit';
  if (name.includes('traffic') || name.includes('road'))  return 'Traffic Police';
  if (name.includes('community'))                          return 'Community Station';
  if (name.includes('airport'))                            return 'Airport Police';
  if (name.includes('marine') || name.includes('harbour')) return 'Marine Unit';
  if (name.includes('mounted'))                            return 'Mounted Unit';
  if (description.includes('community'))                   return 'Community Station';
  return 'Police Station';
}

// Get district from name or address tags
function getDistrict(tags) {
  if (tags['addr:city'])   return tags['addr:city'];
  if (tags['addr:suburb']) return tags['addr:suburb'];
  if (tags.name) {
    // Try extracting location from name e.g. "Auckland Central Police Station"
    const m = tags.name.match(/^(.+?)\s+(?:Police|Community)/i);
    if (m) return m[1].trim();
  }
  return 'New Zealand';
}

export async function GET() {
  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'NZTAWatch/2.6 (nzta-watch-app)',
      },
      body: `data=${encodeURIComponent(OVERPASS_QUERY)}`,
      next: { revalidate: 3600 }, // Cache for 1 hour – stations rarely move
    });

    if (!response.ok) {
      console.error(`Overpass API error: ${response.status}`);
      return NextResponse.json({ success: true, data: getMockPolice(), source: 'mock' });
    }

    const raw = await response.json();

    if (!raw.elements || !Array.isArray(raw.elements)) {
      return NextResponse.json({ success: true, data: getMockPolice(), source: 'mock' });
    }

    const stations = raw.elements
      .map(el => {
        // Nodes have lat/lon directly; ways/relations have a `center`
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        const tags = el.tags || {};

        if (!lat || !lon) return null;

        // Sanity check – must be within NZ bounding box
        if (lat < -48 || lat > -33 || lon < 165 || lon > 180) return null;

        const name = tags.name || tags['name:en'] || 'Police Station';

        return {
          id:        `osm-${el.id}`,
          osmId:     el.id,
          osmType:   el.type,
          name,
          type:      classifyStation(tags),
          district:  getDistrict(tags),
          latitude:  lat,
          longitude: lon,
          address:   [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb']]
                       .filter(Boolean).join(' ') || null,
          phone:     tags.phone || tags['contact:phone'] || null,
          website:   tags.website || tags['contact:website'] || null,
          operator:  tags.operator || 'New Zealand Police',
          openingHours: tags.opening_hours || '24/7',
          emergency: tags.emergency || null,
        };
      })
      .filter(Boolean);

    // Sort: named stations first, then by lat (north to south)
    stations.sort((a, b) => {
      const aHasName = !a.name.startsWith('Police') ? 0 : 1;
      const bHasName = !b.name.startsWith('Police') ? 0 : 1;
      if (aHasName !== bHasName) return aHasName - bHasName;
      return a.latitude - b.latitude; // north first (less negative)
    });

    return NextResponse.json({
      success:   true,
      data:      stations,
      count:     stations.length,
      source:    'osm-live',
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('Police station fetch error:', err.message);
    return NextResponse.json({ success: true, data: getMockPolice(), source: 'mock' });
  }
}

function getMockPolice() {
  return [
    { id: 'mock-p1', osmId: null, osmType: 'node', name: 'Auckland Central Police Station', type: 'Police Station', district: 'Auckland', latitude: -36.8528, longitude: 174.7660, address: '12 College Hill, Auckland', phone: '+64 9 302 6400', website: 'https://www.police.govt.nz', operator: 'New Zealand Police', openingHours: '24/7', emergency: 'yes' },
    { id: 'mock-p2', osmId: null, osmType: 'node', name: 'Wellington Central Police Station', type: 'Police Station', district: 'Wellington', latitude: -41.2924, longitude: 174.7787, address: '41 Victoria Street, Wellington', phone: '+64 4 381 2000', website: 'https://www.police.govt.nz', operator: 'New Zealand Police', openingHours: '24/7', emergency: 'yes' },
    { id: 'mock-p3', osmId: null, osmType: 'node', name: 'Christchurch Central Police Station', type: 'Police Station', district: 'Christchurch', latitude: -43.5345, longitude: 172.6363, address: '40 Lichfield Street, Christchurch', phone: '+64 3 363 7400', website: 'https://www.police.govt.nz', operator: 'New Zealand Police', openingHours: '24/7', emergency: 'yes' },
    { id: 'mock-p4', osmId: null, osmType: 'node', name: 'Hamilton Central Police Station', type: 'Police Station', district: 'Hamilton', latitude: -37.7870, longitude: 175.2793, address: '1 Bridge Street, Hamilton', phone: '+64 7 858 6200', website: 'https://www.police.govt.nz', operator: 'New Zealand Police', openingHours: '24/7', emergency: 'yes' },
    { id: 'mock-p5', osmId: null, osmType: 'node', name: 'Dunedin Central Police Station', type: 'Police Station', district: 'Dunedin', latitude: -45.8788, longitude: 170.5028, address: '25 Great King Street, Dunedin', phone: '+64 3 471 4800', website: 'https://www.police.govt.nz', operator: 'New Zealand Police', openingHours: '24/7', emergency: 'yes' },
  ];
}
