import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, radius, spacing } from '@/theme';

function Bone({ style }: { style: ViewStyle }) {
  const opacity = useSharedValue(0.4);
  useEffect(() => { opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true); }, []);
  const anim = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.bone, anim, style]} />;
}

export function SkeletonMessCard() {
  return (
    <View style={styles.card}>
      <Bone style={{ height: 140, borderRadius: radius.md, marginBottom: spacing.md }} />
      <Bone style={{ height: 18, width: '60%', marginBottom: spacing.sm }} />
      <Bone style={{ height: 14, width: '40%' }} />
    </View>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return <>{Array.from({ length: count }).map((_, i) => <SkeletonMessCard key={i} />)}</>;
}

const styles = StyleSheet.create({
  bone: { backgroundColor: colors.border },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: spacing.lg, marginBottom: spacing.md },
});
