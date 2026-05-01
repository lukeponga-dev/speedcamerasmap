import { NextResponse } from 'next/server';

export async function GET() {
  const endpoint = "https://trafficnz.info/service/traffic/rest/4/cameras/all";

  try {
    const response = await fetch(endpoint, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 60 } // Cache for 60 seconds
    });

    if (!response.ok) {
      console.error(`Upstream API returned status: ${response.status}`);
      return NextResponse.json({
        success: false,
        error: `Upstream returned ${response.status}`,
        data: getMockCameras(),
        timestamp: new Date().toISOString()
      }, { status: response.status === 404 ? 200 : response.status });
    }

    const rawData = await response.json();
    let mappedData = [];

    if (rawData?.response?.camera) {
      // Ensure it's an array (in case there's only 1 camera, it might be an object)
      const cameras = Array.isArray(rawData.response.camera) ? rawData.response.camera : [rawData.response.camera];
      
      mappedData = cameras.map(cam => ({
        id: cam.id,
        name: cam.name || `Camera ${cam.id}`,
        description: cam.description || '',
        latitude: cam.latitude,
        longitude: cam.longitude,
        imageUrl: cam.imageUrl ? `https://trafficnz.info${cam.imageUrl}` : 'https://via.placeholder.com/600x400/333333/ffffff?text=No+Image',
        direction: cam.direction || 'Unknown',
        updatedAt: new Date().toISOString() // Assuming the feed is live
      }));
    } else {
      mappedData = getMockCameras();
    }

    return NextResponse.json({
      success: true,
      data: mappedData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error fetching cameras:", error);
    return NextResponse.json({
      success: false,
      error: error.message,
      data: getMockCameras()
    }, { status: 500 });
  }
}

function getMockCameras() {
  return [
    {
      id: "cam-1",
      name: "SH1 Auckland Harbour Bridge (MOCK)",
      description: "Looking North towards North Shore",
      latitude: -36.831505,
      longitude: 174.746092,
      imageUrl: "https://via.placeholder.com/600x400/171717/ededed?text=Auckland+Harbour+Bridge+Live+Feed",
      region: "Auckland",
      direction: "North",
      updatedAt: new Date().toISOString()
    },
    {
      id: "cam-2",
      name: "SH1 Wellington Urban Motorway (MOCK)",
      description: "Ngauranga Gorge Interchange",
      latitude: -41.244907,
      longitude: 174.805216,
      imageUrl: "https://via.placeholder.com/600x400/171717/ededed?text=Wellington+Urban+Motorway",
      region: "Wellington",
      direction: "South",
      updatedAt: new Date().toISOString()
    }
  ];
}
