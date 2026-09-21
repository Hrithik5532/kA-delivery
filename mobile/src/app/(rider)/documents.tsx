/** Partner verification — status, documents, resubmit. */
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '@/api/client';
import type { ApprovalStatus, RiderDocument, VerificationStatus } from '@/api/types';
import { ErrorState } from '@/components/ErrorState';
import { FeedbackBanner } from '@/components/FeedbackBanner';
import { useAuth } from '@/auth/auth-context';
import { useFeedback } from '@/components/FeedbackProvider';
import { Loading } from '@/components/Loading';
import { PartnerCard } from '@/components/partner';
import { Button } from '@/components/ui/Button';
import { FlowScreenHeader } from '@/components/ui/FlowScreenHeader';
import { Text } from '@/components/ui/Text';
import { formatRelativeAgo } from '@/lib/format-time';
import { colors, radius, spacing } from '@/theme';

type DocKey = 'id_proof' | 'license' | 'vehicle_rc' | 'bank_passbook';

const DOC_TYPES: {
  key: DocKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
}[] = [
  { key: 'id_proof', label: 'Aadhaar Card', icon: 'finger-print', iconBg: colors.primaryFixed, iconColor: colors.primary },
  { key: 'license', label: 'Driving License', icon: 'card', iconBg: colors.secondarySoft, iconColor: colors.secondary },
  { key: 'vehicle_rc', label: 'Vehicle Registration', icon: 'bicycle', iconBg: colors.accentSoft, iconColor: colors.accentDark },
  { key: 'bank_passbook', label: 'Bank Account Details', icon: 'wallet', iconBg: colors.infoSoft, iconColor: colors.info },
];

const DOC_META = new Map(DOC_TYPES.map((d) => [d.key, d]));

const STATUS_VIEW_STATUSES: ApprovalStatus[] = ['submitted', 'under_review', 'pending', 'approved'];
const EDIT_MODE_STATUSES: ApprovalStatus[] = ['draft', 'needs_correction', 'rejected'];

function docSubtitle(doc: RiderDocument): string {
  if (doc.doc_type === 'id_proof' && doc.status === 'accepted') {
    return 'ID Verified via DigiLocker';
  }
  return doc.original_name;
}

function statusBadge(status: string): { label: string; bg: string; text: string } {
  if (status === 'accepted') {
    return { label: 'APPROVED', bg: colors.secondarySoft, text: colors.secondary };
  }
  if (status === 'rejected') {
    return { label: 'REJECTED', bg: colors.dangerSoft, text: colors.danger };
  }
  return { label: 'UNDER REVIEW', bg: colors.warningSoft, text: colors.warning };
}

function StatusPill({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <View style={[styles.statusPill, { backgroundColor: bg }]}>
      <Text variant="caption" style={{ color: text, fontWeight: '700', letterSpacing: 0.4 }}>{label}</Text>
    </View>
  );
}

function DocumentRow({
  doc,
  showBadge = true,
  onReplace,
  replacing = false,
}: {
  doc: RiderDocument;
  showBadge?: boolean;
  onReplace?: () => void;
  replacing?: boolean;
}) {
  const meta = DOC_META.get(doc.doc_type as DocKey) ?? {
    label: doc.doc_type,
    icon: 'document-text' as keyof typeof Ionicons.glyphMap,
    iconBg: colors.surfaceContainer,
    iconColor: colors.textMuted,
  };
  const badge = statusBadge(doc.status);

  return (
    <PartnerCard style={styles.docCard}>
      <View style={styles.docRow}>
        <View style={[styles.docIcon, { backgroundColor: meta.iconBg }]}>
          <Ionicons name={meta.icon} size={20} color={meta.iconColor} />
        </View>
        <View style={styles.docBody}>
          <Text variant="label">{meta.label}</Text>
          <Text variant="caption" style={{ color: colors.textMuted, marginTop: 2 }}>
            {docSubtitle(doc)}
          </Text>
          {doc.uploaded_at ? (
            <Text variant="caption" style={{ color: colors.textLight, marginTop: 2 }}>
              Uploaded {formatRelativeAgo(doc.uploaded_at)}
            </Text>
          ) : null}
        </View>
        {showBadge ? (
          <StatusPill {...badge} />
        ) : onReplace ? (
          <Button title="Replace" variant="ghost" loading={replacing} onPress={onReplace} fullWidth={false} />
        ) : null}
      </View>
    </PartnerCard>
  );
}

export default function Documents() {
  const router = useRouter();
  const { refreshSession, isApproved, logout } = useAuth();
  const feedback = useFeedback();
  const [v, setV] = useState<VerificationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.verification();
      setV(data);
      setError(null);
      await refreshSession();
      if (data.approval_status === 'approved' && data.can_go_online) {
        router.replace('/(rider)/' as never);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load verification');
    }
  }, [refreshSession, router]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const pickAndUpload = async (docType: DocKey, autoResubmit = false) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      feedback.warning('Allow photo access to upload a document.', 'Permission needed');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setBusy(docType);
    setError(null);
    try {
      await api.uploadDocument(docType, {
        uri: asset.uri,
        name: asset.fileName ?? `${docType}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      });
      if (autoResubmit) {
        await api.resubmit();
        feedback.success('Document uploaded and resubmitted for review.', 'Submitted');
      } else {
        feedback.success('Document uploaded successfully.', 'Uploaded');
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setBusy(null);
    }
  };

  const resubmit = async () => {
    setBusy('resubmit');
    setError(null);
    try {
      await api.resubmit();
      await load();
      feedback.success('Your application was resubmitted for review.', 'Submitted');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resubmit');
    } finally {
      setBusy(null);
    }
  };

  const onEditDetails = () => {
    router.push('/(auth)/register-rider' as never);
  };

  const goToLogin = async () => {
    await logout();
    router.replace('/(auth)/login' as never);
  };

  if (!v) {
    return (
      <SafeAreaView style={styles.screen} edges={['bottom']}>
        <FlowScreenHeader
          title="Verification Status"
          showLogo
          showBack
          onBack={isApproved ? undefined : () => { void goToLogin(); }}
        />
        <Loading label="Loading verification…" />
      </SafeAreaView>
    );
  }

  const isEditMode = EDIT_MODE_STATUSES.includes(v.approval_status);
  const showHero = STATUS_VIEW_STATUSES.includes(v.approval_status) || v.documents.length > 0;
  const uploadedByType = new Map(v.documents.map((d) => [d.doc_type, d]));
  const missingDocs = DOC_TYPES.filter((d) => !uploadedByType.has(d.key));
  const uploadedDocs = v.documents.filter((d) => DOC_META.has(d.doc_type as DocKey));

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <FlowScreenHeader
          title="Verification Status"
          showLogo
          showBack
          onBack={isApproved ? undefined : () => { void goToLogin(); }}
        />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error ? (
          <View style={{ marginBottom: spacing.md }}>
            <ErrorState message={error} variant="inline" />
          </View>
        ) : null}

        {isEditMode && v.approval_status === 'needs_correction' && v.correction_reason ? (
          <FeedbackBanner
            severity="warning"
            title="Correction required"
            message={v.correction_reason}
            style={{ marginBottom: spacing.md }}
          />
        ) : null}

        {isEditMode && v.approval_status === 'rejected' ? (
          <FeedbackBanner
            severity="error"
            title="Application rejected"
            message={v.correction_reason ?? 'Please review your documents and resubmit.'}
            style={{ marginBottom: spacing.md }}
          />
        ) : null}

        {showHero ? (
          <PartnerCard variant="container" style={styles.heroCard}>
            <View style={styles.heroGlowTop} />
            <View style={styles.heroGlowBottom} />

            <View style={styles.heroIconWrap}>
              <Ionicons name="clipboard-outline" size={32} color={colors.accentDark} />
            </View>

            <View style={styles.stepBadge}>
              <View style={styles.stepDot} />
              <Text variant="caption" style={styles.stepBadgeText}>
                STEP {v.steps_completed} OF {v.steps_total} COMPLETED
              </Text>
            </View>

            <Text variant="h2" style={styles.heroTitle}>{v.status_headline}</Text>
            <Text variant="bodySmall" style={styles.heroSubtitle}>{v.status_subtitle}</Text>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, v.verified_pct))}%` }]} />
            </View>

            <View style={styles.heroFooter}>
              <Text variant="caption" style={{ color: colors.textMuted }}>
                Submitted: {v.submitted_label || '—'}
              </Text>
              <Text variant="label" style={{ color: colors.text }}>{v.verified_pct}% Verified</Text>
            </View>
          </PartnerCard>
        ) : null}

        {!isEditMode ? (
          <View style={styles.alertsBanner}>
            <View style={styles.alertsIcon}>
              <Ionicons name="notifications" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label">Instant Alerts Enabled</Text>
              <Text variant="caption" style={{ color: colors.textMuted, marginTop: 2 }}>
                You will receive SMS and push notifications when your verification status changes.
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text variant="h3">Submitted Documents</Text>
            <Text variant="caption" style={{ color: colors.textMuted, marginTop: 2 }}>
              {v.documents_submitted} compliance records submitted
            </Text>
          </View>
          <Ionicons name="shield-checkmark" size={22} color={colors.primary} />
        </View>

        {!isEditMode ? (
          uploadedDocs.length === 0 ? (
            <PartnerCard variant="lowest" style={styles.emptyDocs}>
              <Text variant="bodySmall" style={{ color: colors.textMuted, textAlign: 'center' }}>
                No documents submitted yet.
              </Text>
            </PartnerCard>
          ) : (
            uploadedDocs.map((doc) => <DocumentRow key={doc.id} doc={doc} />)
          )
        ) : (
          <>
            {v.documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                showBadge={false}
                onReplace={() => pickAndUpload(doc.doc_type as DocKey)}
                replacing={busy === doc.doc_type}
              />
            ))}

            {missingDocs.map((d) => (
              <PartnerCard key={d.key} style={styles.docCard}>
                <View style={styles.docRow}>
                  <View style={[styles.docIcon, { backgroundColor: d.iconBg }]}>
                    <Ionicons name={d.icon} size={20} color={d.iconColor} />
                  </View>
                  <View style={styles.docBody}>
                    <Text variant="label">{d.label}</Text>
                    <Text variant="caption" style={{ color: colors.textMuted, marginTop: 2 }}>
                      Required for verification
                    </Text>
                  </View>
                  <Button
                    title="Upload"
                    variant="secondary"
                    loading={busy === d.key}
                    onPress={() => pickAndUpload(d.key)}
                    fullWidth={false}
                  />
                </View>
              </PartnerCard>
            ))}

            <Button
              title="Submit for review"
              loading={busy === 'resubmit'}
              onPress={resubmit}
              style={{ marginTop: spacing.md }}
            />
          </>
        )}

        {!isEditMode ? (
          <>
            <PartnerCard variant="lowest" style={styles.promoCard}>
              <View style={styles.promoIcon}>
                <Ionicons name="bicycle" size={28} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="label">Ready to start earning?</Text>
                <Text variant="caption" style={{ color: colors.textMuted, marginTop: 4 }}>
                  Once verified, go online from Home and accept your first delivery offer.
                </Text>
              </View>
            </PartnerCard>

            <View style={styles.footerActions}>
              <Button title="Edit Details" variant="secondary" onPress={onEditDetails} />
              <Button
                title="Contact Partner Support"
                onPress={() => router.push('/(rider)/help' as never)}
                style={{ marginTop: spacing.sm }}
              />
              {!isApproved ? (
                <Pressable onPress={() => { void goToLogin(); }} style={styles.loginLink}>
                  <Text variant="caption" style={styles.loginLinkText}>Back to Login</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : (
          <View style={styles.footerActions}>
            <Button
              title="Contact Partner Support"
              variant="secondary"
              onPress={() => router.push('/(rider)/help' as never)}
              style={{ marginTop: spacing.lg }}
            />
            {!isApproved ? (
              <Pressable onPress={() => { void goToLogin(); }} style={styles.loginLink}>
                <Text variant="caption" style={styles.loginLinkText}>Back to Login</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.massive },
  heroCard: {
    alignItems: 'center',
    padding: spacing.xl,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  heroGlowTop: {
    position: 'absolute',
    top: -48,
    right: -48,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(103, 250, 215, 0.2)',
  },
  heroGlowBottom: {
    position: 'absolute',
    bottom: -48,
    left: -48,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(255, 222, 164, 0.25)',
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 200, 87, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255, 200, 87, 0.35)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFC857',
  },
  stepBadgeText: {
    color: colors.accentDark,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  heroTitle: { textAlign: 'center', marginBottom: spacing.xs },
  heroSubtitle: {
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: spacing.lg,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceContainerHigh,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  heroFooter: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertsBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.primaryFixed,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  alertsIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  docCard: { marginBottom: spacing.sm, padding: spacing.md },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  docIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docBody: { flex: 1 },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  emptyDocs: { padding: spacing.xl, marginBottom: spacing.sm },
  promoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  promoIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerActions: { marginTop: spacing.md },
  loginLink: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  loginLinkText: { color: colors.primary, fontWeight: '600', textAlign: 'center' },
});
