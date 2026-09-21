import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '@/theme';
import { PressableScale } from './PressableScale';

export function IconButton({ icon, onPress, color = colors.text, size = 22, filled = false }: {
  icon: keyof typeof Ionicons.glyphMap; onPress?: () => void; color?: string; size?: number; filled?: boolean;
}) {
  return (
    <PressableScale onPress={onPress} style={styles.btn}>
      <Ionicons name={icon} size={size} color={color} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
});
