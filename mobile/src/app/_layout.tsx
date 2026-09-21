/** Root layout: providers + rider-only navigation gate. */
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/auth/auth-context';
import { FeedbackProvider } from '@/components/FeedbackProvider';
import { Loading } from '@/components/Loading';
import { isUnapprovedAllowedPath } from '@/lib/verification-gate';
import { safeGetItem, safeRemoveItem } from '@/lib/safe-storage';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const RIDER_HOME = '/(rider)';

function RootNavigator() {
  const { token, role, loading, isApproved, approvalLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    void (async () => {
      const hasOnboarded = (await safeGetItem('digimess_onboarded')) === '1';
      const group = segments[0];
      const inAuth = group === '(auth)';
      const atRoot = !group || group === 'index';
      const authScreen = (segments as string[])[1];
      const preOnboardScreens = new Set(['welcome', 'login', 'register-rider']);

      if (!token) {
        if (inAuth && authScreen === 'register-rider') return;
        if (!inAuth) {
          router.replace((hasOnboarded ? '/(auth)/login' : '/(auth)/welcome') as never);
          return;
        }
        if (!hasOnboarded && authScreen && !preOnboardScreens.has(authScreen)) {
          router.replace('/(auth)/welcome' as never);
        }
        return;
      }

      if (role !== 'rider') {
        router.replace('/(auth)/login' as never);
        return;
      }

      const showVerification = (await safeGetItem('digimess.show_verification')) === '1';
      const segList = segments as string[];
      const onAllowedVerificationScreen = group === '(rider)' && isUnapprovedAllowedPath(segList);

      if (approvalLoading) {
        if (inAuth || onAllowedVerificationScreen || group === '(rider)') return;
        return;
      }

      if (!isApproved) {
        if (inAuth && authScreen === 'register-rider') return;
        if (!onAllowedVerificationScreen) {
          if (showVerification) await safeRemoveItem('digimess.show_verification');
          router.replace('/(rider)/documents' as never);
        }
        return;
      }

      if (inAuth || atRoot || group !== '(rider)') {
        router.replace(RIDER_HOME as never);
      }
    })();
  }, [token, role, loading, isApproved, approvalLoading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.riderBg }}>
        <Loading label="Starting delivery app…" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.riderBg } }} />
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <AuthProvider>
            <FeedbackProvider>
              <StatusBar style="light" />
              <RootNavigator />
            </FeedbackProvider>
          </AuthProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
