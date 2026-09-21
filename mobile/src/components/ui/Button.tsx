import * as Haptics from 'expo-haptics';
import { ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '@/theme';
import { Text } from './Text';
import { PressableScale } from './PressableScale';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

const VARIANTS: Record<Variant, { bg: string; text: string; border?: string }> = {
  primary: { bg: colors.primary, text: colors.onPrimary },
  secondary: { bg: colors.surface, text: colors.primary, border: colors.primary },
  ghost: { bg: 'transparent', text: colors.primary },
  danger: { bg: colors.danger, text: colors.onPrimary },
  success: { bg: colors.success, text: colors.onSecondary },
};

export function Button({
  title, onPress, variant = 'primary', loading = false, disabled = false, style, fullWidth = true,
}: {
  title: string; onPress: () => void; variant?: Variant; loading?: boolean;
  disabled?: boolean; style?: ViewStyle; fullWidth?: boolean;
}) {
  const v = VARIANTS[variant];
  const isDisabled = disabled || loading;
  return (
    <PressableScale
      onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPress(); }}
      disabled={isDisabled}
      style={[styles.btn, { backgroundColor: v.bg, borderColor: v.border, borderWidth: v.border ? 1.5 : 0, opacity: isDisabled ? 0.5 : 1, alignSelf: fullWidth ? 'stretch' : 'flex-start' }, variant === 'primary' && shadow, style]}
    >
      {loading ? <ActivityIndicator color={v.text} /> : <Text variant="button" style={{ color: v.text, textAlign: 'center' }}>{title}</Text>}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: radius.button, paddingVertical: spacing.md + 2, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
});
