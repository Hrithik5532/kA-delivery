/**
 * Shortest-by-road directions for the admin maps.
 *
 * The backend /maps/directions endpoint is rider-only (require_rider), so admin
 * fetches road geometry directly from the public OSRM server. It is CORS-enabled
 * and needs no API key, and returns the shortest driving route by road.
 */
export interface RoadRoute {
  /** Leaflet-style [lat, lng] tuples following the road. */
  points: [number, number][];
  distanceMeters: number | null;
  durationSeconds: number | null;
}

interface OsrmRouteResponse {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: { coordinates?: Array<[number, number]> };
  }>;
}

/**
 * Fetch the driving route between two points. Returns null when routing is
 * unavailable (network/no route) so callers can fall back to a straight line.
 */
export async function fetchRoadRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<RoadRoute | null> {
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  try {
    const resp = await fetch(url, { signal });
    if (!resp.ok) return null;
    const data = (await resp.json()) as OsrmRouteResponse;
    const route = data.routes?.[0];
    const geometry = route?.geometry?.coordinates ?? [];
    if (data.code !== 'Ok' || !route || geometry.length < 2) return null;

    return {
      points: geometry.map(([lng, lat]) => [lat, lng] as [number, number]),
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration),
    };
  } catch {
    return null;
  }
}
