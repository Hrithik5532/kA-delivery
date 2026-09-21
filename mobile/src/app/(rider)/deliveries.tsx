import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { api, ApiError } from '@/api/client';
import type { DeliveryHistoryResponse, HistoryPeriod, HistoryStatus, UserOut } from '@/api/types';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Loading } from '@/components/Loading';
import { PartnerCard, PartnerHeader } from '@/components/partner';
import { Text } from '@/components/ui/Text';
import { useTabBarHeight } from '@/hooks/useTabBarStyle';
import { colors, money, spacing } from '@/theme';

const PERIODS: { key: HistoryPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
];

function StatusBadge({ label, tone }: { label: string; tone: 'completed' | 'cancelled' }) {
  const isCompleted = tone === 'completed';
  return (
    <View style={[styles.statusBadge, isCompleted ? styles.statusCompleted : styles.statusCancelled]}>
      <View style={[styles.statusDot, { backgroundColor: isCompleted ? colors.secondary : colors.warning }]} />
      <Text variant="caption" style={[styles.statusText, { color: isCompleted ? colors.secondary : colors.warning }]}>
        {label}
      </Text>
    </View>
  );
}

function HistoryCard({ item }: { item: DeliveryHistoryResponse['items'][number] }) {
  const isCompleted = item.status === 'completed';
  const distanceLabel = item.distance_km != null ? `${item.distance_km} km` : null;
  const meta = distanceLabel ? `${item.time_label} • ${distanceLabel}` : item.time_label;

  return (
    <PartnerCard variant="lowest" style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={styles.docIcon}>
            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
          </View>
          <Text variant="label" style={styles.ticketRef}>{item.ticket_ref}</Text>
        </View>
        <StatusBadge label={item.status_label} tone={isCompleted ? 'completed' : 'cancelled'} />
      </View>

      <View style={styles.infoRow}>
        <Ionicons name="storefront-outline" size={16} color={colors.primary} />
        <Text variant="bodySmall" style={styles.infoText} numberOfLines={1}>{item.mess_name}</Text>
      </View>

      <View style={styles.infoRow}>
        <Ionicons name="navigate-outline" size={16} color={colors.secondary} />
        <Text variant="bodySmall" style={styles.infoText} numberOfLines={1}>{item.dropoff_area}</Text>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.footerLeft}>
          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
          <Text variant="caption" style={styles.metaText}>{meta}</Text>
          {item.tip_cents > 0 ? (
            <View style={styles.tipBadge}>
              <Text variant="caption" style={styles.tipText}>+{money(item.tip_cents)} Tip</Text>
            </View>
          ) : null}
          {item.has_surge && item.surge_multiplier ? (
            <View style={styles.surgeBadge}>
              <Text variant="caption" style={styles.surgeText}>Surge {item.surge_multiplier}x</Text>
            </View>
          ) : null}
        </View>
        {isCompleted ? (
          <Text variant="h3" style={styles.amount}>{money(item.amount_cents + item.tip_cents)}</Text>
        ) : null}
      </View>
    </PartnerCard>
  );
}

export default function DeliveryHistory() {
  const tabBarHeight = useTabBarHeight();
  const [data, setData] = useState<DeliveryHistoryResponse | null>(null);
  const [me, setMe] = useState<UserOut | null>(null);
  const [status, setStatus] = useState<HistoryStatus>('completed');
  const [period, setPeriod] = useState<HistoryPeriod>('this_week');
  const [periodOpen, setPeriodOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [history, user] = await Promise.all([
        api.riderHistory(status, period),
        api.me().catch(() => null),
      ]);
      setData(history);
      setMe(user);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load delivery history');
    } finally {
      setLoading(false);
    }
  }, [status, period]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    void load();
  }, [load]));

  const online = me?.rider_profile?.is_online ?? false;
  const summary = data?.summary;
  const items = data?.items ?? [];

  if (loading && !data) {
    return (
      <View style={styles.screen}>
        <PartnerHeader online={online} />
        <Loading label="Loading history…" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <PartnerHeader online={online} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 16 }]}>
        {error ? <ErrorState message={error} variant="inline" onRetry={load} /> : null}

        <View style={styles.filterRow}>
          <Pressable style={styles.dateFilter} onPress={() => setPeriodOpen(true)}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text variant="caption" style={styles.dateFilterLabel}>DATE FILTER</Text>
              <Text variant="label" numberOfLines={1}>{data?.period_label ?? 'This Week'}</Text>
            </View>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable style={styles.filterBtn} accessibilityLabel="Filter options">
            <Ionicons name="options-outline" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, status === 'completed' && styles.tabActive]}
            onPress={() => setStatus('completed')}
          >
            <Ionicons
              name="checkmark-circle"
              size={16}
              color={status === 'completed' ? colors.primary : colors.textMuted}
            />
            <Text variant="button" style={[styles.tabText, status === 'completed' && styles.tabTextActive]}>
              Completed ({summary?.completed_count ?? 0})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, status === 'cancelled' && styles.tabActive]}
            onPress={() => setStatus('cancelled')}
          >
            <Ionicons
              name="close-circle-outline"
              size={16}
              color={status === 'cancelled' ? colors.primary : colors.textMuted}
            />
            <Text variant="button" style={[styles.tabText, status === 'cancelled' && styles.tabTextActive]}>
              Cancelled ({summary?.cancelled_count ?? 0})
            </Text>
          </Pressable>
        </View>

        {status === 'completed' && summary ? (
          <PartnerCard variant="container" style={styles.summaryCard}>
            <View style={styles.summaryCol}>
              <View style={styles.summaryIconWrap}>
                <Ionicons name="checkmark-circle" size={22} color={colors.secondary} />
              </View>
              <View>
                <Text variant="caption" style={styles.summaryLabel}>Completed Runs</Text>
                <Text variant="h3">{summary.completed_count} Deliveries</Text>
              </View>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCol}>
              <Text variant="caption" style={styles.summaryLabel}>Total Earned</Text>
              <Text variant="display" style={styles.summaryAmount}>{money(summary.total_earned_cents)}</Text>
            </View>
          </PartnerCard>
        ) : null}

        <FlatList
          data={items}
          keyExtractor={(item) => String(item.delivery_id)}
          scrollEnabled={false}
          ListEmptyComponent={
            <EmptyState
              icon="time-outline"
              title={status === 'completed' ? 'No completed deliveries' : 'No cancelled deliveries'}
              subtitle="Try a different date range or go online to start earning."
            />
          }
          renderItem={({ item }) => <HistoryCard item={item} />}
        />
      </ScrollView>

      <Modal visible={periodOpen} transparent animationType="fade" onRequestClose={() => setPeriodOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPeriodOpen(false)}>
          <View style={styles.modalSheet}>
            <Text variant="h3" style={{ marginBottom: spacing.md }}>Date range</Text>
            {PERIODS.map((opt) => {
              const active = period === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  style={[styles.periodRow, active && styles.periodRowActive]}
                  onPress={() => {
                    setPeriod(opt.key);
                    setPeriodOpen(false);
                  }}
                >
                  <Text variant="label" style={{ color: active ? colors.primary : colors.text }}>{opt.label}</Text>
                  {active ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md },
  filterRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'stretch' },
  dateFilter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dateFilterLabel: { color: colors.textMuted, fontWeight: '700', letterSpacing: 0.6, fontSize: 10 },
  filterBtn: {
    width: 48,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm + 2,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  tabActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryFixed,
  },
  tabText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: colors.primary },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  summaryCol: { flex: 1, gap: 4 },
  summaryIconWrap: { marginBottom: 4 },
  summaryLabel: { color: colors.textMuted, fontWeight: '600' },
  summaryDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.borderLight,
    marginHorizontal: spacing.xs,
  },
  summaryAmount: { color: colors.secondary, fontSize: 28, lineHeight: 34 },
  card: { padding: spacing.md, gap: spacing.sm, marginBottom: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  docIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketRef: { fontWeight: '800', fontSize: 16 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusCompleted: { backgroundColor: colors.successContainer },
  statusCancelled: { backgroundColor: '#FFF3E0' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontWeight: '800', fontSize: 10, letterSpacing: 0.4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infoText: { flex: 1, color: colors.text, fontWeight: '600' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  footerLeft: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  metaText: { color: colors.textMuted },
  tipBadge: {
    backgroundColor: colors.successContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tipText: { color: colors.secondary, fontWeight: '700', fontSize: 11 },
  surgeBadge: {
    backgroundColor: '#FFF0E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  surgeText: { color: '#E65100', fontWeight: '700', fontSize: 11 },
  amount: { fontWeight: '800', fontSize: 20 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  periodRowActive: { backgroundColor: colors.primaryFixed + '40' },
});
