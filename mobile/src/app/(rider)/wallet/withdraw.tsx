import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '@/api/client';
import type { WalletDetails, WalletPayoutAccount } from '@/api/types';
import { ErrorState } from '@/components/ErrorState';
import { useFeedback } from '@/components/FeedbackProvider';
import { Loading } from '@/components/Loading';
import { PartnerCard } from '@/components/partner';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { colors, money, spacing } from '@/theme';

function accountIcon(name: string): keyof typeof Ionicons.glyphMap {
  if (name === 'flash') return 'flash';
  return 'business';
}

function parseAmountInput(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const rupees = parseFloat(cleaned);
  if (!Number.isFinite(rupees) || rupees <= 0) return 0;
  return Math.round(rupees * 100);
}

function formatAmountInput(cents: number): string {
  if (cents <= 0) return '';
  const rupees = cents / 100;
  return rupees % 1 === 0 ? String(rupees) : rupees.toFixed(2);
}

function AccountCard({
  account,
  selected,
  onSelect,
}: {
  account: WalletPayoutAccount;
  selected: boolean;
  onSelect: () => void;
}) {
  const masked = account.type === 'upi'
    ? account.account_masked
    : `•••• ${account.account_masked}`;

  return (
    <Pressable onPress={onSelect}>
      <PartnerCard
        variant="container"
        style={[styles.accountCard, selected && styles.accountCardSelected]}
      >
        <View style={styles.accountRow}>
          <View style={[styles.accountIcon, selected && styles.accountIconSelected]}>
            <Ionicons
              name={accountIcon(account.icon)}
              size={20}
              color={selected ? colors.onPrimary : colors.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.accountTitleRow}>
              <Text variant="label">{account.label}</Text>
              {account.is_primary ? (
                <View style={styles.primaryPill}>
                  <Text variant="caption" style={styles.primaryText}>Primary</Text>
                </View>
              ) : null}
              {account.verified ? (
                <View style={styles.verifiedPill}>
                  <Text variant="caption" style={styles.verifiedText}>Verified</Text>
                </View>
              ) : null}
            </View>
            <Text variant="caption" style={{ color: colors.textMuted }}>{account.holder_name}</Text>
            <Text variant="bodySmall" style={{ color: colors.textMuted, marginTop: 2 }}>{masked}</Text>
            <Text variant="caption" style={styles.etaText}>{account.eta_label}</Text>
          </View>
          <View style={[styles.radio, selected && styles.radioSelected]}>
            {selected ? <View style={styles.radioDot} /> : null}
          </View>
        </View>
      </PartnerCard>
    </Pressable>
  );
}

export default function WalletWithdraw() {
  const router = useRouter();
  const feedback = useFeedback();
  const params = useLocalSearchParams<{ amount?: string }>();

  const [wallet, setWallet] = useState<WalletDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [amountCents, setAmountCents] = useState(0);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState('bank_primary');

  const load = useCallback(async () => {
    try {
      const w = await api.riderWallet();
      setWallet(w);
      setError(null);
      const primary = w.payout_accounts.find((a) => a.is_primary)?.id ?? w.payout_accounts[0]?.id;
      if (primary) setAccountId(primary);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load wallet');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!params.amount) return;
    const prefill = parseInt(params.amount, 10);
    if (prefill > 0) {
      setAmountCents(prefill);
      setAmountInput(formatAmountInput(prefill));
    }
  }, [params.amount]);

  const selectedAccount = useMemo(
    () => wallet?.payout_accounts.find((a) => a.id === accountId) ?? wallet?.payout_accounts[0] ?? null,
    [wallet, accountId],
  );

  const feeCents = wallet?.cashout_fee_cents ?? 0;
  const receiveCents = Math.max(0, amountCents - feeCents);

  const validateAmount = useCallback((cents: number): string | null => {
    if (!wallet) return null;
    if (cents <= 0) return 'Enter a valid withdrawal amount';
    if (cents <= feeCents) return `Amount must be more than ${money(feeCents)} fee`;
    if (cents < wallet.min_withdraw_cents) return `Minimum withdrawal is ${money(wallet.min_withdraw_cents)}`;
    if (cents > wallet.available_balance_cents) return 'Amount exceeds available balance';
    return null;
  }, [wallet, feeCents]);

  const onAmountChange = (value: string) => {
    setAmountInput(value);
    const cents = parseAmountInput(value);
    setAmountCents(cents);
    setAmountError(validateAmount(cents));
  };

  const selectQuickAmount = (cents: number) => {
    setAmountCents(cents);
    setAmountInput(formatAmountInput(cents));
    setAmountError(validateAmount(cents));
  };

  const confirmWithdraw = async () => {
    if (!wallet || !selectedAccount) return;
    const validation = validateAmount(amountCents);
    if (validation) {
      setAmountError(validation);
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.riderWalletWithdraw(amountCents, selectedAccount.id);
      feedback.success(result.message, 'Withdrawal initiated');
      router.replace('/(rider)/wallet' as never);
    } catch (err) {
      feedback.error(err instanceof ApiError ? err.message : 'Withdrawal failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !wallet) {
    return (
      <SafeAreaView style={styles.screen}>
        <Loading label="Loading withdrawal details…" />
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

  const quickAmounts = [...wallet.quick_amounts_cents, wallet.available_balance_cents];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="arrow-back" onPress={() => router.back()} color={colors.text} />
        <Text variant="h3" style={{ flex: 1, textAlign: 'center' }}>Withdraw Money</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <PartnerCard variant="lowest" style={styles.balanceBanner}>
          <Text variant="caption" style={styles.balanceLabel}>AVAILABLE FOR CASHOUT</Text>
          <Text variant="display" style={styles.balanceValue}>{money(wallet.available_balance_cents)}</Text>
          <Text variant="caption" style={{ color: colors.textMuted }}>
            Locked in escrow: {money(wallet.locked_balance_cents)}
          </Text>
        </PartnerCard>

        <Text variant="h3" style={styles.sectionTitle}>Enter Amount</Text>
        <TextField
          label="Withdrawal amount (₹)"
          value={amountInput}
          onChangeText={onAmountChange}
          keyboardType="decimal-pad"
          placeholder="e.g. 500"
          error={amountError}
        />
        <Pressable onPress={() => selectQuickAmount(wallet.available_balance_cents)}>
          <Text variant="caption" style={styles.useAllLink}>Use full available balance</Text>
        </Pressable>

        <View style={styles.chipRow}>
          {quickAmounts.map((amt, i) => {
            const isAll = i === quickAmounts.length - 1;
            const label = isAll ? `All ${money(amt)}` : money(amt);
            const active = amountCents === amt;
            return (
              <Pressable
                key={String(amt)}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => selectQuickAmount(amt)}
              >
                <Text variant="caption" style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text variant="h3" style={styles.sectionTitle}>Choose Account</Text>
        <Text variant="caption" style={styles.sectionSub}>Select where you want to receive the payout</Text>
        {wallet.payout_accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            selected={account.id === (selectedAccount?.id ?? accountId)}
            onSelect={() => setAccountId(account.id)}
          />
        ))}

        <Text variant="h3" style={styles.sectionTitle}>Withdrawal Summary</Text>
        <PartnerCard variant="container" style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text variant="bodySmall" style={{ color: colors.textMuted }}>Withdrawal amount</Text>
            <Text variant="label">{money(amountCents || 0)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text variant="bodySmall" style={{ color: colors.textMuted }}>IMPS / gateway fee</Text>
            <Text variant="label" style={{ color: colors.error }}>-{money(feeCents)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text variant="label">You will receive</Text>
            <Text variant="h3" style={{ color: colors.secondary }}>{money(receiveCents)}</Text>
          </View>
          {selectedAccount ? (
            <>
              <View style={styles.summaryRow}>
                <Text variant="bodySmall" style={{ color: colors.textMuted }}>Payout method</Text>
                <Text variant="bodySmall">{selectedAccount.type === 'upi' ? 'UPI Instant' : 'Bank IMPS'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text variant="bodySmall" style={{ color: colors.textMuted }}>Destination</Text>
                <Text variant="bodySmall" style={{ flex: 1, textAlign: 'right' }}>
                  {selectedAccount.label} • {selectedAccount.account_masked}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text variant="bodySmall" style={{ color: colors.textMuted }}>Estimated arrival</Text>
                <Text variant="bodySmall">{selectedAccount.eta_label}</Text>
              </View>
            </>
          ) : null}
        </PartnerCard>

        <View style={styles.noteBox}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
          <Text variant="caption" style={{ color: colors.textMuted, flex: 1 }}>
            Withdrawals are processed on RBI-compliant payout rails. You will receive an SMS once the transfer is initiated.
          </Text>
        </View>

        <Button
          title={`Confirm Withdrawal • ${money(receiveCents)}`}
          onPress={confirmWithdraw}
          loading={submitting}
          disabled={!amountCents || Boolean(amountError) || !selectedAccount}
          style={{ marginTop: spacing.md }}
        />
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
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.massive },
  balanceBanner: { padding: spacing.lg, gap: spacing.xs },
  balanceLabel: { color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5 },
  balanceValue: { fontSize: 32, lineHeight: 38 },
  sectionTitle: { marginTop: spacing.sm },
  sectionSub: { color: colors.textMuted, marginTop: -spacing.sm, marginBottom: spacing.xs },
  useAllLink: { color: colors.primary, fontWeight: '700', marginTop: -spacing.sm, marginBottom: spacing.sm },
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
  accountCard: { padding: spacing.md, marginBottom: spacing.sm },
  accountCardSelected: { borderWidth: 2, borderColor: colors.primary },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  accountIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountIconSelected: { backgroundColor: colors.primary },
  accountTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  primaryPill: { backgroundColor: colors.surfaceContainerHigh, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  primaryText: { color: colors.textMuted, fontWeight: '800', fontSize: 9 },
  verifiedPill: { backgroundColor: colors.successContainer, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  verifiedText: { color: colors.secondary, fontWeight: '800', fontSize: 9 },
  etaText: { color: colors.primary, marginTop: 4, fontWeight: '600' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  summaryCard: { padding: spacing.lg, gap: spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  divider: { height: 1, backgroundColor: colors.borderLight },
  noteBox: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
});
