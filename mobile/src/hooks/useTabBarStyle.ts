import { Platform, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';

const TAB_BAR_HEIGHT = 56;

export function useTabBarStyle(options?: {
  backgroundColor?: string;
  borderColor?: string;
}): ViewStyle {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? spacing.sm : 0);

  return {
    backgroundColor: options?.backgroundColor ?? colors.surface,
    borderTopColor: options?.borderColor ?? colors.border,
    borderTopWidth: 1,
    height: TAB_BAR_HEIGHT + bottomInset,
    paddingTop: spacing.xs,
    paddingBottom: bottomInset,
  };
}

export function useTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? spacing.sm : 0);
  return TAB_BAR_HEIGHT + bottomInset;
}
