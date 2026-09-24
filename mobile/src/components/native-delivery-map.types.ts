import type { StyleProp, ViewStyle } from 'react-native';
import type { LatLng } from '@/lib/map-route';
import type { TrackerMarkerKind } from '@/components/DeliveryTrackerMap';

export interface NativeMapMarker {
  lat: number;
  lng: number;
  title?: string;
  pinColor?: string;
  kind?: TrackerMarkerKind;
}

export interface NativeDeliveryMapProps {
  route: LatLng[];
  markers: NativeMapMarker[];
  style?: StyleProp<ViewStyle>;
  onMapReady?: (fit: () => void) => void;
}
