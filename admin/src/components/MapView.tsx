import { hasGoogleMaps } from '@/config';
import { GoogleMapView } from './GoogleMapView';

export interface MapMarker {
  id?: string;
  lat: number;
  lng: number;
  label?: string;
  kind?: 'pickup' | 'dropoff' | 'rider' | 'idle' | 'pin';
  stale?: boolean;
  selected?: boolean;
}

/**
 * Google-only map surface. There is intentionally no OpenStreetMap/Leaflet
 * fallback — when Google can't load, GoogleMapView renders an explicit error
 * state so the map provider is unambiguous everywhere in the admin.
 */
export function MapView({
  markers,
  center,
  zoom,
  height = 420,
  onPick,
  route,
  fitPoints,
  fitKey,
}: {
  markers: MapMarker[];
  center?: [number, number];
  zoom?: number;
  height?: number;
  onPick?: (lat: number, lng: number) => void;
  route?: [number, number][];
  fitPoints?: [number, number][];
  fitKey?: string | null;
}) {
  if (!hasGoogleMaps) {
    return (
      <div className="dm-map dm-map-fallback" style={{ height }}>
        <p>Google Maps is not configured.</p>
        <p className="dm-map-error-detail">
          Set <code>VITE_GOOGLE_MAPS_KEY</code> and enable the Maps JavaScript API for this site.
        </p>
      </div>
    );
  }

  return (
    <GoogleMapView
      markers={markers}
      center={center}
      zoom={zoom}
      height={height}
      onPick={onPick}
      route={route}
      fitPoints={fitPoints}
      fitKey={fitKey}
    />
  );
}
