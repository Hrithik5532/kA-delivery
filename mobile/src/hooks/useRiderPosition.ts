import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import type { LatLng } from '@/lib/map-route';

/** One-shot rider position for map previews (offer / pickup screens). */
export function useRiderPosition() {
  const [position, setPosition] = useState<LatLng | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled || status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        // Offer map still works with a synthetic origin offset.
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return position;
}
