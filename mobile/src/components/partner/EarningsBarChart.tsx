import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import type { EarningsBucket } from '@/api/types';
import { colors, spacing } from '@/theme';

function formatK(cents: number) {
  const rupees = cents / 100;
  if (rupees >= 1000) return `${(rupees / 1000).toFixed(1)}k`;
  return `${Math.round(rupees)}`;
}

export function EarningsBarChart({
  buckets,
  selectedKey,
  onSelect,
}: {
  buckets: EarningsBucket[];
  selectedKey?: string | null;
  onSelect?: (bucket: EarningsBucket) => void;
}) {
  const max = Math.max(...buckets.map((b) => b.amount_cents), 1);
  const sorted = [...buckets].sort((a, b) => b.amount_cents - a.amount_cents);
  const peakKey = sorted[0]?.key;
  const secondKey = sorted[1]?.key;
  const activeKey = selectedKey ?? peakKey;

  return (
    <View style={styles.wrap}>
      {buckets.map((b) => {
        const h = Math.max(12, (b.amount_cents / max) * 88);
        const isSelected = b.key === activeKey;
        const isPeak = b.key === peakKey && b.amount_cents > 0;
        const isSecond = b.key === secondKey && b.amount_cents > 0 && !isPeak;
        const barColor = isSelected
          ? colors.primary
          : isPeak
            ? colors.primary
            : isSecond
              ? colors.secondaryDark
              : b.amount_cents > 0
                ? colors.primaryFixed
                : colors.surfaceVariant;
        return (
          <Pressable
            key={b.key}
            style={styles.col}
            onPress={() => onSelect?.(b)}
            accessibilityRole="button"
            accessibilityLabel={`${b.label}: ${formatK(b.amount_cents)}, ${b.trips} trips`}
          >
            {isSelected && b.amount_cents > 0 ? (
              <View style={styles.tooltip}>
                <Text variant="caption" style={styles.tooltipText}>{formatK(b.amount_cents)}</Text>
              </View>
            ) : b.amount_cents > 0 ? (
              <Text variant="caption" style={styles.amount}>{formatK(b.amount_cents)}</Text>
            ) : (
              <View style={{ height: 14 }} />
            )}
            <View
              style={[
                styles.bar,
                { height: h, backgroundColor: barColor },
                isSelected && styles.barSelected,
              ]}
            />
            <Text variant="caption" style={[styles.day, (b.is_today || isSelected) && styles.dayToday]}>
              {b.short}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  bar: { width: '72%', borderRadius: 8, minHeight: 12 },
  barSelected: {
    transform: [{ scaleX: 1.08 }],
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  day: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  dayToday: { color: colors.primary, fontWeight: '800' },
  amount: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  tooltip: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  tooltipText: { color: colors.onPrimary, fontSize: 10, fontWeight: '800' },
});
