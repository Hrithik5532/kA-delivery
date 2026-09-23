import { useJsApiLoader } from '@react-google-maps/api';
import { config } from '@/config';

export function useGoogleMaps() {
  return useJsApiLoader({
    id: 'digimess-google-maps',
    googleMapsApiKey: config.googleMapsKey,
    version: 'weekly',
  });
}
