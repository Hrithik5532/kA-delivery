import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { BrandLogo } from '@/components/BrandLogo';
import { BRAND_NAME } from '@/constants/brand';
import { colors, spacing } from '@/theme';
import { Text } from './ui/Text';

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.wrap}>
      <BrandLogo size={72} />
      <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: spacing.lg }} />
      <Text variant="bodySmall" style={{ marginTop: spacing.md }}>
        {label ?? BRAND_NAME}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl } });
