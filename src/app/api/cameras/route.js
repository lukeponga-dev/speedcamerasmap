import { NextResponse } from 'next/server';

export async function GET() {
  const endpoint = "https://trafficnz.info/service/traffic/rest/4";

  try {
    const response = await fetch(endpoint, {
      headers: {
        'Accept': 'application/json',
      },
      // You can add caching strategies here if needed
      next: { revalidate: 60 } // Cache for 60 seconds
    });

    if (!response.ok) {
      console.error(`Upstream API returned status: ${response.status}`);
      // Fallback to mock data if the upstream fails, so the UI doesn't break
      return NextResponse.json({
        success: false,
        error: `Upstream returned ${response.status}`,
        data: getMockCameras(),
        timestamp: new Date().toISOString()
      }, { status: response.status === 404 ? 200 : response.status }); // Send 200 with mock data on 404
    }

    const data = await response.json();
    
    // Attempt to map the data. If the structure is unknown, we might just pass it raw
    // or map it if we can infer the structure.
    // For now, we will assume it returns an array of cameras or an object containing them.
    
    // We pass it down to the client. The client Map component may need to be updated
    // to handle the actual schema returned by this endpoint.
    return NextResponse.json({
      success: true,
      data: data,
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
