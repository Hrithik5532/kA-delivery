import { useState } from 'react';
import { hasGoogleMaps } from '@/config';
import { GoogleMapView } from './GoogleMapView';
import { LeafletMapView } from './LeafletMapView';

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
 * Google Maps when a key is configured; OpenStreetMap (Leaflet) when there is
 * no key or Google fails to load (bad key, API not enabled, blocked referrer),
 * so ops always have a working map.
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
  const [googleFailed, setGoogleFailed] = useState(false);
  const props = { markers, center, zoom, height, onPick, route, fitPoints, fitKey };

  if (!hasGoogleMaps || googleFailed) {
    return <LeafletMapView {...props} />;
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
      onFailed={() => setGoogleFailed(true)}
    />
  );
}
