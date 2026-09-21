export interface LatLng {
  lat: number;
  lng: number;
}

export function interpolateRoute(a: LatLng, b: LatLng, steps: number): LatLng[] {
  if (steps <= 0) return [];
  const out: LatLng[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / (steps + 1);
    out.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
  }
  return out;
}

export function boundsFor(points: LatLng[]) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latPad = Math.max((maxLat - minLat) * 0.25, 0.004);
  const lngPad = Math.max((maxLng - minLng) * 0.25, 0.004);
  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLng: minLng - lngPad,
    maxLng: maxLng + lngPad,
  };
}

/** Rider active delivery: kitchen → customer route. */
export function buildRiderRoute(mess: LatLng, dropoff: LatLng, phase: 'pickup' | 'delivering'): LatLng[] {
  if (phase === 'pickup') {
    return [mess, ...interpolateRoute(mess, dropoff, 5), dropoff];
  }
  const enRoute = {
    lat: mess.lat + (dropoff.lat - mess.lat) * 0.35,
    lng: mess.lng + (dropoff.lng - mess.lng) * 0.35,
  };
  return [enRoute, ...interpolateRoute(enRoute, dropoff, 5), dropoff];
}

export function staticOsmMapUrl(points: LatLng[], width = 720, height = 520): string {
  const b = boundsFor(points);
  const centerLat = (b.minLat + b.maxLat) / 2;
  const centerLng = (b.minLng + b.maxLng) / 2;
  const span = Math.max(b.maxLat - b.minLat, b.maxLng - b.minLng);
  const zoom = span > 0.8 ? 8 : span > 0.3 ? 9 : span > 0.08 ? 11 : span > 0.04 ? 12 : span > 0.02 ? 13 : 14;
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${centerLat},${centerLng}&zoom=${zoom}&size=${width}x${height}&maptype=mapnik`;
}

function uniquePoints(points: LatLng[]) {
  const seen = new Set<string>();
  return points.filter((p) => {
    const k = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return Number.isFinite(p.lat) && Number.isFinite(p.lng);
  });
}

export function staticGoogleMapUrl(points: LatLng[], width = 720, height = 520, apiKey = '', route: LatLng[] = []): string | null {
  if (!apiKey.trim() || points.length === 0) return null;

  const pts = uniquePoints(points);
  const pathPts = uniquePoints(route.length > 1 ? route : pts);
  const visible = pts.map((p) => `${p.lat},${p.lng}`).join('|');
  const path = pathPts.map((p) => `${p.lat},${p.lng}`).join('|');

  const markerParams = pts
    .slice(0, 8)
    .map((p, i) => {
      const label = i === 0 ? 'A' : i === pts.length - 1 ? 'B' : String(i + 1);
      const color = i === 0 ? '0xF59E0B' : i === pts.length - 1 ? '0x19C6A5' : '0x5B3DF5';
      return `markers=color:${color}|label:${label}|${p.lat},${p.lng}`;
    })
    .join('&');

  const base = `https://maps.googleapis.com/maps/api/staticmap?size=${width}x${height}&scale=2&maptype=roadmap&visible=${encodeURIComponent(visible)}`;
  const pathParam = path ? `&path=color:0x5B3DF5ff|weight:4|${encodeURIComponent(path)}` : '';
  return `${base}${pathParam}&${markerParams}&key=${encodeURIComponent(apiKey.trim())}`;
}

/** Prefer Google Static Maps when a key is configured, otherwise OpenStreetMap. */
export function staticMapUrl(points: LatLng[], width = 720, height = 520, apiKey = '', route: LatLng[] = []): string {
  return staticGoogleMapUrl(points, width, height, apiKey, route) ?? staticOsmMapUrl(points, width, height);
}
