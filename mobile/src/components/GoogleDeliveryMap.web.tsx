import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { config } from '@/config';
import type { LatLng } from '@/lib/map-route';
import type { NativeMapMarker } from './native-delivery-map.types';

export function GoogleDeliveryMap({
  route,
  markers,
  style,
}: {
  route: LatLng[];
  markers: NativeMapMarker[];
  style?: StyleProp<ViewStyle>;
}) {
  const embedUrl = useMemo(() => {
    const key = config.mapApiKey.trim();
    if (!key) return null;

    const points = markers.length > 0 ? markers : route;
    if (points.length === 0) return null;

    if (markers.length >= 2) {
      const origin = markers[0];
      const dest = markers[markers.length - 1];
      return `https://www.google.com/maps/embed/v1/directions?key=${encodeURIComponent(key)}&origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}&mode=driving`;
    }

    const p = points[0];
    return `https://www.google.com/maps/embed/v1/view?key=${encodeURIComponent(key)}&center=${p.lat},${p.lng}&zoom=14`;
  }, [markers, route]);

  if (!embedUrl) return null;

  return (
    <View style={[styles.wrap, style]}>
      <iframe
        title="Google Maps delivery route"
        src={embedUrl}
        width="100%"
        height="100%"
        style={{ border: 0, display: 'block', width: '100%', height: '100%' }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <View style={styles.tint} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: '#E8EDF2', position: 'relative', minHeight: 120 },
  tint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(91,61,245,0.03)' },
});
