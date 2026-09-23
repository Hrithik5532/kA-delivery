import { useEffect, useState } from 'react';

type GoogleMapsGlobal = {
  maps: {
    Map: new (el: HTMLElement, opts?: Record<string, unknown>) => {
      fitBounds: (bounds: unknown, padding?: number | Record<string, number>) => void;
    };
    LatLngBounds: new () => { extend: (point: { lat: number; lng: number }) => unknown };
    Polyline: new (opts?: Record<string, unknown>) => {
      setMap: (map: unknown | null) => void;
      setPath: (path: Array<{ lat: number; lng: number }>) => void;
    };
    Marker: new (opts?: Record<string, unknown>) => { setMap: (map: unknown | null) => void };
    SymbolPath: { CIRCLE: unknown };
  };
};

declare const google: GoogleMapsGlobal;

let loadPromise: Promise<void> | null = null;

export function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (typeof google !== 'undefined' && google.maps?.Map) return Promise.resolve();

  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-digimess-gmaps]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')));
        return;
      }

      const script = document.createElement('script');
      script.dataset.digimessGmaps = '1';
      script.async = true;
      script.defer = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Google Maps failed to load'));
      document.head.appendChild(script);
    });
  }

  return loadPromise;
}

export function useGoogleMapsScript(apiKey: string) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!apiKey.trim()) {
      setReady(false);
      setError(new Error('Missing map API key'));
      return;
    }

    let cancelled = false;
    void loadGoogleMapsScript(apiKey)
      .then(() => {
        if (!cancelled) {
          setReady(true);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setReady(false);
          setError(err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  return { ready, error };
}
