import { useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuthTheme } from '@/theme/auth';
import { authThemes } from '@/theme/auth';
import { BrandLogo } from '@/components/BrandLogo';
import { colors, radius, shadowLg, spacing } from '@/theme';
import { Text } from '../ui/Text';
import { AuthHero } from './AuthHero';

type NavLink = { label: string; href: string };

export function AuthScaffold({
  theme,
  children,
  heroTitle,
  heroSubtitle,
  partnerLink,
  backLink,
  footer,
}: {
  theme: AuthTheme;
  children: ReactNode;
  heroTitle?: string;
  heroSubtitle?: string;
  partnerLink?: NavLink;
  backLink?: NavLink;
  footer?: ReactNode;
}) {
  const router = useRouter();
  const t = authThemes[theme];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.soft }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          {backLink ? (
            <Pressable onPress={() => router.push(backLink.href as never)} hitSlop={12}>
              <Text variant="button" style={{ color: t.primary, fontSize: 14 }}>{backLink.label}</Text>
            </Pressable>
          ) : partnerLink ? (
            <Pressable onPress={() => router.push(partnerLink.href as never)} hitSlop={12}>
              <Text variant="button" style={{ color: t.primary, fontSize: 14 }}>{partnerLink.label}</Text>
            </Pressable>
          ) : <View />}
          <View style={styles.topRight}>
            <BrandLogo size={36} />
            <View style={[styles.badge, { backgroundColor: `${t.primary}20` }]}>
              <Text variant="caption" style={{ color: t.primaryDark, fontWeight: '700' }}>{t.label}</Text>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AuthHero theme={theme} title={heroTitle} subtitle={heroSubtitle} />
          <View style={styles.card}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  scroll: { flexGrow: 1, paddingBottom: spacing.xl },
  card: { backgroundColor: colors.surface, marginHorizontal: spacing.lg, borderRadius: radius.card, padding: spacing.xl, marginTop: -spacing.xl, ...shadowLg },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, alignItems: 'center' },
});
