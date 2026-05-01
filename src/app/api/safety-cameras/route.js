import { NextResponse } from 'next/server';

// Mock data for safety cameras (speed, red light) in New Zealand
const mockSafetyCameras = [
  {
    id: "sc-1",
    type: "Speed",
    location: "SH1 Waterview Tunnel, Auckland",
    latitude: -36.881267,
    longitude: 174.707736,
    speedLimit: 80,
    status: "Active"
  },
  {
    id: "sc-2",
    type: "Red Light",
    location: "Intersection of Queen St and Victoria St, Auckland",
    latitude: -36.848461,
    longitude: 174.763336,
    speedLimit: 50,
    status: "Active"
  },
  {
    id: "sc-3",
    type: "Speed",
    location: "SH1 Transmission Gully, Wellington",
    latitude: -41.076839,
    longitude: 174.939227,
    speedLimit: 100,
    status: "Active"
  },
  {
    id: "sc-4",
    type: "Speed",
    location: "Brougham St, Christchurch",
    latitude: -43.546312,
    longitude: 172.639194,
    speedLimit: 60,
    status: "Inactive"
  },
  {
    id: "sc-5",
    type: "Red Light",
    location: "Vivian St and Cuba St, Wellington",
    latitude: -41.295159,
    longitude: 174.774577,
    speedLimit: 50,
    status: "Active"
  }
];

export async function GET() {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  return NextResponse.json({
    success: true,
    data: mockSafetyCameras,
    timestamp: new Date().toISOString()
  });
}
