import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { config } from '@/config';
import type { LatLng } from '@/lib/map-route';
import type { NativeDeliveryMapProps, NativeMapMarker } from './native-delivery-map.types';

export type { NativeMapMarker } from './native-delivery-map.types';

const EDGE = { top: 72, right: 48, bottom: 72, left: 48 };

function toCoord(p: LatLng) {
  return { latitude: p.lat, longitude: p.lng };
}

export function NativeDeliveryMap({ route, markers, style, onMapReady }: NativeDeliveryMapProps) {
  const mapRef = useRef<MapView | null>(null);
  const provider = config.mapProvider === 'google' ? PROVIDER_GOOGLE : undefined;

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
          <Marker
            key={`${m.lat}-${m.lng}-${i}`}
            coordinate={{ latitude: m.lat, longitude: m.lng }}
            title={m.title}
            pinColor={m.pinColor ?? '#5B3DF5'}
          />
        ))}
      </MapView>
      <View style={styles.tint} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: '#E8EDF2' },
  tint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(91,61,245,0.03)' },
});
