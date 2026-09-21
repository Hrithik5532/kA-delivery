import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { colors } from '@/theme';

/** Wrapper for bottom-tab screens — top safe area + consistent horizontal padding. */
export function TabScreen({
  children,
  style,
  dark = false,
  padded = true,
  contentStyle,
}: {
  children: ReactNode;
  style?: ViewStyle;
  dark?: boolean;
  padded?: boolean;
  contentStyle?: ViewStyle;
}) {
  const { horizontalPadding, contentMaxWidth } = useResponsiveLayout();

  return (
    <SafeAreaView style={[styles.screen, dark && styles.dark, style]} edges={['top']}>
      <View
        style={[
          styles.content,
          padded && { paddingHorizontal: horizontalPadding },
          contentMaxWidth != null && { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  dark: { backgroundColor: colors.riderBg },
  content: { flex: 1 },
});
