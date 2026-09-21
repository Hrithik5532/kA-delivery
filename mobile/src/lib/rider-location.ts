/**
 * Rider location broadcaster. Only runs while `active` (online with an active
 * delivery). Requests foreground permission, watches position at the configured
 * interval/distance, and posts each fix to the backend, which independently
 * validates ownership, freshness and plausibility.
 *
 * Foreground only: OS background-execution limits are documented in
 * docs/implementation-status.md; continuous background tracking is out of scope.
 */
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';

import { api, ApiError } from '@/api/client';
import { config } from '@/config';

export type LocationStatus =
  | 'idle'
  | 'requesting'
  | 'denied'
  | 'tracking'
  | 'error';

export function useRiderLocationBroadcast(active: boolean) {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let cancelled = false;

    const stop = () => {
      if (subRef.current) {
        subRef.current.remove();
        subRef.current = null;
      }
    };

    const start = async () => {
      setStatus('requesting');
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (perm !== 'granted') {
        setStatus('denied');
        return;
      }
      try {
        subRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: config.locationIntervalMs,
            distanceInterval: config.locationDistanceM,
          },
          async (pos) => {
            try {
              await api.postLocation({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy ?? undefined,
                heading: pos.coords.heading ?? undefined,
                speed: pos.coords.speed ?? undefined,
                client_timestamp: new Date(pos.timestamp).toISOString(),
              });
              setLastError(null);
            } catch (err) {
              // A rejected fix (e.g. stale/implausible) is not fatal; keep going.
              if (err instanceof ApiError) setLastError(err.message);
            }
          }
        );
        if (cancelled) {
          stop();
          return;
        }
        setStatus('tracking');
      } catch (err) {
        setStatus('error');
        setLastError(err instanceof Error ? err.message : 'Location error');
      }
    };

    if (active) {
      void start();
    } else {
      stop();
      setStatus('idle');
    }

    return () => {
      cancelled = true;
      stop();
    };
  }, [active]);

  return { status, lastError };
}
