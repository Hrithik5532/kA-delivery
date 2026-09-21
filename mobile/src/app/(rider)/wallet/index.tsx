import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '@/api/client';
import type { WalletDetails, WalletTransaction, WalletTxnFilter } from '@/api/types';
import { BrandLogo } from '@/components/BrandLogo';
import { ErrorState } from '@/components/ErrorState';
import { useFeedback } from '@/components/FeedbackProvider';
import { Loading } from '@/components/Loading';
import { PartnerCard } from '@/components/partner';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { colors, money, spacing } from '@/theme';

const FILTERS: { key: WalletTxnFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'withdrawals', label: 'Withdrawals' },
  { key: 'earnings', label: 'Order Earnings' },
  { key: 'incentives', label: 'Incentives' },
];

function txnIcon(name: string): keyof typeof Ionicons.glyphMap {
  const map: Record<string, keyof typeof Ionicons.glyphMap> = {
    'arrow-up-circle': 'arrow-up-circle',
    'fast-food': 'fast-food',
    star: 'star',
    calendar: 'calendar',
  };
  return map[name] ?? 'receipt';
}

function statusStyle(status: string) {
  if (status === 'processing') return { bg: '#FFF3E0', color: '#E65100' };
  if (status === 'completed') return { bg: colors.successContainer, color: colors.secondary };
  return { bg: colors.surfaceContainerHigh, color: colors.textMuted };
}

export default function Wallet() {
  const router = useRouter();
  const feedback = useFeedback();
  const [wallet, setWallet] = useState<WalletDetails | null>(null);
  const [txns, setTxns] = useState<WalletTransaction[]>([]);
  const [filter, setFilter] = useState<WalletTxnFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissProcessing, setDismissProcessing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [w, t] = await Promise.all([
        api.riderWallet(),
        api.riderWalletTransactions(filter),
      ]);
      setWallet(w);
      setTxns(t.items);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load wallet');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    void load();
  }, [load]));

  useEffect(() => {
    if (!wallet) return;
    void api.riderWalletTransactions(filter).then((t) => setTxns(t.items)).catch(() => {});
  }, [filter, wallet]);

  const goToWithdraw = (amountCents?: number) => {
    if (amountCents) {
      router.push({ pathname: '/(rider)/wallet/withdraw', params: { amount: String(amountCents) } } as never);
      return;
    }
    router.push('/(rider)/wallet/withdraw' as never);
  };

  if (loading && !wallet) {
    return (
      <SafeAreaView style={styles.screen}>
        <Loading label="Loading wallet…" />
      </SafeAreaView>
    );
  }

  if (!wallet && error) {
    return (
      <SafeAreaView style={styles.screen}>
        <ErrorState message={error} onRetry={load} variant="page" />
      </SafeAreaView>
    );
  }

  if (!wallet) return null;

  const quickAmounts = [
    ...wallet.quick_amounts_cents,
    wallet.available_balance_cents,
  ];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="arrow-back" onPress={() => router.back()} color={colors.text} />
        <BrandLogo size={28} />
        <Text variant="h3" style={{ flex: 1, textAlign: 'center' }}>Wallet</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.headerBtn} onPress={() => router.push('/(rider)/help' as never)}>
            <Ionicons name="headset-outline" size={20} color={colors.text} />
          </Pressable>
          <Pressable style={styles.headerAvatar} onPress={() => router.push('/(rider)/profile' as never)}>
            <Text style={{ fontSize: 14 }}>👤</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error ? <ErrorState message={error} variant="inline" onRetry={load} /> : null}

        <View style={styles.balanceCard}>
          <View style={styles.balanceTop}>
            <View style={styles.balanceTitleRow}>
              <Ionicons name="wallet" size={18} color={colors.onPrimary} />
              <Text variant="caption" style={styles.balanceLabel}>TOTAL WALLET BALANCE</Text>
            </View>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text variant="caption" style={styles.liveText}>Live Escrow</Text>
            </View>
          </View>
          <Text variant="display" style={styles.balanceAmount}>{money(wallet.total_balance_cents)}</Text>
          <Text variant="caption" style={styles.balanceSub}>
            {wallet.updated_label} • Instant payout active
          </Text>

          <View style={styles.subBalanceRow}>
            <View style={styles.subBalanceBox}>
              <Text variant="caption" style={styles.subBalanceLabel}>Locked / In-Escrow</Text>
              <Text variant="h3" style={styles.subBalanceValue}>{money(wallet.locked_balance_cents)}</Text>
              <Text variant="caption" style={styles.subBalanceHint}>Active COD orders</Text>
            </View>
            <View style={styles.subBalanceBox}>
              <Text variant="caption" style={styles.subBalanceLabel}>Available for Cashout</Text>
              <Text variant="h3" style={styles.subBalanceValue}>{money(wallet.available_balance_cents)}</Text>
              <Text variant="caption" style={styles.subBalanceHint}>0% delay on IMPS</Text>
            </View>
          </View>

          <View style={styles.balanceActions}>
            <Button
              title="Withdraw Money"
              onPress={() => goToWithdraw()}
              style={styles.withdrawBtn}
              variant="secondary"
            />
            <Pressable style={styles.swapBtn}>
              <Ionicons name="swap-horizontal" size={20} color={colors.onPrimary} />
            </Pressable>
          </View>
        </View>

        {wallet.processing_withdrawal && !dismissProcessing ? (
          <View style={styles.processingBanner}>
            <View style={styles.processingLeft}>
              <Ionicons name="time-outline" size={20} color="#E65100" />
              <View style={{ flex: 1 }}>
                <View style={styles.processingTop}>
                  <Text variant="label">{money(wallet.processing_withdrawal.amount_cents)}</Text>
                  <View style={styles.processingBadge}>
                    <Text variant="caption" style={styles.processingBadgeText}>PROCESSING</Text>
                  </View>
                </View>
                <Text variant="caption" style={{ color: colors.textMuted }}>
                  {wallet.processing_withdrawal.bank_label}
                </Text>
                <Text variant="caption" style={{ color: colors.textMuted, marginTop: 2 }}>
                  {wallet.processing_withdrawal.eta_label}
                </Text>
                <Pressable><Text variant="caption" style={styles.trackLink}>Track Status ›</Text></Pressable>
              </View>
            </View>
            <Pressable onPress={() => setDismissProcessing(true)}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text variant="h3">Quick Cashout</Text>
          <View style={styles.zeroHoldPill}>
            <Text variant="caption" style={styles.zeroHoldText}>ZERO HOLD</Text>
          </View>
        </View>

        <View style={styles.chipRow}>
          {quickAmounts.map((amt, i) => {
            const isAll = i === quickAmounts.length - 1;
            const label = isAll ? `All ${money(amt)}` : money(amt);
            return (
              <Pressable
                key={String(amt)}
                style={styles.chip}
                onPress={() => goToWithdraw(amt)}
              >
                <Text variant="caption" style={styles.chipText}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <PartnerCard variant="container" style={styles.bankCard}>
          <View style={styles.bankRow}>
            <View style={styles.bankIcon}>
              <Ionicons name="business" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.bankTitleRow}>
                <Text variant="label">{wallet.bank.bank_name} •••• {wallet.bank.account_masked}</Text>
                {wallet.bank.verified ? (
                  <View style={styles.verifiedPill}>
                    <Text variant="caption" style={styles.verifiedText}>Verified</Text>
                  </View>
                ) : null}
              </View>
              <Text variant="caption" style={{ color: colors.textMuted }}>{wallet.bank.label}</Text>
            </View>
            <Ionicons name="pencil" size={16} color={colors.textMuted} />
          </View>
          <View style={styles.feeNote}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
            <Text variant="caption" style={{ color: colors.textMuted, flex: 1 }}>
              Standard {money(wallet.cashout_fee_cents)} IMPS gateway charge applies to immediate real-time cashouts.
            </Text>
          </View>
        </PartnerCard>

        <View style={styles.sectionHeader}>
          <View style={styles.txnHeaderLeft}>
            <Text variant="h3">Transaction History</Text>
            <View style={styles.countPill}><Text variant="caption" style={styles.countText}>{txns.length}</Text></View>
          </View>
          <Pressable style={styles.statementLink}>
            <Ionicons name="document-text-outline" size={14} color={colors.primary} />
            <Text variant="caption" style={{ color: colors.primary, fontWeight: '700' }}>Statement</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filterRow}>
            {FILTERS.map((f) => (
              <Pressable
                key={f.key}
                style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text variant="caption" style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {txns.map((txn) => {
          const st = statusStyle(txn.status);
          const isCredit = txn.amount_cents > 0;
          return (
            <PartnerCard key={txn.id} variant="lowest" style={styles.txnCard}>
              <View style={styles.txnRow}>
                <View style={[styles.txnIcon, { backgroundColor: isCredit ? colors.successContainer : '#FFF3E0' }]}>
                  <Ionicons name={txnIcon(txn.icon)} size={18} color={isCredit ? colors.secondary : '#E65100'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="label">{txn.title}</Text>
                  <Text variant="caption" style={{ color: colors.textMuted }}>{txn.time_label}</Text>
                  <Text variant="caption" style={{ color: colors.textMuted }}>{txn.subtitle}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text variant="label" style={{ color: isCredit ? colors.secondary : colors.text }}>
                    {isCredit ? '+' : ''}{money(Math.abs(txn.amount_cents))}
                  </Text>
                  <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                    <Text variant="caption" style={{ color: st.color, fontWeight: '800', fontSize: 9 }}>
                      {txn.status_label}
                    </Text>
                  </View>
                </View>
              </View>
            </PartnerCard>
          );
        })}

        <Button
          title="Download Detailed Tax & Statement (PDF)"
          variant="secondary"
          onPress={() => feedback.info('PDF statements will be available soon.', 'Coming soon')}
          style={{ marginTop: spacing.md }}
        />

        <View style={styles.securityRow}>
          <Ionicons name="shield-checkmark" size={14} color={colors.textMuted} />
          <Text variant="caption" style={{ color: colors.textMuted }}>
            Secured with RBI Compliant 256-bit Payout Rails
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    height: 56,
    gap: spacing.sm,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center',
  },
  headerAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.massive },
  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  balanceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontWeight: '700', letterSpacing: 0.5 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.secondaryFixed },
  liveText: { color: colors.onPrimary, fontWeight: '700', fontSize: 10 },
  balanceAmount: { color: colors.onPrimary, fontSize: 36, lineHeight: 42 },
  balanceSub: { color: 'rgba(255,255,255,0.75)' },
  subBalanceRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  subBalanceBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    padding: spacing.md,
  },
  subBalanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700' },
  subBalanceValue: { color: colors.onPrimary, marginVertical: 4 },
  subBalanceHint: { color: 'rgba(255,255,255,0.65)', fontSize: 10 },
  balanceActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  withdrawBtn: { flex: 1, backgroundColor: colors.surface, borderColor: colors.surface },
  swapBtn: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  processingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: '#FFF8E1',
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  processingLeft: { flex: 1, flexDirection: 'row', gap: spacing.sm },
  processingTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  processingBadge: { backgroundColor: '#FFE0B2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  processingBadgeText: { color: '#E65100', fontWeight: '800', fontSize: 9 },
  trackLink: { color: colors.primary, fontWeight: '700', marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  zeroHoldPill: { backgroundColor: colors.successContainer, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  zeroHoldText: { color: colors.secondary, fontWeight: '800', fontSize: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontWeight: '700' },
  chipTextActive: { color: colors.onPrimary },
  bankCard: { padding: spacing.md, gap: spacing.md },
  bankRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bankIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  bankTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  verifiedPill: { backgroundColor: colors.successContainer, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  verifiedText: { color: colors.secondary, fontWeight: '800', fontSize: 10 },
  feeNote: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  txnHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  countPill: { backgroundColor: colors.surfaceContainerHigh, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countText: { color: colors.textMuted, fontWeight: '700' },
  statementLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterScroll: { marginHorizontal: -spacing.lg },
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, backgroundColor: colors.surfaceContainer },
  filterChipActive: { backgroundColor: colors.primaryFixed, borderWidth: 1, borderColor: colors.primary },
  filterText: { color: colors.textMuted, fontWeight: '700' },
  filterTextActive: { color: colors.primary },
  txnCard: { padding: spacing.md },
  txnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  txnIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  securityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.lg, marginBottom: spacing.md },
});
