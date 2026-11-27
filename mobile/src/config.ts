/**
 * Public runtime configuration. Values come from EXPO_PUBLIC_* env vars, which
 * Expo inlines at build time. Backend secrets are never present here.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8001',
  wsUrl: process.env.EXPO_PUBLIC_WS_URL ?? 'ws://localhost:8001',
  mapProvider: process.env.EXPO_PUBLIC_MAP_PROVIDER ?? 'none',
  mapApiKey: process.env.EXPO_PUBLIC_MAP_API_KEY ?? '',
  locationIntervalMs: num(process.env.EXPO_PUBLIC_LOCATION_INTERVAL_MS, 5000),
  locationDistanceM: num(process.env.EXPO_PUBLIC_LOCATION_DISTANCE_M, 30),
  wsReconnectBaseMs: 1000,
  wsReconnectMaxMs: 15000,
};

/** Whether map API credentials are configured. */
export const hasMapCredentials =
  config.mapProvider !== 'none' && config.mapApiKey.trim().length > 0;

const isExpoGo = Constants.appOwnership === 'expo';

/**
 * Google provider on native needs the Maps SDK key baked into a custom build
 * (EAS env EXPO_PUBLIC_MAP_API_KEY). Without it Android renders a blank grid.
 */
export const useNativeGoogleMaps = hasMapCredentials && Platform.OS !== 'web' && !isExpoGo;

/**
 * Whether a native interactive map can render:
 * - iOS always can (Apple Maps when there is no Google key),
 * - Expo Go ships its own map keys,
 * - Android standalone builds need the Google key.
 */
export const useNativeMap =
  Platform.OS !== 'web' && (hasMapCredentials || Platform.OS === 'ios' || isExpoGo);

/** Interactive map: Google JS on web (needs key); native map per useNativeMap. */
export const useInteractiveMap = Platform.OS === 'web' ? hasMapCredentials : useNativeMap;

if (__DEV__ && Platform.OS === 'android' && !isExpoGo && !hasMapCredentials) {
  // Surfaces the most common "maps not working" cause in dev builds.
  console.warn(
    'EXPO_PUBLIC_MAP_API_KEY is not set for this build: Android maps are disabled. ' +
      'Store it with `eas env:create` (see docs/environment-setup.md).',
  );
}
