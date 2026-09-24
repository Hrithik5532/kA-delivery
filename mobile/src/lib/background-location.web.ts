/**
 * Web stub — browsers have no background location task. Web falls back to the
 * foreground broadcaster in rider-location.web.ts.
 */
export const RIDER_LOCATION_TASK = 'rider-location-updates';

export async function startRiderBackgroundLocation(): Promise<boolean> {
  return false;
}

export async function stopRiderBackgroundLocation(): Promise<void> {
  // no-op on web
}
