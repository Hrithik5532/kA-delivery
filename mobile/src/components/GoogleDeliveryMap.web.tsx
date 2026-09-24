import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui/Text';
import { config } from '@/config';
import { useGoogleMapsScript } from '@/hooks/useGoogleMapsScript.web';
import { osmEmbedUrl, type LatLng } from '@/lib/map-route';
import type { NativeMapMarker } from './native-delivery-map.types';

declare const google: {
  maps: {
    Map: new (el: HTMLElement, opts?: Record<string, unknown>) => {
      fitBounds: (bounds: unknown, padding?: number) => void;
    };
    LatLngBounds: new () => { extend: (point: { lat: number; lng: number }) => void };
    Polyline: new (opts?: Record<string, unknown>) => {
      setMap: (map: unknown | null) => void;
      setPath: (path: Array<{ lat: number; lng: number }>) => void;
    };
    Marker: new (opts?: Record<string, unknown>) => { setMap: (map: unknown | null) => void };
    SymbolPath: { CIRCLE: unknown };
  };
};

type MapSource = 'google' | 'osm';

function OsmMapFrame({ url }: { url: string }) {
  return createElement('iframe', {
    title: 'Delivery map',
    src: url,
    style: {
      border: 0,
      width: '100%',
      height: '100%',
      display: 'block',
    },
    loading: 'lazy',
    referrerPolicy: 'no-referrer-when-downgrade',
  });
}

function markerIcon(color: string, scale = 9) {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 3,
    scale,
  };
}

const MARKER_SCALE: Record<string, number> = {
  rider: 10,
  mess: 12,
  dropoff: 12,
};

const MARKER_LABEL: Record<string, string> = {
  rider: 'Y',
  mess: 'P',
  dropoff: 'D',
};

function InteractiveGoogleMap({
  route,
  markers,
  apiKey,
  onFailed,
  onMapReady,
}: {
  route: LatLng[];
  markers: NativeMapMarker[];
  apiKey: string;
  onFailed?: () => void;
  onMapReady?: (fit: () => void) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<InstanceType<typeof google.maps.Map> | null>(null);
  const polylineRef = useRef<InstanceType<typeof google.maps.Polyline> | null>(null);
  const markerRefs = useRef<Array<InstanceType<typeof google.maps.Marker>>>([]);
  const { ready, error } = useGoogleMapsScript(apiKey);

  const points = useMemo(() => {
    const pts = [...route, ...markers.map((m) => ({ lat: m.lat, lng: m.lng }))];
    return pts.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  }, [route, markers]);

  const fitMap = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const markerPoints = markers
      .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
      .map((m) => ({ lat: m.lat, lng: m.lng }));

    const boundsPoints = markerPoints.length > 0 ? markerPoints : points;
    if (boundsPoints.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    boundsPoints.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 64);
  }, [markers, points]);

  useEffect(() => {
    if (error) onFailed?.();
  }, [error, onFailed]);

  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;

    const map = new google.maps.Map(containerRef.current, {
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
      gestureHandling: 'greedy',
    });
    mapRef.current = map;
    polylineRef.current = new google.maps.Polyline({
      strokeColor: '#5B3DF5',
      strokeOpacity: 0.85,
      strokeWeight: 4,
      map,
    });
    onMapReady?.(fitMap);
    fitMap();
  }, [ready, fitMap, onMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const polyline = polylineRef.current;
    if (!ready || !map || !polyline) return;

    const path = route.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    polyline.setPath(path.length > 1 ? path : []);

    markerRefs.current.forEach((m) => m.setMap(null));
    markerRefs.current = markers.map((m) =>
      new google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        title: m.title,
        map,
        icon: markerIcon(m.pinColor ?? '#5B3DF5', MARKER_SCALE[m.kind ?? ''] ?? 10),
        label: {
          text: MARKER_LABEL[m.kind ?? ''] ?? '•',
          color: '#ffffff',
          fontSize: '11px',
          fontWeight: '700',
        },
        zIndex: m.kind === 'rider' ? 3 : m.kind === 'dropoff' ? 2 : 1,
      }),
    );

    fitMap();
  }, [ready, route, markers, fitMap]);

  if (error) return null;

  if (!ready) {
    return (
      <View style={styles.loading}>
        <Text variant="caption" style={styles.loadingText}>Loading map…</Text>
      </View>
    );
  }

  return createElement('div', {
    ref: containerRef,
    style: { width: '100%', height: '100%' },
  });
}

export function GoogleDeliveryMap({
  route,
  markers,
  style,
  onMapReady,
}: {
  route: LatLng[];
  markers: NativeMapMarker[];
  style?: StyleProp<ViewStyle>;
  onMapReady?: (fit: () => void) => void;
}) {
  const [source, setSource] = useState<MapSource>(config.mapApiKey.trim() ? 'google' : 'osm');

  const points = useMemo(() => {
    const pts = [...route, ...markers.map((m) => ({ lat: m.lat, lng: m.lng }))];
    return pts.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  }, [route, markers]);

  const embedUrl = useMemo(() => osmEmbedUrl(points), [points]);
  const usingOsm = source === 'osm' || !config.mapApiKey.trim();

  if (!points.length) return null;

  return (
    <View style={[styles.wrap, style]}>
      {usingOsm ? (
        <OsmMapFrame url={embedUrl} />
      ) : (
        <InteractiveGoogleMap
          route={route}
          markers={markers}
          apiKey={config.mapApiKey}
          onFailed={() => setSource('osm')}
          onMapReady={onMapReady}
        />
      )}
      {usingOsm && (
        <View style={styles.banner} pointerEvents="none">
          <Text variant="caption" style={styles.bannerText}>
            OpenStreetMap fallback — enable Maps JavaScript API for localhost on your Google key
          </Text>
        </View>
      )}
      <View style={styles.tint} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: '#E8EDF2', position: 'relative', minHeight: 120 },
  tint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(91,61,245,0.03)' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#6B7280' },
  banner: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 2,
  },
  bannerText: { color: '#6B7280', textAlign: 'center', fontSize: 11 },
});
