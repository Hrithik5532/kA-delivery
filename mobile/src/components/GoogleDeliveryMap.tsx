import type { StyleProp, ViewStyle } from 'react-native';
import type { LatLng } from '@/lib/map-route';
import type { NativeMapMarker } from './native-delivery-map.types';

/** Native builds use NativeDeliveryMap; web uses GoogleDeliveryMap.web.tsx */
export function GoogleDeliveryMap(_props: {
  route: LatLng[];
  markers: NativeMapMarker[];
  style?: StyleProp<ViewStyle>;
}) {
  return null;
}
