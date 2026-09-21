import { GoogleMap, Marker, Polyline } from '@react-google-maps/api';
import { useEffect, useMemo, useRef } from 'react';
import { config } from '@/config';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';
import type { MapMarker } from './MapView';

const COLORS: Record<string, string> = {
  pickup: '#5B3DF5',
  dropoff: '#19C6A5',
  rider: '#5B3DF5',
  pin: '#EF4444',
};

export function GoogleMapView({
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
  const mapRef = useRef<google.maps.Map | null>(null);
  const { isLoaded, loadError } = useGoogleMaps();

  const mapCenter = useMemo(
    () => ({ lat: center?.[0] ?? config.mapCenter[0], lng: center?.[1] ?? config.mapCenter[1] }),
    [center],
  );

  const polylinePath = useMemo(
    () => (route ?? []).map(([lat, lng]) => ({ lat, lng })),
    [route],
  );

  const fitMap = (map: google.maps.Map) => {
    if (fitPoints && fitPoints.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      fitPoints.forEach(([lat, lng]) => bounds.extend({ lat, lng }));
      map.fitBounds(bounds, 48);
      return;
    }
    if (center) {
      map.panTo({ lat: center[0], lng: center[1] });
    }
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    fitMap(map);
  }, [fitKey, fitPoints, center]);

  if (loadError) {
    return (
      <div className="dm-map dm-map-fallback" style={{ height }}>
        <p>Google Maps failed to load. Check VITE_GOOGLE_MAPS_KEY and referrer restrictions.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return <div className="dm-map dm-map-loading" style={{ height }}>Loading map…</div>;
  }

  const markerIcon = (kind: string, stale?: boolean, selected?: boolean) => {
    const color = stale ? '#9CA3AF' : COLORS[kind] ?? '#5B3DF5';
    const size = selected ? 22 : 18;
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: selected ? 4 : 3,
      scale: size / 2,
    };
  };

  return (
    <GoogleMap
      mapContainerClassName="dm-map"
      mapContainerStyle={{ height, width: '100%' }}
      center={mapCenter}
      zoom={zoom ?? config.mapZoom}
      onLoad={(map) => {
        mapRef.current = map;
        fitMap(map);
      }}
      onClick={(e) => {
        if (!onPick || !e.latLng) return;
        onPick(e.latLng.lat(), e.latLng.lng());
      }}
      options={{
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
      }}
    >
      {polylinePath.length > 1 && (
        <Polyline
          path={polylinePath}
          options={{ strokeColor: '#5B3DF5', strokeOpacity: 0.85, strokeWeight: 4 }}
        />
      )}
      {markers.map((m, i) => (
        <Marker
          key={m.id ?? `${m.lat}-${m.lng}-${i}`}
          position={{ lat: m.lat, lng: m.lng }}
          title={m.label}
          icon={markerIcon(m.kind ?? 'pin', m.stale, m.selected)}
        />
      ))}
    </GoogleMap>
  );
}
