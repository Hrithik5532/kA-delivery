import { StyleSheet, View } from 'react-native';
import { colors, radius } from '@/theme';
import { Text } from './Text';

export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text variant="button" style={{ color: colors.primary, fontSize: size * 0.35 }}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
