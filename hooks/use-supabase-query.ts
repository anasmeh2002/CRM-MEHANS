'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

type Fetcher<T> = () => Promise<T>;

export function useSupabaseQuery<T>(fetcher: Fetcher<T>, deps: unknown[] = [], refreshKey?: number) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (mountedRef.current) setData(result);
    } catch (err: unknown) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'Unable to load data from the database.';
        setError(message);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    refetch();
    return () => { mountedRef.current = false; };
  }, [refetch, refreshKey]);

  return { data, loading, error, refetch, setData };
}
