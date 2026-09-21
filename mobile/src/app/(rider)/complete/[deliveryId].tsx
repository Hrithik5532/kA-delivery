import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '@/api/client';
import type { Batch, DeliveryCompletion, DeliveryHandover, DeliveryStop } from '@/api/types';
import { ErrorState } from '@/components/ErrorState';
import { useFeedback } from '@/components/FeedbackProvider';
import { Loading } from '@/components/Loading';
import { OtpInput, PartnerCard } from '@/components/partner';
import { Button } from '@/components/ui/Button';
import { FlowScreenHeader } from '@/components/ui/FlowScreenHeader';
import { useTabBarHeight } from '@/hooks/useTabBarStyle';
import { Text } from '@/components/ui/Text';
import { config } from '@/config';
import { colors, money, spacing } from '@/theme';

function PayoutLine({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  amount,
  badge,
  badgeTone,
  highlight,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  amount: string;
  badge?: string;
  badgeTone?: 'surge' | 'tip';
  highlight?: boolean;
}) {
  return (
    <View style={[styles.payoutLine, highlight && styles.payoutLineHighlight]}>
      <View style={[styles.payoutLineIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.payoutLineTitleRow}>
          <Text variant="label">{title}</Text>
          {badge ? (
            <View style={[styles.lineBadge, badgeTone === 'surge' ? styles.surgeBadge : styles.tipBadge]}>
              <Text variant="caption" style={badgeTone === 'surge' ? styles.surgeBadgeText : styles.tipBadgeText}>
                {badge}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="caption" style={{ color: colors.textMuted }}>{subtitle}</Text>
      </View>
      <Text variant="label" style={[styles.payoutAmount, badgeTone === 'tip' && { color: colors.secondary }]}>
        {amount}
      </Text>
    </View>
  );
}

function SuccessScreen({
  data,
  onHome,
  onContinue,
  onIssue,
}: {
  data: DeliveryCompletion;
  onHome: () => void;
  onContinue: () => void;
  onIssue: () => void;
}) {
  const payout = data.payout;
  const tabBarHeight = useTabBarHeight();
  return (
    <View style={styles.screen}>
      <FlowScreenHeader title="Delivery Completed" showLogo onBack={onHome} />

      <ScrollView contentContainerStyle={[styles.successContent, { paddingBottom: tabBarHeight + spacing.xl }]}>
        <View style={styles.successHero}>
          <View style={styles.successRingOuter}>
            <View style={styles.successRingInner}>
              <Ionicons name="checkmark" size={40} color={colors.onSecondary} />
            </View>
          </View>
          <View style={styles.confettiLeft}><Text style={styles.confetti}>🎉</Text></View>
          <View style={styles.confettiRight}><Text style={styles.confetti}>✨</Text></View>
        </View>

        <View style={styles.confirmedBadge}>
          <View style={styles.confirmedDot} />
          <Text variant="caption" style={styles.confirmedText}>{data.status_label}</Text>
        </View>

        <Text variant="h1" style={styles.successTitle}>Delivery Completed!</Text>
        <Text variant="bodySmall" style={styles.successSub}>
          {data.ticket_ref} delivered successfully
        </Text>

        <PartnerCard variant="lowest" style={styles.earnedCard}>
          <View style={styles.earnedHeader}>
            <Ionicons name="wallet" size={20} color={colors.secondary} />
            <Text variant="label" style={{ color: colors.textMuted }}>Earned This Trip</Text>
          </View>
          <Text variant="display" style={styles.earnedAmount}>{money(data.total_earned_cents)}</Text>
          {data.wallet_credited ? (
            <View style={styles.walletNote}>
              <Ionicons name="checkmark-circle" size={14} color={colors.secondary} />
              <Text variant="caption" style={styles.walletNoteText}>Added to your instant wallet balance</Text>
            </View>
          ) : null}
        </PartnerCard>

        <View style={styles.statsRow}>
          <PartnerCard variant="container" style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text variant="caption" style={styles.statLabel}>TIME SPENT</Text>
              <Ionicons name="time-outline" size={16} color={colors.primary} />
            </View>
            <Text variant="h2">{data.active_minutes} mins</Text>
            {data.minutes_faster > 0 ? (
              <Text variant="caption" style={styles.fasterText}>⚡ {data.minutes_faster}m faster!</Text>
            ) : null}
          </PartnerCard>
          <PartnerCard variant="container" style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text variant="caption" style={styles.statLabel}>RIDER RATING</Text>
              <Ionicons name="star" size={16} color={colors.tertiary} />
            </View>
            <Text variant="h2">{data.rider_rating.toFixed(1)} ⭐</Text>
            <Text variant="caption" style={{ color: colors.textMuted }}>{data.rating_comment}</Text>
          </PartnerCard>
        </View>

        <PartnerCard variant="lowest" style={styles.breakdownCard}>
          <View style={styles.breakdownHeader}>
            <Text variant="h3">Payout Breakdown</Text>
            <View style={styles.completedPill}>
              <Text variant="caption" style={styles.completedPillText}>Completed</Text>
            </View>
          </View>

          <PayoutLine
            icon="bicycle"
            iconColor={colors.primary}
            iconBg={colors.primaryFixed}
            title="Base fare"
            subtitle={payout.base_fare_label}
            amount={money(payout.base_fare_cents)}
          />
          <PayoutLine
            icon="navigate"
            iconColor={colors.secondary}
            iconBg={colors.secondaryFixed}
            title="Distance pay"
            subtitle={payout.distance_label}
            amount={money(payout.distance_pay_cents)}
          />
          {payout.surge_bonus_cents > 0 ? (
            <PayoutLine
              icon="flame"
              iconColor="#E65100"
              iconBg="#FFF0E0"
              title="Surge peak bonus"
              subtitle={payout.surge_zone ?? 'Peak demand zone'}
              amount={`+${money(payout.surge_bonus_cents)}`}
              badge={payout.surge_label ?? undefined}
              badgeTone="surge"
              highlight
            />
          ) : null}
          {payout.tip_cents > 0 ? (
            <PayoutLine
              icon="heart"
              iconColor={colors.secondary}
              iconBg={colors.successContainer}
              title="Customer Tip"
              subtitle={`Direct from ${payout.tip_customer}`}
              amount={`+${money(payout.tip_cents)}`}
              badge="100% yours"
              badgeTone="tip"
            />
          ) : null}

          <View style={styles.breakdownTotal}>
            <View>
              <Text variant="caption" style={{ color: colors.textMuted }}>Net trip earnings</Text>
              <Text variant="label" style={{ fontWeight: '800' }}>Total Credited</Text>
            </View>
            <Text variant="h2" style={{ color: colors.primary }}>{money(payout.total_cents)}</Text>
          </View>
        </PartnerCard>

        <PartnerCard variant="container" style={styles.orderBar}>
          <View style={styles.orderThumb}>
            <Ionicons name="restaurant" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.orderNameRow}>
              <Text variant="label" numberOfLines={1}>{data.mess_name}</Text>
              {data.mess_verified ? (
                <Ionicons name="checkmark-circle" size={14} color={colors.secondary} />
              ) : null}
            </View>
            <Text variant="caption" style={{ color: colors.textMuted }} numberOfLines={1}>
              Delivered to: {data.dropoff_area}
            </Text>
          </View>
          <Ionicons name="receipt-outline" size={20} color={colors.textMuted} />
        </PartnerCard>

        {data.pending_stops > 0 ? (
          <Button
            title={`Continue Next Delivery (${data.pending_stops} left)`}
            onPress={onContinue}
            style={{ marginTop: spacing.lg }}
          />
        ) : null}
        <Button
          title="Back to Home / Go Online →"
          variant={data.pending_stops > 0 ? 'secondary' : 'primary'}
          onPress={onHome}
          style={{ marginTop: spacing.md }}
        />
        <Pressable style={styles.issueBtn} onPress={onIssue}>
          <Ionicons name="help-circle-outline" size={16} color={colors.textMuted} />
          <Text variant="caption" style={styles.issueText}>Issue with this order?</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}


function HandoverForm({
  handover,
  stop,
  otp,
  setOtp,
  otpVerified,
  onVerify,
  onAddPhoto,
  onComplete,
  onReportIssue,
  verifying,
  completing,
  uploading,
  error,
  photoName,
}: {
  handover: DeliveryHandover;
  stop: DeliveryStop;
  otp: string;
  setOtp: (v: string) => void;
  otpVerified: boolean;
  onVerify: () => void;
  onAddPhoto: () => void;
  onComplete: () => void;
  onReportIssue: () => void;
  verifying: boolean;
  completing: boolean;
  uploading: boolean;
  error: string | null;
  photoName: string | null;
}) {
  const tabBarHeight = useTabBarHeight();
  return (
    <View style={styles.screen}>
      <FlowScreenHeader title="Complete Delivery" showLogo />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.xl }]}>
        <View style={styles.orderStatusRow}>
          <View style={styles.orderStatusLeft}>
            <View style={styles.orderStatusIcon}>
              <Ionicons name="bicycle" size={20} color={colors.onPrimaryContainer} />
            </View>
            <View>
              <Text variant="label" style={{ fontWeight: '700' }}>{handover.ticket_ref}</Text>
              <Text variant="caption" style={{ color: colors.textMuted }}>Drop-off verification required</Text>
            </View>
          </View>
          <View style={styles.inProgressPill}>
            <Text variant="caption" style={styles.inProgressText}>{handover.phase_label}</Text>
          </View>
        </View>

        <PartnerCard variant="container" style={styles.instructionCard}>
          <View style={styles.instructionRow}>
            <View style={styles.instructionIcon}>
              <Ionicons name="document-text-outline" size={20} color={colors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.instructionTitleRow}>
                <Text variant="label">{handover.handover_type_label}</Text>
                <Text variant="caption" style={styles.priorityDot}> • </Text>
                <Text variant="caption" style={styles.priorityNote}>{handover.priority_note}</Text>
              </View>
              <Text variant="bodySmall" style={{ color: colors.textMuted, marginTop: 4 }}>
                {handover.instructions}
              </Text>
            </View>
          </View>
        </PartnerCard>

        <PartnerCard variant="lowest" style={styles.otpCard}>
          <View style={styles.otpIconCircle}>
            <Text style={styles.otpIconText}>123</Text>
          </View>
          <Text variant="h2" style={styles.otpTitle}>Ask Customer for 4-Digit Delivery OTP</Text>
          <Text variant="caption" style={styles.otpSub}>
            Customer received this code via SMS and app notification
          </Text>
          <OtpInput value={otp} onChange={setOtp} error={error && !otpVerified ? error : null} />
          <Button
            title="Verify OTP"
            onPress={onVerify}
            loading={verifying}
            disabled={otp.length < 4 || otpVerified}
            style={{ marginTop: spacing.lg }}
          />
          {otpVerified ? (
            <View style={styles.verifiedRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.secondary} />
              <Text variant="caption" style={{ color: colors.secondary, fontWeight: '700' }}>OTP verified</Text>
            </View>
          ) : null}
        </PartnerCard>

        <PartnerCard variant="container" style={styles.photoCard}>
          <View style={styles.photoRow}>
            <View style={styles.photoIcon}>
              <Ionicons name="camera-outline" size={20} color={colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label">Take Delivery Photo</Text>
              <Text variant="caption" style={{ color: colors.textMuted }}>
                {photoName ? photoName : 'Recommended for doorstep leave-behind'}
              </Text>
            </View>
            <Pressable style={styles.addPhotoBtn} onPress={onAddPhoto} disabled={uploading}>
              <Ionicons name="camera" size={16} color={colors.text} />
              <Text variant="caption" style={{ fontWeight: '700' }}>{uploading ? '…' : 'Add'}</Text>
            </Pressable>
          </View>
        </PartnerCard>

        <Pressable
          style={[styles.deliverBtn, !otpVerified && styles.deliverBtnDisabled]}
          onPress={onComplete}
          disabled={!otpVerified || completing}
        >
          <Ionicons name="checkmark-circle" size={22} color={colors.onPrimary} />
          <Text variant="button" style={styles.deliverBtnText}>{completing ? 'Completing…' : 'Mark as Delivered'}</Text>
        </Pressable>

        <Pressable style={styles.reportBtn} onPress={onReportIssue}>
          <Ionicons name="help-circle-outline" size={16} color={colors.textMuted} />
          <Text variant="caption" style={styles.reportText}>Customer unable to share OTP? Report Delivery Issue</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

export default function CompleteDelivery() {
  const { deliveryId } = useLocalSearchParams<{ deliveryId: string }>();
  const router = useRouter();
  const feedback = useFeedback();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [handover, setHandover] = useState<DeliveryHandover | null>(null);
  const [otp, setOtp] = useState(config.defaultOtp);
  const [otpVerified, setOtpVerified] = useState(false);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<DeliveryCompletion | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const stop = batch?.stops.find((s) => s.delivery_id === Number(deliveryId));

  useEffect(() => {
    const id = Number(deliveryId);
    void (async () => {
      try {
        const b = await api.riderActive();
        setBatch(b);
        const activeStop = b?.stops.find((s) => s.delivery_id === id);
        if (activeStop?.status === 'delivered') {
          setCompletion(await api.deliveryCompletion(id));
        } else if (b && activeStop) {
          const h = await api.deliveryHandover(id);
          setHandover(h);
          setOtpVerified(h.otp_verified);
          setPhotoName(h.photo_name);
        } else if (!b) {
          try {
            setCompletion(await api.deliveryCompletion(id));
          } catch {
            // not yet completed
          }
        }
        setLoadError(null);
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : 'Could not load delivery');
      }
    })();
  }, [deliveryId]);

  const verifyOtp = async () => {
    if (!stop || otp.length < 4) return;
    setVerifying(true);
    setError(null);
    try {
      const result = await api.verifyDeliveryOtp(stop.delivery_id, otp);
      if (result.verified) {
        setOtpVerified(true);
        feedback.success(result.message, 'OTP verified');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'OTP verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const addPhoto = async () => {
    if (!stop) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (lib.status !== 'granted') {
        feedback.warning('Allow camera or photo access to attach proof.', 'Permission needed');
        return;
      }
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const uploaded = await api.uploadDeliveryPhoto(stop.delivery_id, {
        uri: asset.uri,
        name: asset.fileName ?? 'delivery.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
      setPhotoName(uploaded.photo_name);
      feedback.success('Delivery photo attached.', 'Photo added');
    } catch (err) {
      feedback.error(err instanceof ApiError ? err.message : 'Could not upload photo');
    } finally {
      setUploading(false);
    }
  };

  const markDelivered = async () => {
    if (!stop || !otpVerified) return;
    setCompleting(true);
    setError(null);
    try {
      const result = await api.complete(stop.delivery_id, otp);
      setCompletion(result);
      feedback.success(`${result.ticket_ref} delivered successfully.`, 'Delivery completed');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not complete delivery');
    } finally {
      setCompleting(false);
    }
  };

  if (completion) {
    return (
      <SuccessScreen
        data={completion}
        onHome={() => router.replace('/(rider)' as never)}
        onContinue={() => router.replace('/(rider)/active' as never)}
        onIssue={() => router.push(`/(rider)/help?order_id=${completion.order_id}` as never)}
      />
    );
  }

  if (!batch && !loadError) return <Loading label="Loading delivery…" />;
  if (!batch && loadError) {
    return <ErrorState message={loadError} variant="page" onRetry={() => api.riderActive().then(setBatch)} />;
  }
  if (!batch) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text variant="h3" style={{ padding: spacing.lg }}>Delivery not found</Text>
        <Button title="Back to Home" onPress={() => router.replace('/(rider)' as never)} style={{ marginHorizontal: spacing.lg }} />
      </SafeAreaView>
    );
  }
  if (!stop) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text variant="h3" style={{ padding: spacing.lg }}>Delivery not found</Text>
        <Button title="Back" onPress={() => router.back()} style={{ marginHorizontal: spacing.lg }} />
      </SafeAreaView>
    );
  }

  if (!handover) return <Loading label="Loading handover…" />;

  return (
    <HandoverForm
      handover={handover}
      stop={stop}
      otp={otp}
      setOtp={setOtp}
      otpVerified={otpVerified}
      onVerify={verifyOtp}
      onAddPhoto={addPhoto}
      onComplete={markDelivered}
      onReportIssue={() => router.push(`/(rider)/help?order_id=${stop.order_id}` as never)}
      verifying={verifying}
      completing={completing}
      uploading={uploading}
      error={error}
      photoName={photoName}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    height: 56,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.massive },
  successContent: { padding: spacing.lg, paddingBottom: spacing.massive },
  successHero: { alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.md, position: 'relative' },
  successRingOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: colors.secondaryFixed,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successRingInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiLeft: { position: 'absolute', left: 40, top: 20 },
  confettiRight: { position: 'absolute', right: 40, top: 30 },
  confetti: { fontSize: 22 },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: colors.successContainer,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: spacing.sm,
  },
  confirmedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.secondary },
  confirmedText: { color: colors.secondary, fontWeight: '800', letterSpacing: 0.5 },
  successTitle: { textAlign: 'center' },
  successSub: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.lg },
  earnedCard: { padding: spacing.lg, borderWidth: 1, borderColor: colors.primaryFixed },
  earnedHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  earnedAmount: { color: colors.primary, fontSize: 36, lineHeight: 42 },
  walletNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successContainer,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 10,
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  walletNoteText: { color: colors.secondary, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: { flex: 1, padding: spacing.md },
  statHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  statLabel: { color: colors.textMuted, fontWeight: '700', letterSpacing: 0.4, fontSize: 10 },
  fasterText: { color: colors.secondary, fontWeight: '700', marginTop: 4 },
  breakdownCard: { padding: spacing.md, gap: spacing.sm },
  breakdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  completedPill: { backgroundColor: colors.surfaceContainerHigh, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  completedPillText: { color: colors.textMuted, fontWeight: '700', fontSize: 10 },
  payoutLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  payoutLineHighlight: { backgroundColor: '#FFF8F0', borderRadius: 12, paddingHorizontal: spacing.sm, marginHorizontal: -spacing.sm },
  payoutLineIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  payoutLineTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  lineBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  surgeBadge: { backgroundColor: '#FFE0B2' },
  surgeBadgeText: { color: '#E65100', fontWeight: '800', fontSize: 10 },
  tipBadge: { backgroundColor: colors.successContainer },
  tipBadgeText: { color: colors.secondary, fontWeight: '800', fontSize: 10 },
  payoutAmount: { fontWeight: '800' },
  breakdownTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primaryFixed,
    padding: spacing.md,
    borderRadius: 12,
    marginTop: spacing.sm,
  },
  orderBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  orderThumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  issueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.lg, paddingVertical: spacing.md },
  issueText: { color: colors.textMuted, fontWeight: '600' },

  orderStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  orderStatusLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  orderStatusIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  inProgressPill: { backgroundColor: colors.secondaryContainer, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 20 },
  inProgressText: { color: colors.onSecondaryContainer, fontWeight: '700' },
  deliverBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: '#5B3DF5', borderRadius: 14, paddingVertical: spacing.md + 2, marginTop: spacing.md },
  deliverBtnDisabled: { opacity: 0.5 },
  deliverBtnText: { color: colors.onPrimary, fontWeight: '700' },
  orderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderRowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.successContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handoverPill: { backgroundColor: colors.primaryFixed, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  handoverPillText: { color: colors.primary, fontWeight: '800', letterSpacing: 0.5 },
  instructionCard: { padding: spacing.md },
  instructionRow: { flexDirection: 'row', gap: spacing.md },
  instructionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  priorityDot: { color: colors.secondary },
  priorityNote: { color: colors.secondary, fontWeight: '700' },
  otpCard: { padding: spacing.lg, alignItems: 'center' },
  otpIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  otpIconText: { color: colors.primary, fontWeight: '800', fontSize: 18 },
  otpTitle: { textAlign: 'center', marginBottom: spacing.xs },
  otpSub: { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  photoCard: { padding: spacing.md },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  photoIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  reportText: { color: colors.textMuted, fontWeight: '600', textAlign: 'center' },
});
