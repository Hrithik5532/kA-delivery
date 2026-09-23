import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { fetchOsrmDirections } from '@/lib/osrm-directions.web';
import { interpolateRoute, type LatLng } from '@/lib/map-route';
import type { DirectionsResult } from '@/hooks/directions.types';

function straightFallback(origin: LatLng, destination: LatLng): LatLng[] {
  return [origin, ...interpolateRoute(origin, destination, 8), destination];
}

function isRoadRoute(points: LatLng[] | undefined, source: string | undefined) {
  return source === 'google' && !!points && points.length > 2;
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

    const apply = (points: LatLng[], meters: number | null, seconds: number | null, src: DirectionsResult['source']) => {
      setRoute(points);
      setDistanceKm(meters != null ? meters / 1000 : null);
      setDurationMinutes(seconds != null ? Math.round(seconds / 60) : null);
      setSource(src);
    };

    const run = async () => {
      let backendPoints: LatLng[] | undefined;
      let backendSource: string | undefined;

      try {
        const res = await api.directions(origin.lat, origin.lng, destination.lat, destination.lng);
        if (cancelled) return;
        backendPoints = res.points;
        backendSource = res.source;
        if (isRoadRoute(res.points, res.source)) {
          apply(res.points, res.distance_meters, res.duration_seconds, 'google');
          return;
        }
      } catch {
        // Production may not expose /maps/directions yet.
      }

      try {
        const osrm = await fetchOsrmDirections(origin, destination);
        if (cancelled) return;
        if (osrm.points.length > 2) {
          apply(osrm.points, osrm.distance_meters, osrm.duration_seconds, 'google');
          return;
        }
      } catch {
        // Fall through to straight line.
      }

      if (cancelled) return;

      if (backendPoints?.length) {
        apply(
          backendPoints,
          null,
          null,
          backendSource === 'google' ? 'google' : 'straight',
        );
        return;
      }

      apply(straightFallback(origin, destination), null, null, 'straight');
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  return { route, distanceKm, durationMinutes, source };
}
