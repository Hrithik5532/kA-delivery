import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import { GoogleDeliveryMap } from '@/components/GoogleDeliveryMap';
import { NativeDeliveryMap } from '@/components/NativeDeliveryMap';
import { hasMapCredentials, useNativeMap } from '@/config';
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
  if (Platform.OS === 'web') {
    if (!hasMapCredentials) return null;
    return <GoogleDeliveryMap route={route} markers={markers} style={style} onMapReady={onMapReady} />;
  }

  if (!useNativeMap) return null;
  return <NativeDeliveryMap route={route} markers={markers} style={style} onMapReady={onMapReady} />;
}
