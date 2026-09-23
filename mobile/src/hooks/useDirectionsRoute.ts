import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { DirectionsResult } from '@/hooks/directions.types';
import { interpolateRoute, type LatLng } from '@/lib/map-route';

export type { DirectionsResult } from '@/hooks/directions.types';

function straightFallback(origin: LatLng, destination: LatLng): LatLng[] {
  return [origin, ...interpolateRoute(origin, destination, 8), destination];
}

export function useDirectionsRoute(
  origin: LatLng | null,
  destination: LatLng | null,
  enabled = true,
): DirectionsResult {
  const [route, setRoute] = useState<LatLng[]>([]);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [source, setSource] = useState<DirectionsResult['source']>('idle');

  useEffect(() => {
    if (!enabled || !origin || !destination) {
      setRoute([]);
      setDistanceKm(null);
      setDurationMinutes(null);
      setSource('idle');
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const res = await api.directions(origin.lat, origin.lng, destination.lat, destination.lng);
        if (cancelled) return;
        setRoute(res.points);
        setDistanceKm(res.distance_meters != null ? res.distance_meters / 1000 : null);
        setDurationMinutes(res.duration_seconds != null ? Math.round(res.duration_seconds / 60) : null);
        setSource(res.source === 'google' ? 'google' : 'straight');
      } catch {
        if (cancelled) return;
        setRoute(straightFallback(origin, destination));
        setDistanceKm(null);
        setDurationMinutes(null);
        setSource('straight');
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  return { route, distanceKm, durationMinutes, source };
}
