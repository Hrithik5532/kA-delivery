/** Backward-compatible re-exports from the new component library. */
export { Screen, Button, TextField, Pill, Avatar, Divider, Text, PressableScale } from '@/components/ui';
export { EmptyState } from '@/components/EmptyState';
export { FeedbackBanner as ErrorBanner } from '@/components/FeedbackBanner';
export { ErrorState } from '@/components/ErrorState';
export { Loading } from '@/components/Loading';

import { Text } from '@/components/ui/Text';
import { StyleSheet } from 'react-native';

export function Heading({ children }: { children: React.ReactNode }) {
  return <Text variant="h1" style={styles.heading}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text variant="bodySmall" style={styles.muted}>{children}</Text>;
}

const styles = StyleSheet.create({
  heading: { marginBottom: 4 },
  muted: { textAlign: 'center' },
});
