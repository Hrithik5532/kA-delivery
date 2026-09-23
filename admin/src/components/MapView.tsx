import L from 'leaflet';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { useEffect, useState } from 'react';
import { config, hasGoogleMaps } from '@/config';

function shouldSkipGoogleMaps() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

import { GoogleMapView } from './GoogleMapView';

export interface MapMarker {
  id?: string;
  lat: number;
  lng: number;
  label?: string;
  kind?: 'pickup' | 'dropoff' | 'rider' | 'pin';
  stale?: boolean;
  selected?: boolean;
}

const COLORS: Record<string, string> = {
  pickup: '#5B3DF5',
  dropoff: '#19C6A5',
  rider: '#5B3DF5',
  pin: '#EF4444',
};

function icon(kind: string, stale?: boolean, selected?: boolean) {
  const color = stale ? '#9CA3AF' : COLORS[kind] ?? '#5B3DF5';
  const size = selected ? 22 : 18;
  const border = selected ? 4 : 3;
  return L.divIcon({
    className: 'dm-marker',
    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:${border}px solid #fff;box-shadow:0 2px 8px rgba(91,61,245,0.45)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FitBounds({ points, fitKey, center }: { points?: [number, number][]; fitKey?: string | null; center?: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (points && points.length > 1 && fitKey) {
      map.fitBounds(points, { padding: [48, 48] });
      return;
    }
    if (center) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [fitKey, points, center, map]);
  return null;
}

function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function LeafletMapView({
  markers,
  center,
  zoom,
  height = 420,
  onPick,
  route,
  fitPoints,
  fitKey,
  banner,
}: {
  markers: MapMarker[];
  center?: [number, number];
  zoom?: number;
  height?: number;
  onPick?: (lat: number, lng: number) => void;
  route?: [number, number][];
  fitPoints?: [number, number][];
  fitKey?: string | null;
  banner?: string | null;
}) {
  const c = center ?? config.mapCenter;
  return (
    <div>
      {banner && <div className="dm-map-banner">{banner}</div>}
      <MapContainer center={c} zoom={zoom ?? config.mapZoom} style={{ height, width: '100%' }} className="dm-map">
        <TileLayer url={config.mapTileUrl} attribution={config.mapAttribution} />
        {onPick && <ClickCapture onPick={onPick} />}
        <FitBounds points={fitPoints} fitKey={fitKey} center={center} />
        {route && route.length > 1 && (
          <Polyline positions={route} pathOptions={{ color: '#5B3DF5', weight: 4, dashArray: '8 6', opacity: 0.85 }} />
        )}
        {markers.map((m, i) => (
          <Marker key={m.id ?? `${m.lat}-${m.lng}-${i}`} position={[m.lat, m.lng]} icon={icon(m.kind ?? 'pin', m.stale, m.selected)}>
            {m.label && <Popup>{m.label}</Popup>}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

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
  const [googleFailed, setGoogleFailed] = useState(shouldSkipGoogleMaps());

  if (hasGoogleMaps && !googleFailed) {
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

  const banner = googleFailed
    ? 'Google Maps is unavailable on this host (add your admin URL to the API key HTTP referrers, or use OpenStreetMap).'
    : null;

  return (
    <LeafletMapView
      markers={markers}
      center={center}
      zoom={zoom}
      height={height}
      onPick={onPick}
      route={route}
      fitPoints={fitPoints}
      fitKey={fitKey}
      banner={banner}
    />
  );
}
