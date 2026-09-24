import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '@/api/client';
import type { OfferDetail } from '@/api/types';
import { DeliveryTrackerMap, type TrackerMarker } from '@/components/DeliveryTrackerMap';
import { ErrorState } from '@/components/ErrorState';
import { useFeedback } from '@/components/FeedbackProvider';
import { Loading } from '@/components/Loading';
import { PartnerCard } from '@/components/partner';
import { FlowScreenHeader } from '@/components/ui/FlowScreenHeader';
import { Text } from '@/components/ui/Text';
import { useDirectionsRoute } from '@/hooks/useDirectionsRoute';
import { useRiderPosition } from '@/hooks/useRiderPosition';
import { mergeRouteLegs } from '@/lib/map-route';
import { useTabBarHeight } from '@/hooks/useTabBarStyle';
import { colors, estimateDeliveryMins, money, spacing } from '@/theme';

export default function DeliveryRequest() {
  const { offerId } = useLocalSearchParams<{ offerId: string }>();
  const router = useRouter();
  const tabBarHeight = useTabBarHeight();
  const [offer, setOffer] = useState<OfferDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const feedback = useFeedback();

  useEffect(() => {
    void api.offerDetail(Number(offerId)).then(setOffer).catch(() => setOffer(null));
  }, [offerId]);

  const firstStop = offer?.stops?.[0];
  const messPoint = offer?.mess_lat != null && offer?.mess_lng != null
    ? { lat: offer.mess_lat, lng: offer.mess_lng }
    : null;
  const dropPoint = useMemo(() => {
    if (firstStop?.address_lat != null && firstStop?.address_lng != null) {
      return { lat: firstStop.address_lat, lng: firstStop.address_lng };
    }
    return null;
  }, [firstStop?.address_lat, firstStop?.address_lng]);
  const riderPoint = useRiderPosition();

  const { route: toPickupRoute, distanceKm: directionsPickupKm } = useDirectionsRoute(
    riderPoint,
    messPoint,
    !!riderPoint && !!messPoint,
  );
  const { route: deliveryRoute, distanceKm: deliveryLegKm } = useDirectionsRoute(messPoint, dropPoint);
  const route = useMemo(
    () => mergeRouteLegs(toPickupRoute, deliveryRoute),
    [toPickupRoute, deliveryRoute],
  );

  const pickupKm = directionsPickupKm ?? offer?.pickup_distance_km ?? null;
  const dropKm = deliveryLegKm ?? offer?.drop_distance_km ?? null;
  const totalKm = offer?.total_distance_km
    ?? (pickupKm != null && dropKm != null ? pickupKm + dropKm : pickupKm != null ? pickupKm * 1.2 : null);
  const eta = estimateDeliveryMins(totalKm);

  const mapBadge = useMemo(() => {
    if (pickupKm != null && dropKm != null) {
      return `${pickupKm.toFixed(1)} km pickup · ${dropKm.toFixed(1)} km drop`;
    }
    if (pickupKm != null) return `${pickupKm.toFixed(1)} km to pickup`;
    return 'ROUTE PREVIEW';
  }, [pickupKm, dropKm]);

  const markers: TrackerMarker[] = useMemo(() => {
    const list: TrackerMarker[] = [];
    if (riderPoint) {
      list.push({ lat: riderPoint.lat, lng: riderPoint.lng, label: 'You', kind: 'rider' });
    }
    if (messPoint && offer?.mess_name) {
      list.push({ lat: messPoint.lat, lng: messPoint.lng, label: offer.mess_name, kind: 'mess' });
    }
    if (dropPoint) {
      const dropLabel = firstStop?.address_title || firstStop?.address_text?.split(',')[0] || 'Drop-off';
      list.push({ lat: dropPoint.lat, lng: dropPoint.lng, label: dropLabel, kind: 'dropoff' });
    }
    return list;
  }, [riderPoint, messPoint, dropPoint, offer, firstStop]);

  const summary = offer?.order_summary;
  const items = firstStop?.items ?? [];
  const reducedItems = items.reduce((n, i) => n + i.quantity, 0);
  const itemCount = summary?.item_count ?? reducedItems ?? offer?.order_count ?? 0;
  const isPrepaid = summary?.is_prepaid ?? firstStop?.payment_method?.toLowerCase() !== 'cod';
  if (!offer) return <Loading label="Loading offer…" />;

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.acceptOffer(offer.id);
      feedback.success('Offer accepted. Head to pickup.', 'Delivery assigned');
      router.replace('/(rider)/pickup' as never);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not accept offer');
      setBusy(false);
    }
  };

  const reject = async () => {
    setBusy(true);
    try {
      await api.rejectOffer(offer.id);
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reject offer');
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <FlowScreenHeader title="Delivery Offer" showLogo />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 160 }]} showsVerticalScrollIndicator={false}>
        {error ? <ErrorState message={error} variant="inline" /> : null}

        <View style={styles.topPills}>
          <View style={styles.dispatchPill}>
            <Ionicons name="flash" size={16} color={colors.primary} />
            <Text variant="caption" style={styles.dispatchText}>New Instant Dispatch</Text>
          </View>
          <View style={styles.timerPill}>
            <Ionicons name="hourglass-outline" size={16} color={colors.tertiary} />
            <Text variant="caption" style={styles.timerText}>Awaiting you</Text>
          </View>
        </View>

        <View style={styles.payoutHero}>
          <View style={styles.payoutGlow} />
          <Text variant="caption" style={styles.payoutLabel}>GUARANTEED PAYOUT</Text>
          <Text variant="display" style={styles.payoutAmount}>{money(offer.estimated_earning_cents)}</Text>
          {offer.is_high_demand && offer.surge_cents > 0 ? (
            <View style={styles.bonusPill}>
              <Ionicons name="flame" size={14} color={colors.onPrimary} />
              <Text variant="caption" style={styles.bonusText}>
                High Demand Bonus Included (+ {money(offer.surge_cents)})
              </Text>
            </View>
          ) : null}
        </View>

        <PartnerCard variant="lowest" style={styles.routeCard}>
          <View style={styles.mapWrap}>
            <DeliveryTrackerMap
              markers={markers}
              route={route}
              height={240}
              badgeLabel={mapBadge}
              showLegend
            />
          </View>
          {!riderPoint ? (
            <Text variant="caption" style={styles.locationHint}>
              Allow location access to show your position (purple pin) on the map.
            </Text>
          ) : null}

          <View style={styles.timeline}>
            <View style={styles.timelineLine} />
            <View style={styles.timelineItem}>
              <View style={[styles.timelineIcon, { backgroundColor: colors.surfaceContainerHigh }]}>
                <Ionicons name="storefront" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="caption" style={styles.timelineMeta}>
                  PICKUP{pickupKm != null ? ` • ${pickupKm.toFixed(1)} km away` : ''}
                </Text>
                <Text variant="label">{offer.mess_name}</Text>
                <Text variant="caption" style={styles.timelineSub}>{offer.mess_address || 'Kitchen pickup point'}</Text>
              </View>
              <View style={styles.readyPill}>
                <Text variant="caption" style={styles.readyText}>
                  {firstStop?.prep_ready_in_minutes ? `Ready in ${firstStop.prep_ready_in_minutes}m` : 'Ready Now'}
                </Text>
              </View>
            </View>

            {firstStop ? (
              <View style={styles.timelineItem}>
                <View style={[styles.timelineIcon, { backgroundColor: colors.secondaryContainer }]}>
                  <Ionicons name="home" size={16} color={colors.onSecondaryContainer} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="caption" style={styles.timelineMeta}>
                    DROP-OFF{dropKm != null ? ` • Est. ${eta}` : ''}
                  </Text>
                  <Text variant="label">{firstStop.address_title || firstStop.customer_name}</Text>
                  <Text variant="caption" style={styles.timelineSub} numberOfLines={2}>{firstStop.address_text}</Text>
                </View>
                <Text variant="caption" style={styles.gateCode}>{offer.handover_label || 'Contactless'}</Text>
              </View>
            ) : null}
          </View>
        </PartnerCard>

        <View style={styles.attrGrid}>
          <View style={styles.attrChip}>
            <Ionicons name="cube-outline" size={20} color={colors.primary} />
            <Text variant="caption" style={styles.attrTitle}>{itemCount} Items</Text>
            <Text variant="caption" style={styles.attrSub}>Order batch</Text>
          </View>
          <View style={styles.attrChip}>
            <Ionicons name="flash-outline" size={20} color={colors.secondary} />
            <Text variant="caption" style={styles.attrTitle}>Express</Text>
            <Text variant="caption" style={styles.attrSub}>Priority drop</Text>
          </View>
          <View style={styles.attrChip}>
            <Ionicons name="hand-left-outline" size={20} color={colors.tertiary} />
            <Text variant="caption" style={styles.attrTitle}>{isPrepaid ? 'Prepaid' : 'COD'}</Text>
            <Text variant="caption" style={styles.attrSub}>{isPrepaid ? 'No cash' : 'Collect cash'}</Text>
          </View>
        </View>

        {items.length > 0 ? (
          <View style={styles.itemTags}>
            {items.map((item, i) => (
              <View key={i} style={styles.itemTag}>
                <Text variant="caption" style={{ fontWeight: '600' }}>{item.quantity}× {item.name}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={[styles.footer, { paddingBottom: tabBarHeight + spacing.sm }]}>
        <Pressable style={styles.acceptBtn} onPress={accept} disabled={busy}>
          <Ionicons name="checkmark-circle" size={22} color={colors.onPrimary} />
          <Text variant="button" style={styles.acceptText}>
            Accept Offer ({money(offer.estimated_earning_cents)})
          </Text>
        </Pressable>
        <Pressable style={styles.declineBtn} onPress={reject} disabled={busy}>
          <Ionicons name="warning" size={18} color={colors.tertiary} />
          <Text variant="button" style={styles.declineText}>Decline Offer</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md },
  topPills: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dispatchPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surfaceContainerHigh, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  dispatchText: { fontWeight: '600', color: colors.text },
  timerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.tertiaryFixed, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
  },
  timerText: { fontWeight: '800', color: colors.onTertiaryFixed },
  countdownTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceContainerHigh, overflow: 'hidden' },
  countdownFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  payoutHero: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  payoutGlow: {
    position: 'absolute', right: -24, bottom: -24, width: 128, height: 128,
    borderRadius: 64, backgroundColor: 'rgba(91,61,245,0.4)',
  },
  payoutLabel: { color: colors.onPrimaryContainer, letterSpacing: 1, fontWeight: '600' },
  payoutAmount: { color: colors.onPrimary, fontSize: 40, lineHeight: 48, marginTop: 4 },
  bonusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  bonusText: { color: colors.onPrimary, fontWeight: '600' },
  routeCard: { padding: spacing.md, gap: spacing.md },
  mapWrap: { borderRadius: 12, overflow: 'hidden' },
  locationHint: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  timeline: { position: 'relative', gap: spacing.lg, paddingLeft: 4 },
  timelineLine: { position: 'absolute', left: 15, top: 28, bottom: 28, width: 2, backgroundColor: colors.border },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  timelineIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  timelineMeta: { color: colors.textMuted, fontWeight: '700', letterSpacing: 0.4 },
  timelineSub: { color: colors.textMuted, marginTop: 2 },
  readyPill: { backgroundColor: colors.primaryFixed, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  readyText: { color: colors.primary, fontWeight: '700' },
  gateCode: { color: colors.textMuted, maxWidth: 72, textAlign: 'right' },
  attrGrid: { flexDirection: 'row', gap: spacing.sm },
  attrChip: {
    flex: 1, backgroundColor: colors.surfaceContainerLow, borderRadius: 12,
    padding: spacing.sm, alignItems: 'center', gap: 4,
  },
  attrTitle: { fontWeight: '700', color: colors.text, textAlign: 'center' },
  attrSub: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },
  itemTags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  itemTag: { backgroundColor: colors.surfaceContainerLow, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: spacing.lg, gap: spacing.sm,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  acceptBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: '#5B3DF5', borderRadius: 14, paddingVertical: spacing.md + 2,
  },
  acceptText: { color: colors.onPrimary, fontWeight: '700' },
  declineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.surfaceContainerHigh, borderRadius: 14, paddingVertical: spacing.md,
  },
  declineText: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
});
