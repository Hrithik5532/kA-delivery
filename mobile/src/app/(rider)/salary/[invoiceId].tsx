/** Salary invoice detail (approved / paid). */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '@/api/client';
import type { SalaryInvoice } from '@/api/types';
import { ErrorState } from '@/components/ErrorState';
import { Loading } from '@/components/Loading';
import { PartnerCard } from '@/components/partner';
import { FlowScreenHeader } from '@/components/ui/FlowScreenHeader';
import { Text } from '@/components/ui/Text';
import { formatOrderTime } from '@/lib/format-time';
import { colors, money, spacing } from '@/theme';
import { SalaryStatusPill as StatusPill } from '@/components/SalaryStatusPill';

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Text variant={strong ? 'label' : 'bodySmall'} style={{ color: strong ? colors.text : colors.textMuted, fontWeight: strong ? '800' : '400' }}>{label}</Text>
      <Text variant={strong ? 'h3' : 'label'}>{value}</Text>
    </View>
  );
}

export default function SalaryInvoiceScreen() {
  const { invoiceId } = useLocalSearchParams<{ invoiceId: string }>();
  const id = Number(invoiceId);
  const [inv, setInv] = useState<SalaryInvoice | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const error = Number.isFinite(id) ? loadError : 'Invoice not found';

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    api.riderSalaryInvoice(id)
      .then(setInv)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Could not load invoice'));
  }, [id]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlowScreenHeader title="Salary invoice" />
      {error ? <ErrorState message={error} /> : !inv ? <Loading label="Loading invoice…" /> : (
        <ScrollView contentContainerStyle={styles.content}>
          <PartnerCard variant="lowest" style={{ gap: spacing.xs }}>
            <View style={styles.head}>
              <Text variant="h3">{inv.period_label}</Text>
              <StatusPill status={inv.status} />
            </View>
            <Text variant="caption" style={{ color: colors.textMuted }}>{inv.invoice_number}</Text>
          </PartnerCard>

          <PartnerCard variant="lowest">
            <Line label="Monthly salary" value={money(inv.base_salary_cents)} />
            <Line label="Additions" value={`+ ${money(inv.additions_cents)}`} />
            <Line label="Deductions" value={`− ${money(inv.deductions_cents)}`} />
            <View style={styles.divider} />
            <Line label="Net pay" value={money(inv.net_cents)} strong />
          </PartnerCard>

          {inv.notes ? (
            <PartnerCard variant="lowest">
              <Text variant="caption" style={{ color: colors.textMuted }}>Notes</Text>
              <Text variant="bodySmall" style={{ marginTop: 4 }}>{inv.notes}</Text>
            </PartnerCard>
          ) : null}

          <PartnerCard variant="lowest">
            <Line label="Deliveries" value={String(inv.deliveries_count)} />
            <Line label="Working days" value={String(inv.days_active)} />
            <Line label="Paid to" value={inv.upi_id || (inv.bank_name ? `${inv.bank_name}${inv.bank_account_masked ? ` ···· ${inv.bank_account_masked}` : ''}` : '—')} />
            {inv.approved_at ? <Line label="Approved" value={formatOrderTime(inv.approved_at)} /> : null}
            {inv.paid_at ? <Line label="Paid on" value={formatOrderTime(inv.paid_at)} /> : null}
            {inv.payment_reference ? <Line label="Payment ref." value={inv.payment_reference} /> : null}
          </PartnerCard>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 6 },
});
