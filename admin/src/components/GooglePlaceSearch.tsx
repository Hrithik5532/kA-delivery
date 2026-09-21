import { Autocomplete } from '@react-google-maps/api';
import { useRef } from 'react';
import { hasGoogleMaps } from '@/config';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';

export interface PlaceSelection {
  lat: number;
  lng: number;
  label: string;
  address: string;
}

export function GooglePlaceSearch({
  placeholder,
  onSelect,
  disabled,
}: {
  placeholder: string;
  onSelect: (place: PlaceSelection) => void;
  disabled?: boolean;
}) {
  const acRef = useRef<google.maps.places.Autocomplete | null>(null);
  const { isLoaded, loadError } = useGoogleMaps();

  if (!hasGoogleMaps) {
    return (
      <input className="dm-place-search" placeholder="Add VITE_GOOGLE_MAPS_KEY to enable place search" disabled />
    );
  }

  if (loadError) {
    return <input className="dm-place-search" placeholder="Google Places failed to load" disabled />;
  }

  if (!isLoaded) {
    return <input className="dm-place-search" placeholder="Loading Google Places…" disabled />;
  }

  return (
    <Autocomplete
      onLoad={(ac) => { acRef.current = ac; }}
      onPlaceChanged={() => {
        const place = acRef.current?.getPlace();
        const loc = place?.geometry?.location;
        if (!loc) return;
        onSelect({
          lat: loc.lat(),
          lng: loc.lng(),
          label: place.name ?? place.formatted_address ?? 'Selected place',
          address: place.formatted_address ?? '',
        });
      }}
      options={{
        componentRestrictions: { country: 'in' },
        fields: ['name', 'formatted_address', 'geometry', 'place_id'],
      }}
    >
      <input
        className="dm-place-search"
        type="search"
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
    </Autocomplete>
  );
}
