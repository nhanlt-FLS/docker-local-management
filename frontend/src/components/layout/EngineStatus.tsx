import { useCallback } from 'react';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useInterval } from '@/hooks/useInterval';
import * as api from '@/lib/api';

interface EngineStatusData {
  online: boolean;
  description: string;
}

export function EngineStatus() {
  const loadStatus = useCallback(async (): Promise<EngineStatusData> => {
    const health = await api.health();
    if (!health.ok) return { online: false, description: 'Daemon unreachable' };

    const version = await api.version().catch(() => null);
    return {
      online: true,
      description: version
        ? `Engine ${version.Version} · API ${version.ApiVersion}`
        : 'Engine online',
    };
  }, []);

  const { data, error, loading, reload } = useAsyncData(loadStatus);
  useInterval(() => void reload(true), 10000);

  const state = loading && !data ? 'connecting' : data?.online ? 'up' : 'down';
  const label =
    state === 'up' ? 'Engine running' : state === 'down' ? 'Engine down' : 'Connecting…';
  const description = error ? 'Backend offline' : (data?.description ?? '—');

  return (
    <div
      className={`engine ${state === 'up' ? 'is-up' : state === 'down' ? 'is-down' : ''}`}
      id="engine-pill"
    >
      <span className="engine__dot" />
      <div className="engine__meta">
        <span className="engine__state">{label}</span>
        <span className="engine__sub">{description}</span>
      </div>
    </div>
  );
}
