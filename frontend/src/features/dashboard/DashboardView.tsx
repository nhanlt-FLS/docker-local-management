import { useCallback, useEffect, useState } from 'react';
import type { ViewProps } from '@/app/types';
import { KeyValueList, StatusPill } from '@/components/ui/DataDisplay';
import { LoadingState } from '@/components/ui/Feedback';
import { Icon, type IconName } from '@/components/ui/Icon';
import { DiskUsageChart, type DiskUsageEntry } from './components/DiskUsageChart';
import { DiskCleanupDialog } from './components/DiskCleanupDialog';
import { RunContainerDialog } from '@/features/containers/components/RunContainerDialog';
import { getContainerName } from '@/features/containers/containerUtils';
import { useAsyncData } from '@/hooks/useAsyncData';
import * as api from '@/lib/api';
import { formatBytes } from '@/lib/format';
import type {
  ContainerSummary,
  DiskUsage,
  ImageSummary,
  InfoResponse,
  NetworkSummary,
  VersionResponse,
  VolumeSummary,
} from '@/types/docker';

interface DashboardData {
  info: InfoResponse | null;
  version: VersionResponse | null;
  containers: ContainerSummary[];
  images: ImageSummary[];
  volumes: VolumeSummary[];
  networks: NetworkSummary[];
}

export function DashboardView({ refreshSignal, setPrimaryAction, onMutated, navigate }: ViewProps) {
  const [runOpen, setRunOpen] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  // /system/df is deliberately left out of this batch: the daemon walks the
  // whole storage to compute it (seconds), and that must not gate first
  // paint. It is loaded separately below and fills in the disk panel.
  const loadDashboard = useCallback(async (): Promise<DashboardData> => {
    const [info, version, containers, images, volumes, networks] = await Promise.all([
      api.info().catch(() => null),
      api.version().catch(() => null),
      api.listContainers(true, false).catch(() => [] as ContainerSummary[]),
      api.listImages().catch(() => [] as ImageSummary[]),
      api
        .listVolumes()
        .then((response) => response.Volumes || [])
        .catch(() => [] as VolumeSummary[]),
      api.listNetworks().catch(() => [] as NetworkSummary[]),
    ]);
    return { info, version, containers, images, volumes, networks };
  }, []);
  const { data, loading, reload } = useAsyncData(loadDashboard, refreshSignal);
  const { data: diskUsage, loading: diskLoading, reload: reloadDiskUsage } = useAsyncData<
    DiskUsage | null
  >(() => api.diskUsage().catch(() => null), refreshSignal);

  useEffect(() => {
    setPrimaryAction({ label: 'Run container', icon: 'plus', onClick: () => setRunOpen(true) });
    return () => setPrimaryAction(null);
  }, [setPrimaryAction]);

  if (loading && !data) return <LoadingState label="Loading engine overview…" />;
  if (!data) return null;

  const running =
    data.info?.ContainersRunning ??
    data.containers.filter((container) => container.State === 'running').length;
  const totalContainers = data.info?.Containers ?? data.containers.length;
  const totalImages = data.info?.Images ?? data.images.length;
  const imagesSize = diskUsage?.LayersSize || 0;
  const containersSize = (diskUsage?.Containers || []).reduce(
    (total, container) => total + (container.SizeRw || 0),
    0,
  );
  const volumesSize = data.volumes.reduce(
    (total, volume) =>
      total + (volume.UsageData && volume.UsageData.Size >= 0 ? volume.UsageData.Size : 0),
    0,
  );
  const buildCacheSize = (diskUsage?.BuildCache || []).reduce(
    (total: number, item) => total + ((item as { Size?: number }).Size || 0),
    0,
  );
  const diskTotalBytes = imagesSize + containersSize + volumesSize + buildCacheSize;
  const runningContainers = data.containers
    .filter((container) => container.State === 'running')
    .slice(0, 6);
  const diskRows: DiskUsageEntry[] = [
    { label: 'Images', iconName: 'image', value: imagesSize, color: '#2b81dc', view: 'images' },
    {
      label: 'Containers',
      iconName: 'container',
      value: containersSize,
      color: '#2ecc71',
      view: 'containers',
    },
    { label: 'Volumes', iconName: 'volume', value: volumesSize, color: '#8b5cf6', view: 'volumes' },
    { label: 'Build cache', iconName: 'layers', value: buildCacheSize, color: '#f1c40f', view: null },
  ];

  const handleContainerCreated = () => {
    void reload(true);
    void reloadDiskUsage(true);
    onMutated?.();
  };

  return (
    <>
      <div className="stat-grid">
        <StatCard
          label="Containers"
          value={String(totalContainers)}
          hint={`${running} running`}
          iconName="container"
          accent={running ? 'var(--green)' : undefined}
          onClick={() => navigate('containers')}
        />
        <StatCard
          label="Images"
          value={String(totalImages)}
          hint={diskUsage ? `${formatBytes(imagesSize)} on disk` : 'measuring…'}
          iconName="image"
          onClick={() => navigate('images')}
        />
        <StatCard
          label="Volumes"
          value={String(data.volumes.length)}
          hint={`${formatBytes(volumesSize)} used`}
          iconName="volume"
          onClick={() => navigate('volumes')}
        />
        <StatCard
          label="Networks"
          value={String(data.networks.length)}
          hint="across all drivers"
          iconName="network"
          onClick={() => navigate('networks')}
        />
      </div>

      <div className="panel">
        <div className="panel__head">
          <span className="panel__title">
            <Icon name="disk" size={16} /> Disk usage
          </span>
          <span className="spacer" style={{ flex: 1 }} />
          <button className="btn btn--sm" onClick={() => setCleanupOpen(true)}>
            <Icon name="prune" size={14} />
            <span>Clean up</span>
          </button>
          <span className="muted">
            {diskUsage ? `${formatBytes(diskTotalBytes)} total` : 'measuring…'}
          </span>
        </div>
        {diskLoading && !diskUsage ? (
          <div className="panel__body">
            <LoadingState label="Measuring disk usage…" />
          </div>
        ) : (
          <DiskUsageChart entries={diskRows} total={diskTotalBytes} onNavigate={navigate} />
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 18,
        }}
      >
        <div className="panel">
          <div className="panel__head">
            <span className="panel__title">
              <Icon name="whale" size={16} /> Engine
            </span>
          </div>
          <div className="panel__body">
            <KeyValueList
              pairs={[
                ['Server version', data.version?.Version || data.info?.ServerVersion || '—'],
                ['API version', data.version?.ApiVersion || '—'],
                [
                  'OS / Arch',
                  [data.info?.OperatingSystem, data.info?.Architecture]
                    .filter(Boolean)
                    .join(' · ') || '—',
                ],
                ['Kernel', data.info?.KernelVersion || '—'],
                ['CPUs', data.info?.NCPU ? String(data.info.NCPU) : '—'],
                ['Memory', data.info?.MemTotal ? formatBytes(data.info.MemTotal) : '—'],
                ['Storage driver', data.info?.Driver || '—'],
                ['Docker root', data.info?.DockerRootDir || '—'],
              ]}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <span className="panel__title">
              <Icon name="play" size={16} /> Running containers
            </span>
            <span className="spacer" style={{ flex: 1 }} />
            <button className="btn btn--sm" onClick={() => navigate('containers')}>
              View all
            </button>
          </div>
          <div className="panel__body" style={{ padding: 0 }}>
            {runningContainers.length === 0 ? (
              <div className="empty" style={{ padding: '34px 16px' }}>
                <div className="empty__title">Nothing running</div>
                <div className="empty__text">Start a container to see it here.</div>
              </div>
            ) : (
              <table className="data">
                <tbody>
                  {runningContainers.map((container) => (
                    <tr
                      key={container.Id}
                      className="row-clickable"
                      onClick={() => navigate('containers')}
                    >
                      <td>
                        <div className="name-cell">
                          <div
                            className="name-cell__avatar"
                            style={{ background: 'var(--green-soft)', color: '#7ee2a8' }}
                          >
                            <Icon name="container" size={16} />
                          </div>
                          <div className="name-cell__text">
                            <span className="name-cell__primary">
                              {getContainerName(container)}
                            </span>
                            <span className="name-cell__secondary">{container.Image}</span>
                          </div>
                        </div>
                      </td>
                      <td className="right">
                        <StatusPill state={container.State} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {runOpen && (
        <RunContainerDialog onClose={() => setRunOpen(false)} onDone={handleContainerCreated} />
      )}
      {cleanupOpen && (
        <DiskCleanupDialog
          diskUsage={diskUsage}
          onClose={() => setCleanupOpen(false)}
          onDone={() => {
            void reload(true);
            void reloadDiskUsage(true);
            onMutated?.();
          }}
        />
      )}
    </>
  );
}

function StatCard({
  label,
  value,
  hint,
  iconName,
  accent,
  onClick,
}: {
  label: string;
  value: string;
  hint: string;
  iconName: IconName;
  accent?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className="stat-card"
      style={{ cursor: onClick ? 'pointer' : undefined }}
      onClick={onClick}
    >
      <span className="stat-card__icon" style={accent ? { color: accent } : undefined}>
        <Icon name={iconName} size={26} />
      </span>
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      <div className="stat-card__hint">{hint}</div>
    </div>
  );
}
