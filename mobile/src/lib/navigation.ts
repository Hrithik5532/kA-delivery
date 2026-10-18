/** External turn-by-turn navigation via the device's Google Maps app / browser. */
import { Linking } from 'react-native';
import type { LatLng } from '@/lib/map-route';

/**
 * Open driving directions to `dest` in Google Maps. Uses the cross-platform
 * universal URL (`dir_action=navigate` launches straight into turn-by-turn when
 * the Google Maps app is installed, and falls back to the browser otherwise).
 * Returns false if the coordinates are invalid or nothing can handle the URL.
 */
export async function openDirections(dest: LatLng): Promise<boolean> {
  if (!Number.isFinite(dest.lat) || !Number.isFinite(dest.lng)) return false;
  const url =
    'https://www.google.com/maps/dir/?api=1' +
    `&destination=${dest.lat},${dest.lng}` +
    '&travelmode=driving&dir_action=navigate';
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
