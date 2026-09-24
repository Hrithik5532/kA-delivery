import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { config } from '@/config';
import type { LatLng } from '@/lib/map-route';

/** Rider position polled every few seconds for map previews (offer / pickup / active). */
export function useRiderPosition() {
  const [position, setPosition] = useState<LatLng | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (cancelled || status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        // Offer map still works with a synthetic origin offset.
      }
    };

    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled || status !== 'granted') return;
      await tick();
      if (!cancelled) {
        timer = setInterval(() => { void tick(); }, config.locationIntervalMs);
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  return position;
}
