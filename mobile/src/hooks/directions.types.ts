import type { LatLng } from '@/lib/map-route';

export interface DirectionsResult {
  route: LatLng[];
  distanceKm: number | null;
  durationMinutes: number | null;
  source: 'google' | 'straight' | 'idle';
}
