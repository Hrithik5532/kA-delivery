import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { BrandLogo } from '@/components/BrandLogo';
import { BRAND_TAGLINE } from '@/constants/brand';
import type { AuthTheme } from '@/theme/auth';
import { authThemes } from '@/theme/auth';
import { spacing } from '@/theme';
import { Text } from '../ui/Text';

export function AuthHero({ theme, title, subtitle }: { theme: AuthTheme; title?: string; subtitle?: string }) {
  const t = authThemes[theme];
  const float = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(
      withSequence(withTiming(-6, { duration: 1200 }), withTiming(0, { duration: 1200 })),
      -1,
      true
    );
  }, [float]);

  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: float.value }] }));

  return (
    <View style={[styles.wrap, { backgroundColor: t.soft }]}>
      <Animated.View style={floatStyle}>
        <BrandLogo size={theme === 'customer' ? 96 : 88} />
      </Animated.View>
      {title ? <Text variant="h1" style={[styles.title, { color: t.primaryDark }]}>{title}</Text> : null}
      {subtitle ? (
        <Text variant="bodySmall" style={styles.sub}>{subtitle}</Text>
      ) : (
        <Text variant="bodySmall" style={styles.sub}>{BRAND_TAGLINE}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.lg, minHeight: 200 },
  title: { textAlign: 'center', marginTop: spacing.lg },
  sub: { textAlign: 'center', marginTop: spacing.xs, maxWidth: 280 },
});
