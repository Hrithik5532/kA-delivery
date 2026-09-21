import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { feedbackStyles, feedbackTitles, type FeedbackSeverity } from '@/theme/feedback';
import { radius, spacing } from '@/theme';

export function FeedbackBanner({
  severity,
  message,
  title,
  onDismiss,
  style,
}: {
  severity: FeedbackSeverity;
  message: string;
  title?: string;
  onDismiss?: () => void;
  style?: object;
}) {
  const palette = feedbackStyles[severity];
  const heading = title ?? (severity === 'error' ? undefined : feedbackTitles[severity]);

  return (
    <View style={[styles.wrap, { backgroundColor: palette.background, borderColor: palette.border }, style]}>
      <Ionicons name={palette.icon} size={20} color={palette.iconColor} style={styles.icon} />
      <View style={styles.body}>
        {heading ? <Text variant="label" style={{ color: palette.text }}>{heading}</Text> : null}
        <Text variant="bodySmall" style={{ color: palette.text, marginTop: heading ? 2 : 0 }}>{message}</Text>
      </View>
      {onDismiss ? (
        <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss">
          <Ionicons name="close" size={18} color={palette.iconColor} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  icon: { marginTop: 1 },
  body: { flex: 1 },
});
