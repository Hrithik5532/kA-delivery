import { StyleSheet, View } from 'react-native';
import type { SalaryStatus } from '@/api/types';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme';

export function SalaryStatusPill({ status }: { status: SalaryStatus }) {
  const paid = status === 'paid';
  return (
    <View style={[styles.pill, { backgroundColor: paid ? colors.secondarySoft : colors.infoSoft }]}>
      <Text variant="caption" style={{ color: paid ? colors.secondary : colors.info, fontWeight: '800' }}>
        {paid ? 'PAID' : 'APPROVED'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
});
