/** My working slots — assigned by the operations team (read-only here).
 *
 * During an assigned slot the backend switches the partner online; outside
 * their slots they stay offline.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '@/api/client';
import type { RiderSlots } from '@/api/types';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { FeedbackBanner } from '@/components/FeedbackBanner';
import { Loading } from '@/components/Loading';
import { PartnerCard } from '@/components/partner';
import { FlowScreenHeader } from '@/components/ui/FlowScreenHeader';
import { Text } from '@/components/ui/Text';
import { slotTimingLabel } from '@/lib/slots';
import { colors, radius, spacing } from '@/theme';

export default function SlotsScreen() {
  const [data, setData] = useState<RiderSlots | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.riderSlots());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your shifts');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const mine = data?.slots.filter((s) => s.selected) ?? [];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlowScreenHeader title="My working slots" />
      {!data && !error ? <Loading label="Loading shifts…" /> : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.primary} />}
        >
          {error ? <ErrorState message={error} variant="inline" onRetry={load} /> : null}
          {data && !data.enforced ? (
            <FeedbackBanner severity="info" title="No fixed shifts" message="You can go online any time." />
          ) : null}
          {data?.enforced ? (
            <Text variant="bodySmall" style={{ color: colors.textMuted }}>
              Your operations team sets your shifts. You go online automatically when a shift starts and offline when it
              ends (after finishing any delivery in progress).
            </Text>
          ) : null}

          {data?.enforced && mine.length === 0 ? (
            <EmptyState icon="time-outline" title="No shift assigned yet" subtitle="Ask your operations manager to assign your working slots." />
          ) : null}

          {mine.map((slot) => (
            <PartnerCard key={slot.id} variant="lowest" style={StyleSheet.flatten([styles.slot, slot.is_running && styles.slotOn])}>
              <View style={[styles.icon, slot.is_running && { backgroundColor: colors.secondary }]}>
                <Ionicons name="time" size={20} color={slot.is_running ? colors.onSecondary : colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text variant="label" style={{ fontWeight: '700' }}>{slot.name}</Text>
                  {slot.is_running ? (
                    <View style={styles.livePill}><Text variant="caption" style={styles.liveText}>ON NOW</Text></View>
                  ) : null}
                </View>
                <Text variant="h3" style={{ marginTop: 2 }}>{slot.label}</Text>
                <Text variant="caption" style={{ color: colors.textMuted, marginTop: 2 }}>{slotTimingLabel(slot)}</Text>
              </View>
            </PartnerCard>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md },
  slot: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1.5, borderColor: colors.borderLight },
  slotOn: { borderColor: colors.secondary, backgroundColor: colors.secondarySoft },
  icon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  livePill: { backgroundColor: colors.secondary, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 1 },
  liveText: { color: colors.onSecondary, fontWeight: '800', fontSize: 10 },
});
