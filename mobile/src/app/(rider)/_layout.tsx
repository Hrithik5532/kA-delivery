import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@/auth/auth-context';
import { useTabBarStyle } from '@/hooks/useTabBarStyle';
import { isUnapprovedAllowedPath } from '@/lib/verification-gate';
import { colors } from '@/theme';

export default function RiderLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { isApproved, approvalLoading } = useAuth();
  const tabBarStyle = useTabBarStyle({
    backgroundColor: 'rgba(252, 248, 255, 0.95)',
    borderColor: colors.borderLight,
  });

  useEffect(() => {
    if (approvalLoading || isApproved) return;
    const segList = segments as string[];
    if (!isUnapprovedAllowedPath(segList)) {
      router.replace('/(rider)/documents' as never);
    }
  }, [approvalLoading, isApproved, segments, router]);

  const hideTabs = !approvalLoading && !isApproved;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: hideTabs ? { display: 'none' } : tabBarStyle,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="bicycle" color={color} size={size} /> }} />
      <Tabs.Screen name="deliveries" options={{ title: 'History', tabBarIcon: ({ color, size }) => <Ionicons name="document-text" color={color} size={size} /> }} />
      <Tabs.Screen name="earnings" options={{ title: 'Earnings', tabBarIcon: ({ color, size }) => <Ionicons name="cash" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="id-card" color={color} size={size} /> }} />
      <Tabs.Screen name="request/[offerId]" options={{ href: null }} />
      <Tabs.Screen name="active" options={{ href: null }} />
      <Tabs.Screen name="pickup" options={{ href: null }} />
      <Tabs.Screen name="complete/[deliveryId]" options={{ href: null }} />
      <Tabs.Screen name="documents" options={{ href: null }} />
      <Tabs.Screen name="help" options={{ href: null }} />
      <Tabs.Screen name="wallet" options={{ href: null }} />
    </Tabs>
  );
}
