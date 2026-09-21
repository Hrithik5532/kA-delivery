/**
 * Public runtime configuration. Values come from EXPO_PUBLIC_* env vars, which
 * Expo inlines at build time. Backend secrets are never present here.
 */
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
  /** Dev default for login + delivery OTP (matches backend DEFAULT_OTP). */
  defaultOtp: process.env.EXPO_PUBLIC_DEFAULT_OTP ?? '1212',
};

/** Whether a real native map should be used (otherwise the dev fallback). */
export const hasMapCredentials =
  config.mapProvider !== 'none' && config.mapApiKey.trim().length > 0;
