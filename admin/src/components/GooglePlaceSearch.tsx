import { useEffect, useRef, useState } from 'react';
import { api } from '@/api/client';
import { config, hasGoogleMaps } from '@/config';
import {
  fetchPlaceDetails,
  fetchPlaceDetailsViaBackend,
  fetchPlaceSuggestions,
  fetchPlaceSuggestionsViaBackend,
  type PlaceSuggestion,
} from '@/lib/google-places';
import { fetchOsmSuggestions, osmPlaceDetails } from '@/lib/osm-places';

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
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingOsm, setUsingOsm] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled) return;
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setError(null);
      setUsingOsm(false);
      return;
    }

    const t = setTimeout(() => {
      setBusy(true);
      setError(null);

      const loadOsm = async () => {
        setUsingOsm(true);
        const items = await fetchOsmSuggestions(q);
        setSuggestions(items);
        setOpen(items.length > 0);
        if (items.length === 0) setError('No places found');
      };

      const run = async () => {
        try {
          const items = await fetchPlaceSuggestionsViaBackend(q, api.placeAutocomplete);
          if (items.length > 0) {
            setUsingOsm(false);
            setSuggestions(items);
            setOpen(true);
            return;
          }
        } catch {
          // Backend proxy unavailable — try browser key, then OSM.
        }

        if (hasGoogleMaps) {
          try {
            const items = await fetchPlaceSuggestions(q, config.googleMapsKey);
            if (items.length > 0) {
              setUsingOsm(false);
              setSuggestions(items);
              setOpen(true);
              return;
            }
          } catch {
            // Browser Places blocked by referrer — fall through to OSM.
          }
        }

        try {
          await loadOsm();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Search failed');
          setSuggestions([]);
          setOpen(false);
        }
      };

      void run().finally(() => setBusy(false));
    }, 280);

    return () => clearTimeout(t);
  }, [query, disabled]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = async (item: PlaceSuggestion) => {
    setBusy(true);
    setError(null);
    try {
      let place;
      if (item.placeId.startsWith('osm:')) {
        place = osmPlaceDetails(item);
      } else if (!usingOsm) {
        try {
          place = await fetchPlaceDetailsViaBackend(item.placeId, api.placeDetails);
        } catch {
          place = await fetchPlaceDetails(item.placeId, config.googleMapsKey);
        }
      } else {
        place = osmPlaceDetails(item);
      }
      onSelect(place);
      setQuery(place.label);
      setOpen(false);
      setSuggestions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load place details');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dm-place-search-wrap" ref={wrapRef}>
      <input
        className="dm-place-search"
        type="search"
        placeholder={placeholder}
        disabled={disabled || busy}
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => { if (suggestions.length) setOpen(true); }}
      />
      {busy && <span className="dm-place-search-hint">Searching…</span>}
      {usingOsm && !busy && <span className="dm-place-search-hint">Using OpenStreetMap fallback</span>}
      {error && <p className="dm-place-search-error">{error}</p>}
      {open && suggestions.length > 0 && (
        <ul className="dm-place-suggestions" role="listbox">
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button type="button" className="dm-place-suggestion" onClick={() => void pick(s)}>
                <strong>{s.label}</strong>
                {s.secondary ? <span>{s.secondary}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
