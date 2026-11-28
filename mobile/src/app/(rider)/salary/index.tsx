/** Salary — monthly salary and approved/paid salary invoices. */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { api, ApiError } from '@/api/client';
import type { RiderSalary } from '@/api/types';
import { SalaryStatusPill as StatusPill } from '@/components/SalaryStatusPill';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Loading } from '@/components/Loading';
import { PartnerCard, PartnerHeader } from '@/components/partner';
import { Text } from '@/components/ui/Text';
import { useTabBarHeight } from '@/hooks/useTabBarStyle';
import { colors, money, radius, spacing } from '@/theme';

export default function SalaryScreen() {
  const router = useRouter();
  const tabBarHeight = useTabBarHeight();
  const [data, setData] = useState<RiderSalary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.riderSalary());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load salary');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <View style={styles.screen}>
      <PartnerHeader />
      {!data && !error ? <Loading label="Loading salary…" /> : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 16 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.primary} />}
        >
          <Text variant="h1" style={{ fontSize: 24 }}>Salary</Text>
          {error ? <ErrorState message={error} variant="inline" onRetry={load} /> : null}
          {data ? (
            <>
              <PartnerCard variant="primary" style={styles.hero}>
                <Text variant="caption" style={styles.heroLabel}>MONTHLY SALARY</Text>
                <Text variant="display" style={styles.heroAmount}>
                  {data.monthly_salary_cents != null ? money(data.monthly_salary_cents) : 'Not set yet'}
                </Text>
                <Text variant="caption" style={styles.heroSub}>
                  {data.current_period_label}: {data.current_month_deliveries} deliveries · {data.current_month_days_active} working days
                </Text>
              </PartnerCard>

              <View style={styles.sectionHead}>
                <Text variant="h3">Salary invoices</Text>
                {data.total_paid_cents > 0 ? (
                  <Text variant="caption" style={{ color: colors.textMuted }}>Paid so far {money(data.total_paid_cents)}</Text>
                ) : null}
              </View>

              {data.invoices.length === 0 ? (
                <EmptyState icon="document-text-outline" title="No invoices yet" subtitle="Your monthly salary invoice appears here once it is approved." />
              ) : data.invoices.map((inv) => (
                <Pressable key={inv.id} onPress={() => router.push(`/(rider)/salary/${inv.id}` as never)} accessibilityRole="button">
                  <PartnerCard variant="lowest" style={styles.row}>
                    <View style={styles.rowIcon}><Ionicons name="document-text" size={20} color={colors.primary} /></View>
                    <View style={{ flex: 1 }}>
                      <Text variant="label" style={{ fontWeight: '700' }}>{inv.period_label}</Text>
                      <Text variant="caption" style={{ color: colors.textMuted }}>{inv.invoice_number}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text variant="label" style={{ fontWeight: '800' }}>{money(inv.net_cents)}</Text>
                      <StatusPill status={inv.status} />
                    </View>
                  </PartnerCard>
                </Pressable>
              ))}
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md },
  hero: { gap: 4 },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontWeight: '800', letterSpacing: 0.8 },
  heroAmount: { color: colors.onPrimary, fontSize: 34 },
  heroSub: { color: 'rgba(255,255,255,0.85)' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
});
