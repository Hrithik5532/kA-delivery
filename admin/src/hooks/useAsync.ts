import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';

/** Loads async data on mount, with optional polling. Keeps last data on error
 * (so the UI can show a stale banner instead of going blank). */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], pollMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const load = useCallback(async () => {
    try {
      const d = await fnRef.current();
      setData(d);
      setError(null);
      setStale(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
      setStale(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    setLoading(true);
    void load();
    if (pollMs) {
      const t = setInterval(load, pollMs);
      return () => clearInterval(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, pollMs]);

  return { data, loading, error, stale, reload: load };
}
