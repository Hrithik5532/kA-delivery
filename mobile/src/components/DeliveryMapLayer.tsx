import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import { GoogleDeliveryMap } from '@/components/GoogleDeliveryMap';
import { NativeDeliveryMap } from '@/components/NativeDeliveryMap';
import { hasMapCredentials } from '@/config';
import type { LatLng } from '@/lib/map-route';
import type { NativeMapMarker } from './native-delivery-map.types';

export function DeliveryMapLayer({
  route,
  markers,
  style,
  onMapReady,
}: {
  route: LatLng[];
  markers: NativeMapMarker[];
  style?: StyleProp<ViewStyle>;
  onMapReady?: (fit: () => void) => void;
}) {
  if (!hasMapCredentials) return null;

  if (Platform.OS === 'web') {
    return <GoogleDeliveryMap route={route} markers={markers} style={style} />;
  }

  return <NativeDeliveryMap route={route} markers={markers} style={style} onMapReady={onMapReady} />;
}
