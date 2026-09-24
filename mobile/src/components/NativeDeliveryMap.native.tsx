import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { config } from '@/config';
import type { LatLng } from '@/lib/map-route';
import type { TrackerMarkerKind } from '@/components/DeliveryTrackerMap';
import type { NativeDeliveryMapProps, NativeMapMarker } from './native-delivery-map.types';

export type { NativeMapMarker } from './native-delivery-map.types';

const EDGE = { top: 72, right: 48, bottom: 72, left: 48 };

/** Branded pin styling per stop kind — kept in sync with DeliveryTrackerMap's MARKER_META. */
const MARKER_META: Record<TrackerMarkerKind, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  rider: { color: '#4212DE', icon: 'navigate' },
  mess: { color: '#F59E0B', icon: 'restaurant' },
  dropoff: { color: '#10B981', icon: 'home' },
};

function toCoord(p: LatLng) {
  return { latitude: p.lat, longitude: p.lng };
}

/**
 * Circular icon badge shown on the interactive map. `tracksViewChanges` starts
 * true so the Ionicons glyph is captured once the font paints, then flips off to
 * avoid the per-frame redraw cost react-native-maps warns about.
 */
function MarkerBadge({ marker }: { marker: NativeMapMarker }) {
  const [tracks, setTracks] = useState(true);
  const meta = marker.kind ? MARKER_META[marker.kind] : undefined;
  const color = meta?.color ?? marker.pinColor ?? '#5B3DF5';

  useEffect(() => {
    // Keep tracking briefly so the icon-font glyph is captured, then stop redrawing.
    const t = setTimeout(() => setTracks(false), 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <Marker
      coordinate={{ latitude: marker.lat, longitude: marker.lng }}
      title={marker.title}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracks}
    >
      <View style={[styles.badge, { backgroundColor: color }]}>
        {meta ? <Ionicons name={meta.icon} size={18} color="#FFFFFF" /> : <View style={styles.dot} />}
      </View>
    </Marker>
  );
}

export function NativeDeliveryMap({ route, markers, style, onMapReady }: NativeDeliveryMapProps) {
  const mapRef = useRef<MapView | null>(null);
  const useGoogleProvider =
    config.mapProvider === 'google' &&
    config.mapApiKey.trim().length > 0 &&
    Constants.appOwnership !== 'expo';
  const provider = useGoogleProvider ? PROVIDER_GOOGLE : undefined;

  const allCoords = useMemo(() => {
    const coords = [...route.map(toCoord), ...markers.map((m) => ({ latitude: m.lat, longitude: m.lng }))];
    return coords.filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude));
  }, [route, markers]);

  const initialRegion = useMemo((): Region | undefined => {
    if (!allCoords.length) return undefined;
    const lats = allCoords.map((c) => c.latitude);
    const lngs = allCoords.map((c) => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latDelta = Math.max((maxLat - minLat) * 1.6, 0.01);
    const lngDelta = Math.max((maxLng - minLng) * 1.6, 0.01);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [allCoords]);

  const fit = () => {
    if (!mapRef.current || allCoords.length < 1) return;
    if (allCoords.length === 1) {
      mapRef.current.animateToRegion({ ...allCoords[0], latitudeDelta: 0.02, longitudeDelta: 0.02 }, 300);
      return;
    }
    mapRef.current.fitToCoordinates(allCoords, { edgePadding: EDGE, animated: true });
  };

  useEffect(() => {
    const t = setTimeout(fit, 120);
    return () => clearTimeout(t);
  }, [allCoords]);

  useEffect(() => {
    onMapReady?.(fit);
  }, [onMapReady, allCoords]);

  return (
    <View style={[styles.wrap, style]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={provider}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={false}
      >
        {route.length > 1 && (
          <Polyline coordinates={route.map(toCoord)} strokeColor="#5B3DF5" strokeWidth={4} />
        )}
        {markers.map((m, i) => (
          <MarkerBadge key={`${m.kind ?? 'pin'}-${m.lat}-${m.lng}-${i}`} marker={m} />
        ))}
      </MapView>
      <View style={styles.tint} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: '#E8EDF2' },
  tint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(91,61,245,0.03)' },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF' },
});
