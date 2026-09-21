import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { feedbackStyles, type FeedbackSeverity } from '@/theme/feedback';
import { Text } from './Text';

const semanticColors: Record<FeedbackSeverity, string> = {
  success: feedbackStyles.success.iconColor,
  warning: feedbackStyles.warning.iconColor,
  error: feedbackStyles.error.iconColor,
  info: feedbackStyles.info.iconColor,
};

export function Pill({
  text,
  color = colors.primary,
  soft = true,
  variant,
}: {
  text: string;
  color?: string;
  soft?: boolean;
  variant?: FeedbackSeverity;
}) {
  const tone = variant ? semanticColors[variant] : color;
  return (
    <View style={[styles.pill, { backgroundColor: soft ? `${tone}18` : tone, borderColor: `${tone}40` }]}>
      <Text variant="caption" style={{ color: soft ? tone : colors.onPrimary, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4, alignSelf: 'flex-start' },
});
