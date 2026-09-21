/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_MAP_TILE_URL?: string;
  readonly VITE_MAP_CENTER?: string;
  readonly VITE_MAP_ZOOM?: string;
  readonly VITE_GOOGLE_MAPS_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
