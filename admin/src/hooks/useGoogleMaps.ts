import { useJsApiLoader, type Libraries } from '@react-google-maps/api';
import { config } from '@/config';

export const GOOGLE_MAPS_LIBRARIES: Libraries = ['places'];

export function useGoogleMaps() {
  return useJsApiLoader({
    id: 'digimess-google-maps',
    googleMapsApiKey: config.googleMapsKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
}
