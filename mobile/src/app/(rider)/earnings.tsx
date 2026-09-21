import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { api, ApiError } from '@/api/client';
import type { EarningsBucket, EarningsDetailResponse, UserOut } from '@/api/types';
import { ErrorState } from '@/components/ErrorState';
import { Loading } from '@/components/Loading';
import { EarningsBarChart, PartnerCard, PartnerHeader, SegmentedControl } from '@/components/partner';
import { Text } from '@/components/ui/Text';
import { useTabBarHeight } from '@/hooks/useTabBarStyle';
import { colors, money, spacing } from '@/theme';

function rowIcon(name: string) {
  if (name === 'today') return 'bicycle';
  if (name === 'weekend') return 'storefront';
  return 'restaurant';
}

export default function Earnings() {
  const router = useRouter();
  const tabBarHeight = useTabBarHeight();
  const [data, setData] = useState<EarningsDetailResponse | null>(null);
  const [me, setMe] = useState<UserOut | null>(null);
  const [view, setView] = useState<'daily' | 'weekly'>('weekly');
  const [selectedBucket, setSelectedBucket] = useState<EarningsBucket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [detail, user] = await Promise.all([
        api.riderEarningsDetail(view),
        api.me().catch(() => null),
      ]);
      setData(detail);
      setMe(user);
      setSelectedBucket(null);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load earnings');
    } finally {
      setLoading(false);
    }
  }, [view]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    void load();
  }, [load]));

  const online = me?.rider_profile?.is_online ?? false;

  if (loading && !data) {
    return (
      <View style={styles.screen}>
        <PartnerHeader online={online} />
        <Loading label="Loading earnings…" />
      </View>
    );
  }

  if (!data && error) {
    return (
      <View style={styles.screen}>
        <PartnerHeader online={online} />
        <ErrorState message={error} onRetry={load} variant="page" />
      </View>
    );
  }

  if (!data) return null;

  const weekly = data.weekly;
  const daily = data.daily;
  const isWeekly = view === 'weekly';
  const chartBuckets = isWeekly ? weekly.buckets : daily.buckets;
  const activeBucket = selectedBucket ?? weekly.peak ?? chartBuckets.find((b) => b.amount_cents > 0) ?? null;
  const totalCents = isWeekly ? weekly.total_cents : daily.total_cents;
  const trips = isWeekly ? weekly.trips : daily.trips;
  const pctLabel = `${weekly.pct_change >= 0 ? '+' : ''}${weekly.pct_change.toFixed(1)}% vs last week`;
  const tripsLabel = isWeekly
    ? `${weekly.range_label} • ${trips} Completed Trips`
    : `${trips} deliveries today`;
  const onlineLabel = isWeekly ? weekly.online_label : daily.online_label;
  const avgCents = isWeekly ? weekly.avg_per_delivery_cents : (trips > 0 ? Math.round(totalCents / trips) : 0);

  const activeIncentives = data.incentives.filter((i) => i.status === 'active');
  const awardedIncentives = data.incentives.filter((i) => i.status === 'awarded');

  return (
    <View style={styles.screen}>
      <PartnerHeader online={online} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 16 }]}>
        {error ? <ErrorState message={error} variant="inline" onRetry={load} /> : null}

        <SegmentedControl
          tone="brand"
          options={[{ key: 'daily', label: 'Daily' }, { key: 'weekly', label: 'Weekly' }]}
          value={view}
          onChange={setView}
        />

        <PartnerCard variant="lowest" style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Text variant="label" style={{ color: colors.textMuted }}>
              {isWeekly ? 'Weekly Total' : "Today's Total"}
            </Text>
            <View style={styles.heroTopRight}>
              {isWeekly && weekly.pct_change !== 0 ? (
                <View style={styles.trendPill}>
                  <Ionicons name="trending-up" size={12} color={colors.secondary} />
                  <Text variant="caption" style={styles.trendText}>{pctLabel}</Text>
                </View>
              ) : null}
              <Pressable style={styles.walletIcon} onPress={() => router.push('/(rider)/wallet' as never)}>
                <Ionicons name="wallet" size={18} color={colors.primary} />
              </Pressable>
            </View>
          </View>

          <Text variant="display" style={styles.heroAmount}>{money(totalCents)}</Text>
          <Text variant="bodySmall" style={{ color: colors.textMuted, marginTop: spacing.xs }}>{tripsLabel}</Text>

          <View style={styles.metricRow}>
            <View style={styles.metricCol}>
              <Text variant="caption" style={styles.metricLabel}>ONLINE HOURS</Text>
              <Text variant="h3">{onlineLabel}</Text>
            </View>
            <View style={styles.metricCol}>
              <Text variant="caption" style={styles.metricLabel}>AVG / DELIVERY</Text>
              <Text variant="h3">{avgCents > 0 ? money(avgCents) : '—'}</Text>
            </View>
          </View>

          {chartBuckets.length > 0 ? (
            <EarningsBarChart
              buckets={chartBuckets}
              selectedKey={activeBucket?.key}
              onSelect={setSelectedBucket}
            />
          ) : null}

          {activeBucket && activeBucket.amount_cents > 0 ? (
            <View style={styles.insight}>
              <Ionicons name="analytics-outline" size={16} color={colors.textMuted} />
              <Text variant="caption" style={{ color: colors.textMuted, flex: 1 }}>
                {selectedBucket
                  ? `${activeBucket.label} earned ${money(activeBucket.amount_cents)} with ${activeBucket.trips} completed trips.`
                  : `Peak rush on ${activeBucket.label} yielded ${money(activeBucket.amount_cents)} with ${activeBucket.trips} completed trips.`}
              </Text>
            </View>
          ) : null}
        </PartnerCard>

        <View style={styles.sectionHeader}>
          <View style={styles.incentiveTitleRow}>
            <Ionicons name="trophy" size={18} color={colors.tertiary} />
            <Text variant="h3">Active Incentives & Bonuses</Text>
          </View>
          {data.active_incentive_count > 0 ? (
            <View style={styles.activeCountPill}>
              <Text variant="caption" style={styles.activeCountText}>{data.active_incentive_count} Active</Text>
            </View>
          ) : null}
        </View>

        {activeIncentives.map((quest) => (
          <PartnerCard key={quest.id} variant="lowest">
            <View style={styles.incentiveTop}>
              <View style={styles.incentiveIcon}>
                <Ionicons name="flash" size={18} color={colors.tertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="label">{quest.title}</Text>
                <Text variant="caption" style={{ color: colors.textMuted }}>{quest.subtitle}</Text>
              </View>
              <Text variant="label" style={{ color: colors.secondary }}>+{money(quest.bonus_cents)}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${quest.progress_pct}%` }]} />
            </View>
            <Text variant="caption" style={{ color: colors.textMuted, marginTop: spacing.xs }}>
              {quest.current_value} / {quest.target_value} trips completed · {quest.trips_remaining} trips left
            </Text>
          </PartnerCard>
        ))}

        {awardedIncentives.map((bonus) => (
          <PartnerCard key={bonus.id} variant="container" style={styles.bonusCard}>
            <View style={styles.bonusRow}>
              <View style={styles.bonusIcon}>
                <Ionicons name="shield-checkmark" size={18} color={colors.tertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="label">{bonus.title}</Text>
                <Text variant="caption" style={{ color: colors.textMuted }}>{bonus.subtitle}</Text>
              </View>
              <View style={styles.awardedPill}>
                <Text variant="caption" style={styles.awardedText}>AWARDED</Text>
              </View>
            </View>
            <Text variant="h2" style={{ marginTop: spacing.sm }}>{money(bonus.bonus_cents)}</Text>
          </PartnerCard>
        ))}

        <View style={styles.sectionHeader}>
          <Text variant="h3">Recent Daily Earnings</Text>
          <Pressable>
            <Text variant="caption" style={{ color: colors.primary, fontWeight: '700' }}>View Statement</Text>
          </Pressable>
        </View>

        {data.recent_daily.length === 0 ? (
          <PartnerCard variant="lowest">
            <Text variant="bodySmall" style={{ color: colors.textMuted, textAlign: 'center' }}>
              Complete deliveries to see daily earnings here.
            </Text>
          </PartnerCard>
        ) : (
          data.recent_daily.map((row) => (
            <PartnerCard key={row.key} variant="lowest" style={styles.dayCard}>
              <View style={styles.dayRow}>
                <View style={styles.dayIcon}>
                  <Ionicons name={rowIcon(row.icon)} size={18} color={colors.onSecondaryContainer} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.dayTitleRow}>
                    <Text variant="label">{row.title}</Text>
                    <View style={[styles.dayBadge, row.title === 'Today' && styles.dayBadgeToday]}>
                      <Text variant="caption" style={[styles.dayBadgeText, row.title === 'Today' && styles.dayBadgeTextToday]}>
                        {row.badge}
                      </Text>
                    </View>
                  </View>
                  <Text variant="caption" style={{ color: colors.textMuted }}>{row.subtitle}</Text>
                  {row.tag ? (
                    <Text variant="caption" style={[styles.tagText, row.tag.includes('Peak') && styles.tagPeak]}>
                      {row.tag}
                    </Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="h3">{money(row.amount_cents)}</Text>
                  <Text variant="caption" style={{ color: colors.textMuted }}>{row.trips} trips</Text>
                </View>
              </View>
            </PartnerCard>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md },
  heroCard: { padding: spacing.lg },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTopRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  walletIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successContainer,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 20,
  },
  trendText: { color: colors.secondary, fontWeight: '700' },
  heroAmount: { marginTop: spacing.xs, color: colors.text },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  metricCol: { flex: 1 },
  metricLabel: { color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  insight: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginTop: spacing.md,
    backgroundColor: colors.surfaceContainer,
    padding: spacing.md,
    borderRadius: 12,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  incentiveTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  activeCountPill: { backgroundColor: colors.primaryFixed, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 12 },
  activeCountText: { color: colors.primary, fontWeight: '800' },
  incentiveTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  incentiveIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.tertiaryFixed, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 8, backgroundColor: colors.surfaceVariant, borderRadius: 4, marginTop: spacing.md, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.secondary, borderRadius: 4 },
  bonusCard: { borderWidth: 1, borderColor: colors.tertiaryFixed },
  bonusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bonusIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.tertiaryFixed, alignItems: 'center', justifyContent: 'center' },
  awardedPill: { backgroundColor: colors.tertiaryFixed, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 8 },
  awardedText: { color: colors.onTertiaryFixed, fontWeight: '800', fontSize: 10 },
  dayCard: { padding: spacing.md },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dayIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.secondaryFixed, alignItems: 'center', justifyContent: 'center' },
  dayTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  dayBadge: { backgroundColor: colors.surfaceContainerHigh, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  dayBadgeToday: { backgroundColor: colors.successContainer },
  dayBadgeText: { color: colors.textMuted, fontWeight: '700', fontSize: 10 },
  dayBadgeTextToday: { color: colors.secondary },
  tagText: { color: colors.secondary, marginTop: 2, fontWeight: '600' },
  tagPeak: { color: colors.primary },
});
