/** Pickup screen — merchant collection flow (design-matched). */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '@/api/client';
import type { PickupDetail } from '@/api/types';
import { ActiveDeliveryMap } from '@/components/ActiveDeliveryMap';
import type { TrackerMarker } from '@/components/DeliveryTrackerMap';
import { ErrorState } from '@/components/ErrorState';
import { useFeedback } from '@/components/FeedbackProvider';
import { Loading } from '@/components/Loading';
import { PartnerCard } from '@/components/partner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FlowScreenHeader } from '@/components/ui/FlowScreenHeader';
import { Text } from '@/components/ui/Text';
import { config } from '@/config';
import { useDirectionsRoute } from '@/hooks/useDirectionsRoute';
import { useTabBarHeight } from '@/hooks/useTabBarStyle';
import { colors, radius, spacing } from '@/theme';

export default function OrderPickup() {
  const tabBarHeight = useTabBarHeight();
  const router = useRouter();
  const feedback = useFeedback();
  const [detail, setDetail] = useState<PickupDetail | null>(null);
  const [deliveryId, setDeliveryId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const batch = await api.riderActive();
      if (!batch || batch.status !== 'assigned') {
        router.replace('/(rider)/active' as never);
        return;
      }
      const stop = batch.stops.find((s) => s.status !== 'delivered') ?? batch.stops[0];
      if (!stop) {
        router.replace('/(rider)/active' as never);
        return;
      }
      setDeliveryId(stop.delivery_id);
      const pickup = await api.pickupDetail(stop.delivery_id);
      setDetail(pickup);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load pickup');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(useCallback(() => {
    void load();
    const t = setInterval(() => { void load(); }, config.locationIntervalMs);
    return () => clearInterval(t);
  }, [load]));

  const messPoint = useMemo(
    () => (detail ? { lat: detail.merchant.lat, lng: detail.merchant.lng } : null),
    [detail],
  );
  const riderPoint = useMemo(() => {
    if (!detail?.rider_lat || !detail?.rider_lng) return null;
    return { lat: detail.rider_lat, lng: detail.rider_lng };
  }, [detail]);

  const routeOrigin = useMemo(() => {
    if (riderPoint) return riderPoint;
    if (!messPoint) return null;
    return { lat: messPoint.lat - 0.012, lng: messPoint.lng - 0.008 };
  }, [messPoint, riderPoint]);

  const { route } = useDirectionsRoute(routeOrigin, messPoint);

  const markers: TrackerMarker[] = useMemo(() => {
    if (!detail || !messPoint) return [];
    const list: TrackerMarker[] = [];
    if (riderPoint) {
      list.push({ lat: riderPoint.lat, lng: riderPoint.lng, label: 'You', kind: 'rider' });
    }
    list.push({ lat: messPoint.lat, lng: messPoint.lng, label: detail.merchant.name, kind: 'mess' });
    return list;
  }, [detail, messPoint, riderPoint]);

  const toggleItem = async (key: string) => {
    if (!detail || !deliveryId) return;
    const current = new Set(detail.checklist.filter((i) => i.verified).map((i) => i.key));
    if (current.has(key)) current.delete(key);
    else current.add(key);
    try {
      const res = await api.verifyPickupItems(deliveryId, Array.from(current));
      setDetail({
        ...detail,
        checklist: detail.checklist.map((item) => ({
          ...item,
          verified: res.verified_keys.includes(item.key),
        })),
        all_verified: detail.checklist.length > 0 && detail.checklist.every((i) => res.verified_keys.includes(i.key)),
      });
    } catch (err) {
      feedback.error(err instanceof ApiError ? err.message : 'Could not update checklist');
    }
  };

  const verifyAll = async () => {
    if (!detail || !deliveryId) return;
    const keys = detail.checklist.map((i) => i.key);
    try {
      await api.verifyPickupItems(deliveryId, keys);
      setDetail({
        ...detail,
        checklist: detail.checklist.map((i) => ({ ...i, verified: true })),
        all_verified: true,
      });
    } catch (err) {
      feedback.error(err instanceof ApiError ? err.message : 'Could not verify items');
    }
  };

  const handleArrived = async () => {
    if (!deliveryId) return;
    setBusy(true);
    try {
      await api.arrivedAtPickup(deliveryId);
      setDetail((d) => d ? {
        ...d,
        arrived_at_pickup: true,
        tracking: {
          ...d.tracking,
          track_status: 'arrived',
          track_status_label: 'ARRIVED',
          progress_pct: 100,
        },
      } : d);
      feedback.success('Arrival recorded at merchant.', 'Arrived at pickup');
    } catch (err) {
      feedback.error(err instanceof ApiError ? err.message : 'Could not mark arrival');
    } finally {
      setBusy(false);
    }
  };

  const confirmPickup = async () => {
    if (!deliveryId || !detail) return;
    setBusy(true);
    try {
      await api.pickup(deliveryId);
      feedback.success('Order collected. Continue to delivery.', 'Pickup confirmed');
      router.replace('/(rider)/active' as never);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Pickup failed';
      setError(msg);
      feedback.error(msg, 'Pickup failed');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmPress = () => {
    if (!detail) return;
    if (!detail.all_verified) {
      feedback.info('Please verify all items at the counter before confirming pickup.', 'Items not verified');
      return;
    }
    setConfirmOpen(true);
  };

  const openMaps = () => {
    if (!messPoint) return;
    void Linking.openURL(`https://maps.google.com/?q=${messPoint.lat},${messPoint.lng}`);
  };

  const callMerchant = () => {
    const phone = detail?.merchant.phone;
    if (!phone) {
      feedback.info('Merchant phone is not available.', 'Unavailable');
      return;
    }
    void Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
  };

  if (loading && !detail) return <Loading label="Loading pickup…" />;
  if (!detail) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ErrorState message={error ?? 'Pickup not found'} onRetry={load} variant="page" />
      </SafeAreaView>
    );
  }

  const tracking = detail.tracking;
  const merchant = detail.merchant;
  const onTrack = tracking.track_status === 'on_track';
  const arrived = detail.arrived_at_pickup;

  return (
    <View style={styles.screen}>
      <FlowScreenHeader title="Pickup" leftIcon="bag-handle" showLogo />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 220 + tabBarHeight }]} showsVerticalScrollIndicator={false}>
        {error ? <ErrorState message={error} variant="inline" onRetry={load} /> : null}

        <PartnerCard variant="low" style={styles.trackingCard}>
          <View style={styles.trackingRow}>
            <View style={styles.scooterIcon}>
              <Ionicons name="bicycle" size={20} color={colors.onPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="caption" style={styles.etaLabel}>PICKUP ETA</Text>
              <Text variant="label">
                {tracking.eta_minutes} mins{' '}
                <Text variant="bodySmall" style={{ color: colors.textMuted }}>
                  ({tracking.distance_km.toFixed(1)} km)
                </Text>
              </Text>
            </View>
            <View style={[styles.trackBadge, onTrack ? styles.trackOn : styles.trackOther]}>
              <View style={[styles.trackDot, { backgroundColor: onTrack ? colors.secondary : colors.warning }]} />
              <Text variant="caption" style={styles.trackText}>{tracking.track_status_label}</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${tracking.progress_pct}%` }]} />
          </View>
        </PartnerCard>

        <View style={styles.pillRow}>
          <View style={styles.orderPill}>
            <Ionicons name="document-text-outline" size={14} color={colors.primary} />
            <Text variant="caption" style={styles.orderPillText}>Order #{detail.ticket_ref}</Text>
          </View>
          <View style={styles.phasePill}>
            <View style={styles.phaseDot} />
            <Text variant="caption" style={styles.phaseText}>{detail.phase_label}</Text>
          </View>
        </View>

        <View style={styles.mapWrap}>
          <ActiveDeliveryMap
            markers={markers}
            route={route}
            etaLabel={`PICKUP ETA ${tracking.eta_minutes} mins`}
            routeLabel={tracking.route_label}
          />
          <View style={styles.routeBanner}>
            <Ionicons name="navigate" size={14} color={colors.secondary} />
            <Text variant="caption" style={styles.routeBannerText}>{tracking.route_label}</Text>
          </View>
          <Pressable style={styles.openMapBtn} onPress={openMaps}>
            <Text variant="caption" style={styles.openMapText}>Open Map</Text>
            <Ionicons name="open-outline" size={14} color={colors.primary} />
          </Pressable>
        </View>

        <PartnerCard variant="low" style={styles.merchantCard}>
          <View style={styles.merchantRow}>
            <View style={styles.merchantThumb}>
              {merchant.image_url ? (
                <Image source={{ uri: merchant.image_url }} style={styles.merchantImage} contentFit="cover" />
              ) : (
                <Ionicons name="storefront" size={28} color={colors.primary} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              {merchant.is_pure_veg ? (
                <View style={styles.vegRow}>
                  <View style={styles.vegDot} />
                  <Text variant="caption" style={styles.vegText}>PURE VEG</Text>
                </View>
              ) : null}
              <Text variant="label" numberOfLines={1}>{merchant.name}</Text>
              <Text variant="caption" style={styles.merchantAddr}>{merchant.address}</Text>
            </View>
            <Pressable style={styles.callBtn} onPress={callMerchant}>
              <Ionicons name="call" size={18} color={colors.onPrimary} />
            </Pressable>
          </View>
          <View style={styles.tagRow}>
            {merchant.counter_label ? (
              <View style={styles.statusTag}><Text variant="caption" style={styles.statusTagText}>{merchant.counter_label}</Text></View>
            ) : null}
            {merchant.packaging_verified ? (
              <View style={styles.statusTag}><Text variant="caption" style={styles.statusTagText}>Packaging Verified</Text></View>
            ) : null}
            {merchant.food_ready ? (
              <View style={styles.statusTag}><Text variant="caption" style={styles.statusTagText}>Food Ready</Text></View>
            ) : null}
          </View>
        </PartnerCard>

        {detail.merchant_pickup_note ? (
          <View style={styles.noteBox}>
            <View style={styles.noteIcon}>
              <Ionicons name="alert" size={16} color={colors.onPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label">Merchant Pickup Note</Text>
              <Text variant="bodySmall" style={styles.noteBody}>{detail.merchant_pickup_note}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.checklistHeader}>
          <View style={styles.checklistTitleRow}>
            <Text variant="label">Order Items Checklist</Text>
            <View style={styles.countBadge}>
              <Text variant="caption" style={styles.countText}>{detail.checklist.length} items</Text>
            </View>
          </View>
          <Pressable onPress={verifyAll}>
            <Text variant="caption" style={styles.verifyAll}>Verify All</Text>
          </Pressable>
        </View>
        <Text variant="caption" style={styles.checklistHint}>
          Tap items to tick off once inspected at merchant counter
        </Text>

        {detail.checklist.map((item) => (
          <Pressable key={item.key} style={styles.checkItem} onPress={() => toggleItem(item.key)}>
            <View style={[styles.checkbox, item.verified && styles.checkboxOn]}>
              {item.verified ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label">{item.name}</Text>
              <Text variant="caption" style={styles.packNote}>{item.packaging_note}</Text>
            </View>
            <Text variant="label" style={styles.qty}>{item.quantity}x</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ConfirmDialog
        visible={confirmOpen}
        title="Confirm Pickup"
        message={`Collect order ${detail.ticket_ref} from ${detail.merchant.name}? Make sure all items are packed and verified.`}
        confirmLabel="Yes, Collect Order"
        cancelLabel="Not Yet"
        icon="bag-check-outline"
        loading={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => { void confirmPickup().finally(() => setConfirmOpen(false)); }}
      />

      <View style={[styles.footer, { bottom: tabBarHeight }]}>
        <View style={styles.footerRow}>
          <Button title="Navigate" variant="secondary" onPress={openMaps} style={styles.footerHalf} />
          <Button title="Call Support" variant="secondary" onPress={() => router.push('/(rider)/help' as never)} style={styles.footerHalf} />
        </View>
        {!arrived ? (
          <Button title="Arrived at Pickup →" onPress={handleArrived} loading={busy} />
        ) : (
          <Button
            title="Confirm Pickup →"
            onPress={handleConfirmPress}
            loading={busy}
          />
        )}
        <View style={styles.gpsNote}>
          <Ionicons name="navigate-outline" size={12} color={colors.textMuted} />
          <Text variant="caption" style={styles.gpsText}>{detail.gps_validation_note}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm, gap: spacing.sm,
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  headerLogo: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center',
  },
  headerActions: { flexDirection: 'row', gap: spacing.xs },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: spacing.lg, gap: spacing.md },
  trackingCard: { padding: spacing.md, gap: spacing.md },
  trackingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  scooterIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  etaLabel: { color: colors.textMuted, fontWeight: '700', letterSpacing: 0.4 },
  trackBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill,
  },
  trackOn: { backgroundColor: '#E8F5E9' },
  trackOther: { backgroundColor: colors.surfaceContainerHigh },
  trackDot: { width: 6, height: 6, borderRadius: 3 },
  trackText: { fontWeight: '800', color: colors.secondary, fontSize: 10 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceContainerHigh, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  pillRow: { flexDirection: 'row', gap: spacing.sm },
  orderPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primaryFixed, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  orderPillText: { color: colors.primary, fontWeight: '700' },
  phasePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primaryFixed, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  phaseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  phaseText: { color: colors.primary, fontWeight: '700' },
  mapWrap: { height: 200, borderRadius: 16, overflow: 'hidden', backgroundColor: '#E8EDF2' },
  routeBanner: {
    position: 'absolute', left: spacing.sm, right: spacing.sm, bottom: spacing.sm,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.94)', paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: 12,
  },
  routeBannerText: { flex: 1, fontWeight: '700', color: colors.text },
  openMapBtn: {
    position: 'absolute', right: spacing.md, bottom: 52,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  openMapText: { color: colors.primary, fontWeight: '700' },
  merchantCard: { padding: spacing.md, gap: spacing.md },
  merchantRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  merchantImage: { width: 56, height: 56, borderRadius: 12 },
  merchantThumb: {
    width: 56, height: 56, borderRadius: 12,
    backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center',
  },
  vegRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  vegDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.secondary },
  vegText: { color: colors.secondary, fontWeight: '800', fontSize: 10 },
  merchantAddr: { color: colors.textMuted, marginTop: 2 },
  callBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statusTag: {
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 8,
  },
  statusTagText: { color: colors.textMuted, fontWeight: '600' },
  noteBox: {
    flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start',
    backgroundColor: '#FFF3E0', borderRadius: 12, padding: spacing.md,
    borderWidth: 1, borderColor: '#FFCC80',
  },
  noteIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#6D4C41', alignItems: 'center', justifyContent: 'center',
  },
  noteBody: { color: colors.text, marginTop: 4 },
  checklistHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checklistTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  countBadge: { backgroundColor: colors.surfaceContainerHigh, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  countText: { color: colors.textMuted, fontWeight: '700' },
  verifyAll: { color: colors.primary, fontWeight: '800' },
  checklistHint: { color: colors.textMuted, marginTop: -spacing.sm },
  checkItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surfaceContainerLow, borderRadius: 12, padding: spacing.md,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  packNote: { color: colors.textMuted, marginTop: 2 },
  qty: { color: colors.primary },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: spacing.lg, gap: spacing.sm,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight,
  },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  footerHalf: { flex: 1 },
  gpsNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  gpsText: { color: colors.textMuted, textAlign: 'center' },
});
