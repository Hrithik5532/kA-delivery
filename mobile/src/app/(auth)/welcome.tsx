import { Link, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMark } from '@/components/BrandLogo';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { BRAND_TAGLINE } from '@/constants/brand';
import { safeSetItem } from '@/lib/safe-storage';
import { authThemes } from '@/theme/auth';
import { colors, spacing } from '@/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const t = authThemes.delivery;
  const float = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(
      withSequence(withTiming(-8, { duration: 1400 }), withTiming(0, { duration: 1400 })),
      -1,
      true
    );
  }, [float]);

  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: float.value }] }));

  const getStarted = async () => {
    await safeSetItem('digimess_onboarded', '1');
    router.replace('/(auth)/login' as never);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.soft }]} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.hero}>
        <Animated.View style={floatStyle}>
          <BrandMark size={120} nameSize="h1" />
        </Animated.View>
        <Text variant="h3" style={{ color: colors.riderText, marginTop: spacing.lg, textAlign: 'center' }}>
          Delivery Partner
        </Text>
        <Text variant="body" style={{ color: colors.riderMuted, marginTop: spacing.md, textAlign: 'center' }}>
          {BRAND_TAGLINE}
        </Text>
      </View>

      <View style={styles.footer}>
        <Button title="Get Started" onPress={getStarted} style={{ backgroundColor: t.primary }} />
        <Link href="/register-rider" asChild>
          <Pressable style={styles.partnerLink}>
            <Text variant="button" style={{ color: t.primary, fontSize: 14 }}>Apply as a delivery partner</Text>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'space-between' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  partnerLink: { marginTop: spacing.lg, alignItems: 'center' },
});
