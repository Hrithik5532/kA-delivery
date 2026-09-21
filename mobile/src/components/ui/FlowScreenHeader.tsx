import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandLogo } from '@/components/BrandLogo';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/theme';

export function FlowScreenHeader({
  title,
  showBack = true,
  onBack,
  showLogo = false,
  leftIcon,
}: {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  showLogo?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        {showBack ? (
          <Pressable style={styles.iconBtn} onPress={onBack ?? (() => router.back())}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
        ) : <View style={styles.iconBtn} />}
        <View style={styles.center}>
          {showLogo ? <BrandLogo size={24} /> : null}
          {leftIcon ? (
            <View style={styles.smallIcon}><Ionicons name={leftIcon} size={16} color={colors.primary} /></View>
          ) : null}
          <Text variant="h3" style={styles.title}>{title}</Text>
        </View>
        <View style={styles.right}>
          <Pressable style={styles.iconBtn} onPress={() => router.push('/(rider)/help' as never)}>
            <Ionicons name="headset-outline" size={20} color={colors.text} />
          </Pressable>
          <Pressable style={styles.avatar} onPress={() => router.push('/(rider)/profile' as never)}>
            <Text style={{ fontSize: 14 }}>👤</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: 'rgba(252,248,255,0.95)', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight },
  row: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.sm },
  center: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  title: { textAlign: 'center' },
  smallIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
