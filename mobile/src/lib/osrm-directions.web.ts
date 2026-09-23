import type { LatLng } from '@/lib/map-route';

export interface RoadDirectionsResult {
  points: LatLng[];
  distance_meters: number | null;
  duration_seconds: number | null;
}

interface OsrmRouteResponse {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: { coordinates?: Array<[number, number]> };
  }>;
}

/** Free road routing fallback (OpenStreetMap / OSRM). No API key required. */
export async function fetchOsrmDirections(origin: LatLng, destination: LatLng): Promise<RoadDirectionsResult> {
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  let resp: Response;
  try {
    resp = await fetch(url);
  } catch {
    throw new Error('OSRM network error');
  }

  if (!resp.ok) throw new Error(`OSRM HTTP ${resp.status}`);

  const data = (await resp.json()) as OsrmRouteResponse;
  const route = data.routes?.[0];
  const geometry = route?.geometry?.coordinates ?? [];

  if (data.code !== 'Ok' || !route || geometry.length < 2) {
    throw new Error('OSRM no route');
  }

  return {
    points: geometry.map(([lng, lat]) => ({ lat, lng })),
    distance_meters: Math.round(route.distance),
    duration_seconds: Math.round(route.duration),
  };
}
