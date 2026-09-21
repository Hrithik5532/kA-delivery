import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '@/theme';

type Variant = 'low' | 'container' | 'lowest' | 'primary';

const BG: Record<Variant, string> = {
  low: colors.surfaceContainerLow,
  container: colors.surfaceContainer,
  lowest: colors.surfaceContainerLowest,
  primary: colors.primary,
};

export function PartnerCard({
  children,
  style,
  variant = 'low',
}: {
  children: ReactNode;
  style?: ViewStyle;
  variant?: Variant;
}) {
  return (
    <View style={[styles.card, { backgroundColor: BG[variant] }, variant !== 'primary' && shadow, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
});
