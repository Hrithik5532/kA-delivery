import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/auth-context';
import { PartnerCard } from '@/components/partner';
import { OtpInput } from '@/components/partner';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { ErrorState } from '@/components/ErrorState';
import { FeedbackBanner } from '@/components/FeedbackBanner';
import { colors, spacing } from '@/theme';

export default function RiderOtpScreen() {
  const router = useRouter();
  const { phone: phoneParam, dev: devParam } = useLocalSearchParams<{ phone?: string; dev?: string }>();
  const { loginRiderOtp, requestRiderOtp } = useAuth();
  const [phone] = useState(() => (phoneParam ?? '').replace(/\s/g, ''));
  // Only pre-fill when the backend handed back a dev code (development builds);
  // in production the partner types the code ops gave them.
  const [devCode, setDevCode] = useState(() => (devParam ?? '').slice(0, 4));
  const [code, setCode] = useState(devCode);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendSecs, setResendSecs] = useState(30);

  useEffect(() => {
    if (resendSecs <= 0) return;
    const t = setInterval(() => setResendSecs((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendSecs]);

  const masked = phone.length >= 4 ? `+91 ${phone.slice(0, 2)}***${phone.slice(-4)}` : phone;

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      await loginRiderOtp(phone, code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      const dev = await requestRiderOtp(phone);
      if (dev) {
        setDevCode(dev.slice(0, 4));
        setCode(dev.slice(0, 4));
      }
      setResendSecs(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend OTP');
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="arrow-back" onPress={() => router.back()} color={colors.text} />
        <Text variant="h3">Enter OTP</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.content}>
        <Text variant="bodySmall" style={{ color: colors.textMuted }}>
          Enter the 4-digit login code for <Text variant="label">{masked}</Text>
        </Text>
        {error ? <ErrorState message={error} variant="inline" title="Verification failed" /> : null}
        {devCode ? (
          <FeedbackBanner severity="info" message={`Development code: ${devCode}`} style={{ marginTop: spacing.md }} />
        ) : (
          <FeedbackBanner
            severity="info"
            title="Don't have a code?"
            message="Ask the KA Delivery operations team. They can send you a one-time login code on call or WhatsApp."
            style={{ marginTop: spacing.md }}
          />
        )}
        <PartnerCard variant="lowest" style={{ marginTop: spacing.lg }}>
          <OtpInput value={code} onChange={setCode} error={error} />
          <View style={styles.resendRow}>
            <Ionicons name="time" size={16} color={colors.textMuted} />
            {resendSecs > 0 ? (
              <Text variant="caption" style={{ color: colors.textMuted }}>Resend OTP in {resendSecs}s</Text>
            ) : (
              <Pressable onPress={resend}><Text variant="caption" style={{ color: colors.primary }}>Resend OTP</Text></Pressable>
            )}
          </View>
          <Button title="Verify" onPress={verify} loading={busy} disabled={code.length < 4} style={{ marginTop: spacing.md }} />
        </PartnerCard>
        <Pressable onPress={() => router.push('/(rider)/help' as never)} style={styles.helpRow}>
          <Ionicons name="headset" size={16} color={colors.secondary} />
          <Text variant="caption" style={{ color: colors.textMuted }}>Having trouble? Contact Support</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md },
  content: { padding: spacing.lg },
  resendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, justifyContent: 'center', marginTop: spacing.lg },
  helpRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, justifyContent: 'center', marginTop: spacing.xl },
});
