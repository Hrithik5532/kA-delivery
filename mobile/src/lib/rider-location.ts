/**
 * Rider location broadcaster. Runs while the partner is online (idle or on trip).
 * Posts GPS on a fixed interval so ops can see live positions on the admin map.
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

async function postFix(pos: Location.LocationObject) {
  await api.postLocation({
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? undefined,
    heading: pos.coords.heading ?? undefined,
    speed: pos.coords.speed ?? undefined,
    client_timestamp: new Date(pos.timestamp).toISOString(),
  });
}

export function useRiderLocationBroadcast(active: boolean) {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const stop = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    const tick = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (cancelled) return;
        await postFix(pos);
        setLastError(null);
        setStatus('tracking');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) setLastError(err.message);
      } finally {
        inFlightRef.current = false;
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
      await tick();
      if (cancelled) return;
      timerRef.current = setInterval(() => { void tick(); }, config.locationIntervalMs);
      setStatus('tracking');
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
