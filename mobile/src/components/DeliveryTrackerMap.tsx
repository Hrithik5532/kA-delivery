import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { DeliveryMapLayer } from '@/components/DeliveryMapLayer';
import { MapPlaceholder } from '@/components/MapPlaceholder';
import { useInteractiveMap } from '@/config';
import type { LatLng } from '@/lib/map-route';
import { colors, radius, shadow, spacing } from '@/theme';
import { Text } from './ui/Text';

export type TrackerMarkerKind = 'mess' | 'rider' | 'dropoff';

export interface TrackerMarker {
  lat: number;
  lng: number;
  label: string;
  kind: TrackerMarkerKind;
}

const PIN_COLORS: Record<TrackerMarkerKind, string> = {
  rider: '#4212DE',
  mess: '#F59E0B',
  dropoff: '#10B981',
};

export const TRACKER_LEGEND: Array<{ kind: TrackerMarkerKind; label: string }> = [
  { kind: 'rider', label: 'You' },
  { kind: 'mess', label: 'Pickup' },
  { kind: 'dropoff', label: 'Drop-off' },
];

export function DeliveryTrackerMap({
  markers,
  route,
  height,
  style,
  badgeLabel = 'LIVE TRACKING',
  showLegend = false,
}: {
  markers: TrackerMarker[];
  route: LatLng[];
  height: number;
  style?: object;
  badgeLabel?: string;
  showLegend?: boolean;
}) {
  const useInteractiveMapLayer = useInteractiveMap;

  const nativeMarkers = useMemo(
    () => markers.map((m) => ({
      lat: m.lat,
      lng: m.lng,
      title: m.label,
      pinColor: PIN_COLORS[m.kind],
      kind: m.kind,
    })),
    [markers],
  );

  return (
    <View style={[styles.wrap, { height }, style]}>
      {useInteractiveMapLayer ? (
        <DeliveryMapLayer route={route} markers={nativeMarkers} style={{ height }} />
      ) : (
        <MapPlaceholder caption="Map available in the installed app" />
      )}

      <View style={styles.badge} pointerEvents="none">
        <Text variant="caption" style={styles.badgeText}>{badgeLabel}</Text>
      </View>

      {showLegend ? (
        <View style={styles.legend} pointerEvents="none">
          {TRACKER_LEGEND.map(({ kind, label }) => (
            <View key={kind} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: PIN_COLORS[kind] }]} />
              <Text variant="caption" style={styles.legendText}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', backgroundColor: '#E8EDF2', overflow: 'hidden' },
  badge: { position: 'absolute', top: spacing.md, left: spacing.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, ...shadow },
  badgeText: { color: colors.primary, fontWeight: '800', letterSpacing: 0.6 },
  legend: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    ...shadow,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontWeight: '700', color: colors.text, fontSize: 11 },
});
