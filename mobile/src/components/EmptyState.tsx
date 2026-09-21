import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '@/theme';
import { Text } from './ui/Text';
import { Button } from './ui/Button';

export function EmptyState({ icon = 'restaurant-outline', title, subtitle, actionLabel, onAction }: {
  icon?: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}><Ionicons name={icon} size={48} color={colors.primary} /></View>
      <Text variant="h3" style={styles.title}>{title}</Text>
      {subtitle ? <Text variant="bodySmall" style={styles.sub}>{subtitle}</Text> : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} fullWidth={false} style={{ marginTop: spacing.xl, paddingHorizontal: spacing.xxxl }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl },
  iconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  title: { textAlign: 'center', marginBottom: spacing.sm },
  sub: { textAlign: 'center', maxWidth: 280 },
});
