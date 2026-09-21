import { Ionicons } from '@expo/vector-icons';
import { Switch, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme';

/** Teal online-status card from home mockup. */
export function OnlineStatusBanner({
  online,
  onToggle,
  disabled,
}: {
  online: boolean;
  onToggle: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.banner, online && styles.bannerOnline]}>
      <View style={styles.scooterBox}>
        <Ionicons name="bicycle" size={24} color={colors.secondary} />
      </View>
      <View style={styles.content}>
        <View style={styles.statusRow}>
          <View style={[styles.dot, online && styles.dotOnline]} />
          <Text variant="caption" style={styles.statusLabel}>
            {online ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </View>
        <Text variant="label" style={styles.title}>
          {online ? 'ONLINE • Accepting Orders' : "You're Offline"}
        </Text>
        <Text variant="caption" style={styles.subtitle}>
          {online ? 'Auto-dispatch actively searching' : 'Go online to receive delivery requests'}
        </Text>
      </View>
      <Switch
        value={online}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: 'rgba(120,117,136,0.25)', true: colors.secondary }}
        thumbColor={colors.surface}
        style={styles.switch}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  bannerOnline: {
    backgroundColor: '#E8FBF6',
    borderColor: colors.secondaryFixed,
  },
  scooterBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.secondaryFixed,
  },
  content: { flex: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.outline },
  dotOnline: { backgroundColor: colors.secondary },
  statusLabel: { color: colors.secondary, fontWeight: '800', letterSpacing: 0.8, fontSize: 10 },
  title: { color: colors.text, fontWeight: '700', fontSize: 15 },
  subtitle: { color: colors.textMuted, marginTop: 2 },
  switch: { transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }] },
});
