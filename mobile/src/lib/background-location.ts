/**
 * Battery-friendly background location for the rider app.
 *
 * While the partner is online we keep GPS flowing to ops even when the app is
 * minimized or the screen is locked, using expo-location background updates
 * (Android foreground service + iOS background location). Updates are throttled
 * by time AND distance so a stationary rider posts far less often than a moving
 * one — the "battery-friendly" trade-off (not strictly every 5s when idle).
 *
 * The TaskManager task runs in a headless JS context that does NOT share the
 * in-memory `api` client / auth state, so it reads the token straight from
 * SecureStore and posts with a plain fetch.
 *
 * Requires a custom dev/prod build — background tasks do not run in Expo Go.
 */
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';

import { config } from '@/config';

export const RIDER_LOCATION_TASK = 'rider-location-updates';

/** Must match TOKEN_KEY in src/auth/auth-context.tsx. */
const TOKEN_KEY = 'digimess.token';

async function postFix(loc: Location.LocationObject): Promise<void> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
  if (!token) return;
  try {
    await fetch(`${config.apiUrl}/api/v1/rider/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        accuracy: loc.coords.accuracy ?? undefined,
        heading: loc.coords.heading ?? undefined,
        speed: loc.coords.speed ?? undefined,
        client_timestamp: new Date(loc.timestamp).toISOString(),
      }),
    });
  } catch {
    // Transient network error — the next fix will retry.
  }
}

// Registered at module load (imported from the root layout) so the OS can
// relaunch the task headless. Only the most recent fix in a batch is posted.
TaskManager.defineTask(RIDER_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const latest = locations?.[locations.length - 1];
  if (latest) await postFix(latest);
});

/**
 * Begin background tracking. Returns true when background updates are running,
 * false when unavailable (Expo Go, permission denied) so the caller can fall
 * back to the foreground broadcaster.
 */
export async function startRiderBackgroundLocation(): Promise<boolean> {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return false;

    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') return false;

    const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(RIDER_LOCATION_TASK).catch(
      () => false,
    );
    if (alreadyRunning) return true;

    await Location.startLocationUpdatesAsync(RIDER_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: config.locationIntervalMs, // Android: ~5s between fixes while moving
      distanceInterval: config.locationDistanceM, // battery-friendly: skip fixes under ~30m
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true, // iOS status-bar indicator
      foregroundService: {
        notificationTitle: 'Khana Delivery — Online',
        notificationBody: 'Sharing your live location with ops while you are online.',
        notificationColor: '#5B3DF5',
      },
    });
    return true;
  } catch {
    // Not supported in this runtime (e.g. Expo Go) — caller falls back to foreground.
    return false;
  }
}

export async function stopRiderBackgroundLocation(): Promise<void> {
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(RIDER_LOCATION_TASK).catch(
      () => false,
    );
    if (running) await Location.stopLocationUpdatesAsync(RIDER_LOCATION_TASK);
  } catch {
    // Nothing to stop.
  }
}
