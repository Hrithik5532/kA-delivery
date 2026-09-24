import { useEffect, useState } from 'react';

import { config } from '@/config';
import type { LatLng } from '@/lib/map-route';

/** Browser geolocation polled every few seconds for map previews. */
export function useRiderPosition() {
  const [position, setPosition] = useState<LatLng | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    let cancelled = false;
    const apply = (coords: GeolocationCoordinates) => {
      if (cancelled) return;
      if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) return;
      setPosition({ lat: coords.latitude, lng: coords.longitude });
    };

    const tick = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => apply(pos.coords),
        () => {},
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
      );
    };

    tick();
    const timer = setInterval(tick, config.locationIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return position;
}
