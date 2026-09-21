import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '@/theme';
import { Text } from './ui/Text';
import { PressableScale } from './ui/PressableScale';

export function ProfileMenuItem({ icon, label, subtitle, onPress, danger, highlighted }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  danger?: boolean;
  highlighted?: boolean;
}) {
  return (
    <PressableScale
      onPress={onPress}
      style={[styles.row, highlighted && styles.rowHighlighted, danger && styles.rowDanger]}
    >
      <View style={[
        styles.iconWrap,
        danger && { backgroundColor: colors.dangerSoft },
        highlighted && styles.iconWrapHighlighted,
      ]}>
        <Ionicons name={icon} size={20} color={danger ? colors.danger : highlighted ? colors.onPrimary : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="body" style={danger ? { color: colors.danger } : highlighted ? styles.highlightedLabel : undefined}>
          {label}
        </Text>
        {subtitle ? (
          <Text variant="caption" style={highlighted ? styles.highlightedSubtitle : undefined}>{subtitle}</Text>
        ) : null}
      </View>
      {highlighted ? (
        <View style={styles.highlightBadge}>
          <Text variant="caption" style={styles.highlightBadgeText}>Instant</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={highlighted ? colors.primary : colors.textLight} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  rowHighlighted: {
    backgroundColor: colors.primaryFixed,
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomColor: colors.primary,
    borderBottomWidth: 0,
    borderRadius: 14,
    marginBottom: spacing.xs,
  },
  rowDanger: { backgroundColor: 'transparent' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapHighlighted: { backgroundColor: colors.primary },
  highlightedLabel: { color: colors.primary, fontWeight: '700' },
  highlightedSubtitle: { color: colors.textMuted, fontWeight: '600' },
  highlightBadge: {
    backgroundColor: colors.secondaryFixed,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 10,
  },
  highlightBadgeText: { color: colors.onSecondaryContainer, fontWeight: '800', fontSize: 10 },
});
