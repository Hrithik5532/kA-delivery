import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { colors } from '@/theme';

export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ['top'] as const,
  style,
  contentStyle,
  ...scrollProps
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  style?: object;
  contentStyle?: ViewStyle;
} & ScrollViewProps) {
  const { horizontalPadding, contentMaxWidth } = useResponsiveLayout();

  const inner = (
    <View
      style={[
        styles.inner,
        padded && { paddingHorizontal: horizontalPadding },
        contentMaxWidth != null && { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.screen, style]} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          {...scrollProps}
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1 },
  scroll: { flexGrow: 1 },
});
