/** Runtime config from VITE_* env (inlined at build time). No secrets here. */
const center = (import.meta.env.VITE_MAP_CENTER ?? '18.5204,73.8567')
  .split(',')
  .map(Number);

const googleMapsKey = (import.meta.env.VITE_GOOGLE_MAPS_KEY ?? '').trim();

export const config = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  mapTileUrl:
    import.meta.env.VITE_MAP_TILE_URL ||
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  mapAttribution: '&copy; OpenStreetMap contributors',
  mapCenter: [Number.isFinite(center[0]) ? center[0] : 18.5204, Number.isFinite(center[1]) ? center[1] : 73.8567] as [number, number],
  mapZoom: Number(import.meta.env.VITE_MAP_ZOOM ?? 12),
  googleMapsKey,
};

export const hasGoogleMaps = googleMapsKey.length > 0;
