import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { TrackerMarker } from '@/components/DeliveryTrackerMap';
import { DeliveryMapLayer } from '@/components/DeliveryMapLayer';
import { MapPlaceholder } from '@/components/MapPlaceholder';
import { useInteractiveMap } from '@/config';
import type { LatLng } from '@/lib/map-route';
import { colors, radius, shadow, spacing } from '@/theme';
import { Text } from './ui/Text';

const PIN_COLORS: Record<TrackerMarker['kind'], string> = {
  mess: '#F59E0B',
  rider: colors.primary,
  dropoff: '#E53935',
};

export function ActiveDeliveryMap({
  markers,
  route,
  etaLabel,
  routeLabel,
  onRecenter,
}: {
  markers: TrackerMarker[];
  route: LatLng[];
  etaLabel: string;
  routeLabel: string;
  onRecenter?: () => void;
}) {
  const fitRef = useRef<(() => void) | null>(null);
  const useGoogleMap = useInteractiveMap;

  const nativeMarkers = useMemo(
    () => markers.map((m) => ({ lat: m.lat, lng: m.lng, title: m.label, pinColor: PIN_COLORS[m.kind] })),
    [markers],
  );

  const handleMapReady = useCallback((fit: () => void) => {
    fitRef.current = fit;
  }, []);

  const recenter = () => {
    fitRef.current?.();
    onRecenter?.();
  };

  return (
    <View style={styles.wrap}>
      {useGoogleMap ? (
        <>
          <DeliveryMapLayer route={route} markers={nativeMarkers} style={StyleSheet.absoluteFill} onMapReady={handleMapReady} />

          <View style={styles.etaPill} pointerEvents="none">
            <View style={styles.liveDot} />
            <Text variant="caption" style={styles.etaText}>{etaLabel}</Text>
          </View>
          <View style={styles.routePill} pointerEvents="none">
            <Ionicons name="git-network-outline" size={14} color={colors.primary} />
            <Text variant="caption" style={styles.routeText}>{routeLabel}</Text>
          </View>
          <View style={styles.mapControls}>
            <Pressable style={styles.mapBtn} onPress={recenter}>
              <Ionicons name="locate" size={18} color={colors.text} />
            </Pressable>
          </View>
        </>
      ) : (
        <MapPlaceholder caption={etaLabel} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#E8EDF2', overflow: 'hidden' },
  etaPill: {
    position: 'absolute', top: spacing.md, left: spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, ...shadow,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.secondary },
  etaText: { fontWeight: '700', color: colors.text },
  routePill: {
    position: 'absolute', top: spacing.md, right: spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, ...shadow,
  },
  routeText: { fontWeight: '800', color: colors.primary, fontSize: 11 },
  mapControls: { position: 'absolute', right: spacing.md, bottom: spacing.xl, gap: spacing.sm },
  mapBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow },
});
