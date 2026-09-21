import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '@/theme';

export function Divider({ style }: { style?: object }) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({ divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md } });
