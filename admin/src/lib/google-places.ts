export interface PlaceSuggestion {
  placeId: string;
  label: string;
  secondary?: string;
  lat?: number;
  lng?: number;
}

export interface PlaceDetails {
  lat: number;
  lng: number;
  label: string;
  address: string;
}

interface AutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
}

interface PlaceDetailsResponse {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
}

function parseApiError(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const err = (body as { error?: { message?: string; status?: string } }).error;
    if (err?.message) return err.message;
    if (err?.status) return err.status;
  }
  return `Places API request failed (${status})`;
}

function mapBackendSuggestions(rows: Array<{ place_id: string; label: string; secondary?: string | null }>): PlaceSuggestion[] {
  return rows.map((r) => ({
    placeId: r.place_id,
    label: r.label,
    secondary: r.secondary ?? undefined,
  }));
}

/** Prefer backend proxy (server key, no browser referrer limits). */
export async function fetchPlaceSuggestionsViaBackend(
  input: string,
  backendSearch: (q: string) => Promise<Array<{ place_id: string; label: string; secondary?: string | null }>>,
): Promise<PlaceSuggestion[]> {
  const q = input.trim();
  if (q.length < 2) return [];
  const rows = await backendSearch(q);
  return mapBackendSuggestions(rows);
}

export async function fetchPlaceDetailsViaBackend(
  placeId: string,
  backendDetails: (id: string) => Promise<{ lat: number; lng: number; label: string; address: string }>,
): Promise<PlaceDetails> {
  return backendDetails(placeId);
}

export async function fetchPlaceSuggestions(input: string, apiKey: string): Promise<PlaceSuggestion[]> {
  const q = input.trim();
  if (!apiKey || q.length < 2) return [];

  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
    },
    body: JSON.stringify({
      input: q,
      includedRegionCodes: ['in'],
      languageCode: 'en',
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseApiError(body, res.status));

  const suggestions = (body as AutocompleteResponse).suggestions ?? [];
  return suggestions
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .map((p) => ({
      placeId: p!.placeId ?? '',
      label: p!.structuredFormat?.mainText?.text ?? p!.text?.text ?? 'Place',
      secondary: p!.structuredFormat?.secondaryText?.text,
    }))
    .filter((s) => s.placeId);
}

export async function fetchPlaceDetails(placeId: string, apiKey: string): Promise<PlaceDetails> {
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'displayName,formattedAddress,location',
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseApiError(body, res.status));

  const place = body as PlaceDetailsResponse;
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;
  if (lat == null || lng == null) throw new Error('Selected place has no coordinates');

  return {
    lat,
    lng,
    label: place.displayName?.text ?? 'Selected place',
    address: place.formattedAddress ?? '',
  };
}
