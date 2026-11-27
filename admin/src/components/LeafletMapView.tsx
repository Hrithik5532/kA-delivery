/** OpenStreetMap (Leaflet) map: used when Google Maps has no key or fails. */
import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { config } from '@/config';
import type { MapMarker } from './MapView';

const COLORS: Record<string, string> = {
  pickup: '#5B3DF5',
  dropoff: '#19C6A5',
  rider: '#5B3DF5',
  idle: '#6B7280',
  pin: '#EF4444',
};

function Fit({ fitPoints, center, fitKey }: { fitPoints?: [number, number][]; center?: [number, number]; fitKey?: string | null }) {
  const map = useMap();
  useEffect(() => {
    if (fitPoints && fitPoints.length > 1) {
      map.fitBounds(L.latLngBounds(fitPoints), { padding: [48, 48] });
    } else {
      const single = fitPoints?.[0] ?? center;
      if (single) map.setView(single, 15);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, JSON.stringify(fitPoints), center?.[0], center?.[1]]);
  return null;
}

function Picker({ onPick }: { onPick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick?.(e.latlng.lat, e.latlng.lng) });
  return null;
}

export function LeafletMapView({
  markers, center, zoom, height = 420, onPick, route, fitPoints, fitKey,
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
  const start = useMemo(() => center ?? config.mapCenter, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <MapContainer className="dm-map" center={start} zoom={zoom ?? config.mapZoom} style={{ height, width: '100%' }} scrollWheelZoom>
      <TileLayer url={config.mapTileUrl} attribution={config.mapAttribution} />
      <Fit fitPoints={fitPoints} center={center} fitKey={fitKey} />
      <Picker onPick={onPick} />
      {route && route.length > 1 && <Polyline positions={route} pathOptions={{ color: '#5B3DF5', weight: 4, opacity: 0.85 }} />}
      {markers.map((m, i) => (
        <CircleMarker
          key={m.id ?? `${m.lat}-${m.lng}-${i}`}
          center={[m.lat, m.lng]}
          radius={m.selected ? 11 : 9}
          pathOptions={{ color: '#ffffff', weight: m.selected ? 4 : 3, fillColor: m.stale ? '#9CA3AF' : COLORS[m.kind ?? 'pin'] ?? '#5B3DF5', fillOpacity: 1 }}
        >
          {m.label && <Tooltip>{m.label}</Tooltip>}
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
