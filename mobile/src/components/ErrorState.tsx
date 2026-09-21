import { StyleSheet, View } from 'react-native';
import { FeedbackBanner } from '@/components/FeedbackBanner';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/theme';

export function ErrorState({
  message,
  onRetry,
  variant = 'inline',
  title,
}: {
  message: string;
  onRetry?: () => void;
  variant?: 'inline' | 'page';
  title?: string;
}) {
  if (variant === 'inline') {
    return <FeedbackBanner severity="error" message={message} title={title} />;
  }

  return (
    <View style={styles.wrap}>
      <FeedbackBanner severity="error" message={message} title={title ?? 'Something went wrong'} />
      {onRetry ? (
        <Button title="Try Again" onPress={onRetry} variant="secondary" fullWidth={false} style={{ marginTop: spacing.lg }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.xl, alignItems: 'stretch' },
});
