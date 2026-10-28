import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncData<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  reload: (silent?: boolean) => Promise<void>;
}

/**
 * Loads asynchronous data and exposes a consistent loading/error/reload API.
 *
 * `refreshKey` can be a view refresh counter or a resource id. Changing it
 * runs the loader again. Outdated responses are ignored, which prevents a
 * slow previous request from overwriting newer data.
 */
export function useAsyncData<T>(
  loader: () => Promise<T>,
  refreshKey: string | number = 0,
): AsyncData<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const loaderRef = useRef(loader);
  const latestRequest = useRef(0);

  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  const reload = useCallback(async (silent = false) => {
    const requestId = ++latestRequest.current;
    if (!silent) setLoading(true);

    try {
      const result = await loaderRef.current();
      if (requestId !== latestRequest.current) return;
      setData(result);
      setError(null);
    } catch (requestError) {
      if (requestId === latestRequest.current) setError(requestError);
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    return () => {
      latestRequest.current += 1;
    };
  }, [reload, refreshKey]);

  return { data, error, loading, reload };
}
