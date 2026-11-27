/** Partner home — shift, online status, active delivery, offers, today's count. */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { api, ApiError } from '@/api/client';
import type { Batch, Offer, RiderDashboard, RiderSlots, UserOut } from '@/api/types';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { FeedbackBanner } from '@/components/FeedbackBanner';
import { useFeedback } from '@/components/FeedbackProvider';
import { Loading } from '@/components/Loading';
import { OnlineStatusBanner, PartnerCard, PartnerHeader } from '@/components/partner';
import { useRiderLocationStatus } from '@/components/RiderLiveLocation';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { config } from '@/config';
import { useTabBarHeight } from '@/hooks/useTabBarStyle';
import { slotSummary } from '@/lib/slots';
import { colors, formatStatus, radius, spacing, statusColor } from '@/theme';

function hasPendingStops(batch: Batch | null) {
  return !!batch?.stops.some((s) => s.status !== 'delivered');
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function RiderHome() {
  const tabBarHeight = useTabBarHeight();
  const router = useRouter();
  const feedback = useFeedback();
  const [me, setMe] = useState<UserOut | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [slots, setSlots] = useState<RiderSlots | null>(null);
  const [dashboard, setDashboard] = useState<RiderDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenOfferId = useRef<number | null>(null);

  const online = me?.rider_profile?.is_online ?? false;
  const approved = me?.rider_profile?.approval_status === 'approved';
  const activeBatch = useMemo(() => (hasPendingStops(batch) ? batch : null), [batch]);
  const { status: locStatus, lastError: locError } = useRiderLocationStatus();

  const load = useCallback(async () => {
    try {
      const u = await api.me();
      setMe(u);
      if (u.rider_profile?.approval_status === 'approved') {
        const [o, b, sl, d] = await Promise.all([
          api.riderOffers(),
          api.riderActive(),
          api.riderSlots().catch(() => null),
          api.riderDashboard().catch(() => null),
        ]);
        setOffers(o);
        setBatch(b);
        setSlots(sl);
        setDashboard(d);
        if (o.length > 0 && !hasPendingStops(b) && seenOfferId.current !== o[0].id) {
          seenOfferId.current = o[0].id;
          feedback.info(`New delivery from ${o[0].mess_name ?? 'a kitchen'}`, 'New delivery');
          router.push(`/(rider)/request/${o[0].id}` as never);
        }
      }
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load. Pull down to retry.');
    } finally {
      setRefreshing(false);
    }
  }, [router, feedback]);

  useFocusEffect(useCallback(() => {
    void load();
    timer.current = setInterval(load, config.locationIntervalMs);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [load]));

  const toggleOnline = async (value: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await (value ? api.riderOnline() : api.riderOffline());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change status');
    } finally {
      await load();
      setBusy(false);
    }
  };

  if (!me) {
    return (
      <View style={styles.screen}>
        <PartnerHeader online={online} />
        {error ? <ErrorState message={error} onRetry={load} /> : <Loading label="Loading…" />}
      </View>
    );
  }

  const firstName = me.full_name?.split(' ')[0] ?? 'Partner';
  const outsideSlot = !online && slots?.enforced === true && !slots.can_go_online_now;
  const shift = slots?.enforced ? slotSummary(slots) : null;

  return (
    <View style={styles.screen}>
      <PartnerHeader online={online} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 16 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.primary} />}
      >
        {error ? <ErrorState message={error} variant="inline" /> : null}

        {!approved ? (
          <PartnerCard>
            <Text variant="h3">Verification: {(me.rider_profile?.approval_status ?? 'draft').replace(/_/g, ' ')}</Text>
            {me.rider_profile?.approval_status === 'needs_correction' && me.rider_profile?.correction_reason ? (
              <FeedbackBanner severity="warning" title="Action needed" message={me.rider_profile.correction_reason} style={{ marginTop: spacing.sm }} />
            ) : (
              <Text variant="bodySmall" style={{ color: colors.textMuted, marginTop: spacing.sm }}>
                Submit your documents to get verified and start delivering.
              </Text>
            )}
            <Button title="Manage documents" variant="secondary" onPress={() => router.push('/(rider)/documents' as never)} style={{ marginTop: spacing.md }} />
          </PartnerCard>
        ) : (
          <>
            <View>
              <Text variant="h1" style={styles.greetingTitle}>{greeting()}, {firstName}</Text>
              <Text variant="bodySmall" style={{ color: colors.textMuted, marginTop: spacing.xs }}>
                {online ? "You're online and can receive deliveries." : 'You are offline.'}
              </Text>
            </View>

            <OnlineStatusBanner online={online} onToggle={toggleOnline} disabled={busy || outsideSlot} />

            {shift ? (
              <Pressable onPress={() => router.push('/(rider)/slots' as never)} accessibilityRole="button">
                <PartnerCard variant="lowest" style={styles.rowCard}>
                  <Ionicons name="time" size={20} color={slots?.current_slot_id ? colors.secondary : colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text variant="label" style={{ fontWeight: '700' }}>{shift.title}</Text>
                    <Text variant="caption" style={{ color: colors.textMuted, marginTop: 2 }}>{shift.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </PartnerCard>
              </Pressable>
            ) : null}

            {locStatus === 'denied' ? (
              <FeedbackBanner severity="warning" title="Location access needed" message="Allow location so ops and customers can track your delivery." />
            ) : null}
            {locError ? <FeedbackBanner severity="error" title="Location update failed" message={locError} /> : null}
            {online && (locStatus === 'idle' || locStatus === 'requesting') ? (
              <FeedbackBanner severity="info" title="Waiting for GPS" message="Keep the app open so your position is shared." />
            ) : null}

            <PartnerCard variant="lowest" style={styles.rowCard}>
              <View style={styles.statIcon}><Ionicons name="cube" size={18} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text variant="caption" style={{ color: colors.textMuted }}>Deliveries today</Text>
                <Text variant="h2">{dashboard?.today_deliveries ?? 0}</Text>
              </View>
            </PartnerCard>

            {activeBatch ? (() => {
              const pending = activeBatch.stops.filter((s) => s.status !== 'delivered');
              const next = pending[0];
              const isPickup = activeBatch.status === 'assigned';
              const statusKey = next?.status ?? activeBatch.status;
              return (
                <PartnerCard variant="container" style={{ gap: spacing.sm }}>
                  <View style={styles.activeTop}>
                    <Text variant="caption" style={{ color: colors.secondary, fontWeight: '800' }}>ACTIVE DELIVERY</Text>
                    <View style={[styles.statusPill, { backgroundColor: statusColor(statusKey) + '22' }]}>
                      <Text variant="caption" style={{ color: statusColor(statusKey), fontWeight: '700' }}>{formatStatus(statusKey)}</Text>
                    </View>
                  </View>
                  <Text variant="h3">{activeBatch.mess_name}</Text>
                  {next ? (
                    <Text variant="bodySmall" style={{ color: colors.textMuted }}>Order #{next.order_id} · {next.customer_name}</Text>
                  ) : null}
                  <Button
                    title={isPickup ? 'Go to pickup' : 'Continue delivery'}
                    onPress={() => router.push((isPickup ? '/(rider)/pickup' : '/(rider)/active') as never)}
                  />
                </PartnerCard>
              );
            })() : null}

            {offers.map((offer) => (
              <PartnerCard key={offer.id} variant="container" style={{ gap: spacing.sm }}>
                <View style={styles.activeTop}>
                  <Text variant="caption" style={{ color: colors.primary, fontWeight: '800' }}>NEW DELIVERY</Text>
                </View>
                <Text variant="h3">{offer.mess_name ?? 'Pickup'}</Text>
                <Text variant="bodySmall" style={{ color: colors.textMuted }}>{offer.order_count} order(s) to deliver</Text>
                <Button title="View delivery" onPress={() => router.push(`/(rider)/request/${offer.id}` as never)} />
              </PartnerCard>
            ))}

            {dashboard?.last_completed && !activeBatch ? (
              <PartnerCard style={styles.rowCard}>
                <View style={styles.statIcon}><Ionicons name="checkmark-done" size={18} color={colors.secondary} /></View>
                <View style={{ flex: 1 }}>
                  <Text variant="caption" style={{ color: colors.textMuted }}>Last completed · {dashboard.last_completed.completed_ago_label || 'recently'}</Text>
                  <Text variant="label">{dashboard.last_completed.mess_name}</Text>
                  <Text variant="caption" style={{ color: colors.textMuted }}>
                    Order #{dashboard.last_completed.ticket_ref} · {dashboard.last_completed.item_count} items
                  </Text>
                </View>
              </PartnerCard>
            ) : null}

            {online && !activeBatch && offers.length === 0 ? (
              <EmptyState icon="bicycle-outline" title="No deliveries right now" subtitle="New deliveries will appear here automatically." />
            ) : null}
            {!online && !activeBatch ? (
              <PartnerCard>
                <Text variant="bodySmall" style={{ color: colors.textMuted, textAlign: 'center' }}>
                  {outsideSlot
                    ? 'You will go online automatically when your shift starts.'
                    : 'Go online to receive deliveries.'}
                </Text>
              </PartnerCard>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md },
  greetingTitle: { fontSize: 24 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  statIcon: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryFixed,
    alignItems: 'center', justifyContent: 'center',
  },
  activeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
});
