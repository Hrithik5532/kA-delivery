import * as Haptics from 'expo-haptics';
import { Pressable, StyleProp, type PressableProps, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({
  children, style, onPress, haptic = true, scale = 0.97, ...props
}: PressableProps & { haptic?: boolean; scale?: number; style?: StyleProp<ViewStyle> }) {
  const s = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));

  return (
    <AnimatedPressable
      style={[animStyle, style]}
      onPressIn={() => { s.value = withSpring(scale, { damping: 15 }); }}
      onPressOut={() => { s.value = withSpring(1, { damping: 15 }); }}
      onPress={(e) => { if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress?.(e); }}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}
