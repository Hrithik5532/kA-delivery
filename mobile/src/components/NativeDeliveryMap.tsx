import type { NativeDeliveryMapProps } from './native-delivery-map.types';

export type { NativeMapMarker } from './native-delivery-map.types';

/** Web build uses static map images; native map is iOS/Android only. */
export function NativeDeliveryMap(_props: NativeDeliveryMapProps) {
  return null;
}
