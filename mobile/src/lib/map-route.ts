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

export function pickOsmZoom(bounds: ReturnType<typeof boundsFor>): number {
  const span = Math.max(bounds.maxLat - bounds.minLat, bounds.maxLng - bounds.minLng);
  if (span > 0.8) return 8;
  if (span > 0.3) return 9;
  if (span > 0.08) return 11;
  if (span > 0.04) return 12;
  if (span > 0.02) return 13;
  return 14;
}

export function latLngToTile(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { x, y };
}

export function tileNorthWestLatLng(x: number, y: number, zoom: number): LatLng {
  const n = 2 ** zoom;
  const lng = (x / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return { lat, lng };
}

export function tileSouthEastLatLng(x: number, y: number, zoom: number): LatLng {
  const n = 2 ** zoom;
  const lng = ((x + 1) / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) / Math.PI;
  return { lat, lng };
}

export interface OsmTile {
  x: number;
  y: number;
  zoom: number;
  url: string;
}

export function osmTilesForBounds(bounds: ReturnType<typeof boundsFor>, zoom: number): OsmTile[] {
  const topLeft = latLngToTile(bounds.maxLat, bounds.minLng, zoom);
  const bottomRight = latLngToTile(bounds.minLat, bounds.maxLng, zoom);
  const tiles: OsmTile[] = [];
  for (let x = topLeft.x; x <= bottomRight.x; x++) {
    for (let y = topLeft.y; y <= bottomRight.y; y++) {
      tiles.push({
        x,
        y,
        zoom,
        url: `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
      });
    }
  }
  return tiles;
}

/** Interactive OSM embed for web (staticmap.openstreetmap.de is often unreachable). */
export function osmEmbedUrl(points: LatLng[]): string {
  const pts = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (!pts.length) return 'https://www.openstreetmap.org/export/embed.html?layer=mapnik';

  const b = boundsFor(pts);
  const bbox = `${b.minLng},${b.minLat},${b.maxLng},${b.maxLat}`;
  const markers = pts
    .slice(0, 5)
    .map((p) => `marker=${encodeURIComponent(`${p.lat},${p.lng}`)}`)
    .join('&');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&${markers}`;
}

export function staticOsmMapUrl(points: LatLng[], _width = 720, _height = 520): string {
  const b = boundsFor(points);
  const centerLat = (b.minLat + b.maxLat) / 2;
  const centerLng = (b.minLng + b.maxLng) / 2;
  const span = Math.max(b.maxLat - b.minLat, b.maxLng - b.minLng);
  const zoom = span > 0.8 ? 8 : span > 0.3 ? 9 : span > 0.08 ? 11 : span > 0.04 ? 12 : span > 0.02 ? 13 : 14;
  const latRad = (centerLat * Math.PI) / 180;
  const n = 2 ** zoom;
  const x = Math.floor(((centerLng + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
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
