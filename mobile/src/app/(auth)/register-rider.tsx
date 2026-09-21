/** Partner onboarding — profile, vehicle, documents, then account credentials. */
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '@/api/client';
import { useAuth } from '@/auth/auth-context';
import { PartnerCard } from '@/components/partner';
import { ErrorState } from '@/components/ErrorState';
import { FeedbackBanner } from '@/components/FeedbackBanner';
import { Button } from '@/components/ui/Button';
import { FlowScreenHeader } from '@/components/ui/FlowScreenHeader';
import { Pill } from '@/components/ui/Pill';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { safeSetItem } from '@/lib/safe-storage';
import { colors, radius, spacing } from '@/theme';

type VehicleType = 'motorcycle' | 'electric_bicycle' | 'bicycle';

type DocKey = 'license' | 'vehicle_rc' | 'id_proof' | 'bank_passbook';

type PickedFile = { uri: string; name: string; type: string };

function toTenDigits(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 10) return digits;
  return digits.slice(-10);
}

const VEHICLE_OPTIONS: {
  key: VehicleType;
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'motorcycle', label: 'Motorcycle / Scooter', subtitle: 'Standard fuel & high payload capacity', icon: 'bicycle' },
  { key: 'electric_bicycle', label: 'Electric Bicycle / EV', subtitle: 'Eco-friendly green corridor access', icon: 'flash' },
  { key: 'bicycle', label: 'Bicycle', subtitle: 'Short-distance campus & local routes', icon: 'walk' },
];

const DOC_TYPES: {
  key: DocKey;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'license', label: 'Driving License', hint: 'Front and back photo', icon: 'card' },
  { key: 'vehicle_rc', label: 'Vehicle RC', hint: 'Registration Certif...', icon: 'document-text' },
  { key: 'id_proof', label: 'Aadhaar / National ID', hint: 'Government-issued photo ID', icon: 'finger-print' },
  { key: 'bank_passbook', label: 'Bank Passbook / Cheque', hint: 'Required for weekly payouts', icon: 'wallet' },
];


function PhoneField({
  label,
  value,
  onChangeText,
  placeholder,
  right,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.fieldWrap}>
      <View style={styles.labelRow}>
        <Text variant="caption" style={styles.fieldLabel}>{label}</Text>
        {right}
      </View>
      <View style={styles.phoneRow}>
        <View style={styles.countryCode}>
          <Text style={styles.flag}>🇮🇳</Text>
          <Text style={styles.countryCodeText}>+91</Text>
          <Ionicons name="chevron-down" size={16} color={colors.outline} />
        </View>
        <View style={styles.phoneDivider} />
        <TextInput
          style={styles.phoneInput}
          value={value}
          onChangeText={(v) => onChangeText(toTenDigits(v))}
          keyboardType="phone-pad"
          placeholder={placeholder}
          placeholderTextColor={colors.outline}
          maxLength={10}
        />
      </View>
    </View>
  );
}

function IconField({
  label,
  icon,
  right,
  ...props
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  right?: ReactNode;
} & TextInputProps) {
  return (
    <View style={styles.fieldWrap}>
      <View style={styles.labelRow}>
        <Text variant="caption" style={styles.fieldLabel}>{label}</Text>
        {right}
      </View>
      <View style={styles.iconInputRow}>
        <Ionicons name={icon} size={20} color={colors.outline} style={styles.inputIcon} />
        <TextInput
          placeholderTextColor={colors.textLight}
          style={styles.iconInput}
          {...props}
        />
      </View>
    </View>
  );
}

export default function RegisterRider() {
  const router = useRouter();
  const { phone: phoneParam } = useLocalSearchParams<{ phone?: string }>();
  const { registerRider } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    full_name: '',
    phone: toTenDigits(phoneParam ?? ''),
    emergency_contact: '',
    vehicle_type: 'motorcycle' as VehicleType,
    email: '',
    password: '',
    vehicle_number: '',
  });
  const [docs, setDocs] = useState<Partial<Record<DocKey, PickedFile>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<DocKey | null>(null);

  const uploadedCount = DOC_TYPES.filter((d) => docs[d.key]).length;
  const progress = step === 1 ? 0.5 : 1;
  const phoneVerified = form.phone.replace(/\D/g, '').length >= 10;

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const pickDocument = async (docKey: DocKey) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      setError('Allow photo access to upload a document.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setDocs((prev) => ({
      ...prev,
      [docKey]: {
        uri: asset.uri,
        name: asset.fileName ?? `${docKey}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      },
    }));
    setError(null);
  };

  const canAdvanceStep1 =
    form.full_name.trim().length > 0 &&
    phoneVerified &&
    form.emergency_contact.replace(/\D/g, '').length >= 10;

  const canSubmitStep2 =
    form.email.trim().length > 0 &&
    form.password.length >= 6 &&
    form.vehicle_number.trim().length > 0;

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await registerRider({
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        emergency_contact: form.emergency_contact.trim(),
        vehicle_type: form.vehicle_type,
        vehicle_number: form.vehicle_number.trim(),
        license_number: 'PENDING',
      });
      for (const doc of DOC_TYPES) {
        const file = docs[doc.key];
        if (!file) continue;
        setUploading(doc.key);
        await api.uploadDocument(doc.key, file);
      }
      if (uploadedCount > 0) {
        try { await api.resubmit(); } catch { /* noop */ }
      }
      await safeSetItem('digimess.show_verification', '1');
      router.replace('/(rider)/documents' as never);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed');
      setBusy(false);
      setUploading(null);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <FlowScreenHeader title="Partner Onboarding" onBack={step === 2 ? () => setStep(1) : undefined} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.stepRow}>
          <Pill text={`Step ${step} of 2`} color={colors.primary} />
          <Pill text={`${Math.round(progress * 100)}% Complete`} color={colors.primaryContainer} />
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        {step === 1 ? (
          <>
            <Text variant="h1" style={styles.title}>Partner Profile & Vehicle Details</Text>
            <Text variant="bodySmall" style={styles.subtitle}>
              Tell us about yourself, your vehicle, and upload compliance documents.
            </Text>

            {error ? <ErrorState message={error} variant="inline" /> : null}

            <PartnerCard style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="person-outline" size={20} color={colors.primary} />
                <Text variant="h3">Personal Information</Text>
              </View>

              <IconField
                label="Full Name (as per Govt ID)"
                icon="id-card"
                value={form.full_name}
                onChangeText={(v) => set('full_name', v)}
                autoCapitalize="words"
                placeholder="Enter your legal name"
              />

              <PhoneField
                label="Registered Phone Number"
                value={form.phone}
                onChangeText={(v) => set('phone', v)}
                placeholder="98765 43210"
                right={phoneVerified ? <Pill text="Verified" color={colors.secondary} variant="success" /> : null}
              />

              <PhoneField
                label="Emergency Contact Number"
                value={form.emergency_contact}
                onChangeText={(v) => set('emergency_contact', v)}
                placeholder="90000 00000"
              />
            </PartnerCard>

            <PartnerCard style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="bicycle" size={20} color={colors.primary} />
                <Text variant="h3" style={{ flex: 1 }}>Vehicle Fleet Category</Text>
                <Text variant="caption" style={{ color: colors.textMuted }}>Select One</Text>
              </View>
              <Text variant="caption" style={{ color: colors.textMuted, marginBottom: spacing.sm }}>
                Choose the primary vehicle used for scheduled delivery runs
              </Text>

              <View style={styles.vehicleList}>
                {VEHICLE_OPTIONS.map((v) => {
                  const selected = form.vehicle_type === v.key;
                  return (
                    <PressableScale
                      key={v.key}
                      onPress={() => set('vehicle_type', v.key)}
                      style={[styles.vehicleCard, selected && styles.vehicleCardSelected]}
                    >
                      <View style={[styles.vehicleIcon, selected && styles.vehicleIconSelected]}>
                        <Ionicons name={v.icon} size={24} color={selected ? colors.onPrimary : colors.primary} />
                      </View>
                      <View style={styles.vehicleCopy}>
                        <Text variant="label" style={{ color: selected ? colors.onPrimary : colors.text }}>{v.label}</Text>
                        <Text variant="caption" style={{ color: selected ? colors.onPrimary : colors.textMuted, marginTop: 2 }}>
                          {v.subtitle}
                        </Text>
                      </View>
                      {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.onPrimary} /> : null}
                    </PressableScale>
                  );
                })}
              </View>
            </PartnerCard>

            <View style={styles.docsHeader}>
              <View style={styles.sectionHeader}>
                <Ionicons name="folder-open" size={20} color={colors.primary} />
                <Text variant="h3">Compliance Documents</Text>
              </View>
              <Text variant="caption" style={{ color: colors.primary }}>{uploadedCount}/4 Uploaded</Text>
            </View>

            {DOC_TYPES.map((d) => {
              const picked = docs[d.key];
              return (
                <PartnerCard key={d.key} style={styles.docCard}>
                  <View style={styles.docRow}>
                    <View style={styles.docIcon}>
                      <Ionicons name={d.icon} size={18} color={colors.onSecondaryContainer} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="label">{d.label}</Text>
                      <Text variant="caption" style={{ color: colors.textMuted }}>{d.hint}</Text>
                    </View>
                    {picked ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.secondary} />
                    ) : (
                      <Button
                        title="Upload"
                        variant="secondary"
                        fullWidth={false}
                        onPress={() => pickDocument(d.key)}
                      />
                    )}
                  </View>
                  {picked ? (
                    <Pressable onPress={() => pickDocument(d.key)} style={styles.replaceBtn}>
                      <Text variant="caption" style={{ color: colors.primary }}>Replace file</Text>
                    </Pressable>
                  ) : null}
                </PartnerCard>
              );
            })}

            <FeedbackBanner
              severity="info"
              title="Verification timeline"
              message="Our compliance team will review your documents within 2–4 business hours. You will be notified once approved."
              style={{ marginTop: spacing.md }}
            />

            <Button
              title="Submit for Verification"
              onPress={() => {
                setError(null);
                setStep(2);
              }}
              disabled={!canAdvanceStep1}
              style={styles.submitBtn}
            />
          </>
        ) : (
          <>
            <Text variant="h1" style={styles.title}>Account & Vehicle Registration</Text>
            <Text variant="bodySmall" style={styles.subtitle}>
              Create your login and add your vehicle registration number to complete onboarding.
            </Text>

            {error ? <ErrorState message={error} variant="inline" /> : null}

            <PartnerCard style={styles.section}>
              <TextField
                label="Email"
                value={form.email}
                onChangeText={(v) => set('email', v)}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="partner@example.com"
              />
              <TextField
                label="Password"
                value={form.password}
                onChangeText={(v) => set('password', v)}
                secureTextEntry
                placeholder="Minimum 6 characters"
              />
              <TextField
                label="Vehicle Registration Number"
                value={form.vehicle_number}
                onChangeText={(v) => set('vehicle_number', v)}
                autoCapitalize="characters"
                placeholder="DL-01-AB-1234"
              />
            </PartnerCard>

            <FeedbackBanner
              severity="info"
              message="Submitting will create your partner account and upload your documents for verification."
              style={{ marginTop: spacing.sm }}
            />

            <Button
              title={uploading ? `Uploading ${uploading.replace('_', ' ')}…` : 'Complete Registration'}
              onPress={submit}
              loading={busy}
              disabled={!canSubmitStep2}
              style={styles.submitBtn}
            />

            <Pressable onPress={() => router.push('/(auth)/login' as never)} style={styles.loginLink}>
              <Text variant="caption" style={{ color: colors.textMuted, textAlign: 'center' }}>
                Already have an account? <Text variant="label" style={{ color: colors.primary }}>Sign in</Text>
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.massive },
  stepRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceVariant,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  progressFill: { height: '100%', backgroundColor: colors.primaryContainer, borderRadius: radius.pill },
  title: { marginBottom: spacing.xs },
  subtitle: { color: colors.textMuted, marginBottom: spacing.lg },
  section: { marginBottom: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  fieldWrap: { marginBottom: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  fieldLabel: { color: colors.textMuted },
  iconInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  inputIcon: { marginRight: spacing.sm },
  iconInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: spacing.md },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  countryCode: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  countryCodeText: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.text },
  flag: { fontSize: 16 },
  phoneDivider: { width: 1, height: 24, backgroundColor: colors.borderLight, marginHorizontal: spacing.sm },
  phoneInput: { flex: 1, fontSize: 16, lineHeight: 24, color: colors.text, paddingVertical: 0 },
  vehicleList: { gap: spacing.sm },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
  },
  vehicleCardSelected: { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer },
  vehicleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleIconSelected: { backgroundColor: colors.primary },
  vehicleCopy: { flex: 1 },
  docsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  docCard: { marginBottom: spacing.sm, padding: spacing.md },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replaceBtn: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  submitBtn: { marginTop: spacing.lg, backgroundColor: "#5B3DF5" },
  loginLink: { marginTop: spacing.lg },
});
