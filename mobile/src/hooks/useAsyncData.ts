import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/api/client';

export function useAsyncData<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      setData(await fetcher());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, deps);

  useEffect(() => { void load(); }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load(true);
  }, [load]);

  return { data, loading, error, refreshing, refresh, reload: () => load() };
}
