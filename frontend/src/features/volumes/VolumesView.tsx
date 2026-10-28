import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ViewProps } from '@/app/types';
import { useDialog } from '@/components/ui/dialogContext';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/toastContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import * as api from '@/lib/api';
import { formatBytes, formatRelativeTime } from '@/lib/format';
import type { VolumeSummary } from '@/types/docker';
import { CreateVolumeDialog, VolumeInspectDialog } from './components/VolumeDialogs';

export function VolumesView({ filter, refreshSignal, setPrimaryAction, onMutated }: ViewProps) {
  const toast = useToast();
  const { confirm } = useDialog();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedVolume, setSelectedVolume] = useState<VolumeSummary | null>(null);
  const loadVolumes = useCallback(async () => (await api.listVolumes()).Volumes || [], []);
  const { data, error, loading, reload } = useAsyncData(loadVolumes, refreshSignal);

  useEffect(() => {
    setPrimaryAction({ label: 'Create volume', icon: 'plus', onClick: () => setCreateOpen(true) });
    return () => setPrimaryAction(null);
  }, [setPrimaryAction]);

  const volumes = useMemo(() => data ?? [], [data]);
  const rows = useMemo(() => {
    const sorted = [...volumes].sort((a, b) => a.Name.localeCompare(b.Name));
    const search = filter.toLowerCase();
    if (!search) return sorted;
    return sorted.filter((volume) =>
      [volume.Name, volume.Driver, volume.Mountpoint].join(' ').toLowerCase().includes(search),
    );
  }, [volumes, filter]);

  const handleMutated = () => {
    void reload(true);
    onMutated?.();
  };

  const remove = async (volume: VolumeSummary) => {
    const confirmed = await confirm({
      title: 'Remove volume',
      message: `Remove volume "${volume.Name}"? Data stored in it will be lost.`,
      details: volume.Mountpoint,
      confirmLabel: 'Remove',
    });
    if (!confirmed) return;

    try {
      await api.removeVolume(volume.Name, { force: true });
      toast.success(`Removed ${volume.Name}`);
      handleMutated();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : String(requestError));
    }
  };

  const prune = async () => {
    const confirmed = await confirm({
      title: 'Prune volumes',
      message: 'Remove all volumes not used by any containers? This cannot be undone.',
      confirmLabel: 'Prune',
    });
    if (!confirmed) return;

    try {
      const result = await api.pruneVolumes();
      toast.success(
        `Pruned ${(result.VolumesDeleted || []).length} volume(s), reclaimed ${formatBytes(result.SpaceReclaimed || 0)}`,
      );
      handleMutated();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : String(requestError));
    }
  };

  return (
    <>
      <div className="view-head">
        <div className="toolbar">
          <button className="btn btn--sm" onClick={() => setCreateOpen(true)}>
            <Icon name="plus" size={15} />
            <span>Create</span>
          </button>
          <button className="btn btn--sm" onClick={prune}>
            <Icon name="prune" size={15} />
            <span>Prune unused</span>
          </button>
        </div>
        <span className="view-head__spacer" />
        <div className="muted nowrap">{volumes.length} volumes</div>
      </div>

      {loading && !data ? (
        <LoadingState label="Loading volumes…" />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState
          iconName="volume"
          title={volumes.length ? 'No volumes match' : 'No volumes yet'}
          text={
            volumes.length
              ? 'Try a different search term.'
              : 'Create a named volume to persist container data.'
          }
          action={{ label: 'Create volume', icon: 'plus', onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: '26%' }}>Name</th>
                  <th style={{ width: '10%' }}>Driver</th>
                  <th style={{ width: '30%' }}>Mountpoint</th>
                  <th style={{ width: '10%' }}>Size</th>
                  <th style={{ width: '8%' }}>Refs</th>
                  <th className="right" style={{ width: '16%' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((volume) => (
                  <tr key={volume.Name}>
                    <td>
                      <div className="name-cell">
                        <div className="name-cell__avatar">
                          <Icon name="volume" size={18} />
                        </div>
                        <div className="name-cell__text">
                          <span
                            className="name-cell__primary"
                            style={{ cursor: 'pointer' }}
                            onClick={() => setSelectedVolume(volume)}
                          >
                            {volume.Name}
                          </span>
                          {volume.Created && (
                            <span className="name-cell__secondary">
                              {formatRelativeTime(volume.Created)}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="tag">{volume.Driver}</span>
                    </td>
                    <td>
                      <span className="cell-mono" title={volume.Mountpoint}>
                        {volume.Mountpoint}
                      </span>
                    </td>
                    <td className="cell-dim nowrap">
                      {volume.UsageData && volume.UsageData.Size >= 0
                        ? formatBytes(volume.UsageData.Size)
                        : '—'}
                    </td>
                    <td className="cell-dim nowrap">
                      {volume.UsageData ? volume.UsageData.RefCount : '—'}
                    </td>
                    <td>
                      <div className="cell-actions">
                        <button
                          className="btn btn--sm btn--icon"
                          title="Inspect"
                          aria-label="Inspect volume"
                          onClick={() => setSelectedVolume(volume)}
                        >
                          <Icon name="inspect" size={16} />
                        </button>
                        <button
                          className="btn btn--sm btn--icon btn--danger"
                          title="Remove"
                          aria-label="Remove volume"
                          onClick={() => remove(volume)}
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {createOpen && (
        <CreateVolumeDialog onClose={() => setCreateOpen(false)} onDone={handleMutated} />
      )}
      {selectedVolume && (
        <VolumeInspectDialog volume={selectedVolume} onClose={() => setSelectedVolume(null)} />
      )}
    </>
  );
}
