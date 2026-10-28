import { useCallback, useEffect } from 'react';
import type { ViewProps } from '@/app/types';
import { KeyValueList } from '@/components/ui/DataDisplay';
import { ErrorState, LoadingState } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/toastContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import * as api from '@/lib/api';
import { copyText } from '@/lib/browser';
import { formatBytes } from '@/lib/format';
import { LiveEvents } from './components/LiveEvents';

export function SystemView({ refreshSignal, setPrimaryAction }: ViewProps) {
  const toast = useToast();
  const loadEngine = useCallback(async () => {
    const [info, version] = await Promise.all([api.info(), api.version()]);
    return { info, version };
  }, []);
  const { data, error, loading, reload } = useAsyncData(loadEngine, refreshSignal);

  useEffect(() => {
    setPrimaryAction(null);
  }, [setPrimaryAction]);

  if (loading && !data) return <LoadingState label="Loading engine details…" />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const { info, version } = data;
  const jsonText = JSON.stringify(info, null, 2);
  const copyInfo = async () => {
    const copied = await copyText(jsonText);
    if (copied) toast.success('Copied');
    else toast.error('Copy failed');
  };

  return (
    <>
      <div className="panel">
        <div className="panel__head">
          <span className="panel__title">
            <Icon name="whale" size={16} /> Engine
          </span>
          <span style={{ flex: 1 }} />
          <button className="btn btn--sm" onClick={copyInfo}>
            <Icon name="copy" size={15} />
            <span>Copy info JSON</span>
          </button>
        </div>
        <div className="panel__body">
          <KeyValueList
            pairs={[
              ['Name', info.Name || '—'],
              ['Server version', version?.Version || info.ServerVersion || '—'],
              ['API version', version?.ApiVersion || '—'],
              ['Min API version', version?.MinAPIVersion || '—'],
              ['OS / Type', [info.OperatingSystem, info.OSType].filter(Boolean).join(' · ') || '—'],
              ['Architecture', info.Architecture || '—'],
              ['Kernel version', info.KernelVersion || '—'],
              ['CPUs', info.NCPU ? String(info.NCPU) : '—'],
              ['Total memory', info.MemTotal ? formatBytes(info.MemTotal) : '—'],
              ['Storage driver', info.Driver || '—'],
              ['Docker root dir', <span className="mono">{info.DockerRootDir || '—'}</span>],
              [
                'Containers',
                `${info.Containers ?? '—'} (${info.ContainersRunning ?? 0} running, ${info.ContainersPaused ?? 0} paused, ${info.ContainersStopped ?? 0} stopped)`,
              ],
              ['Images', String(info.Images ?? '—')],
              ['System time', info.SystemTime || '—'],
            ]}
          />
        </div>
      </div>

      <LiveEvents />

      <div className="panel">
        <div className="panel__head">
          <span className="panel__title">
            <Icon name="inspect" size={16} /> Raw engine info
          </span>
        </div>
        <div className="panel__body" style={{ padding: 0 }}>
          <pre className="log-viewer" style={{ minHeight: 200, border: 0, borderRadius: 0 }}>
            {jsonText}
          </pre>
        </div>
      </div>
    </>
  );
}
