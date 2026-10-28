import { useEffect, useMemo, useState } from 'react';
import type { ViewProps } from '@/app/types';
import { useDialog } from '@/components/ui/dialogContext';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/toastContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useInterval } from '@/hooks/useInterval';
import * as api from '@/lib/api';
import { formatBytes } from '@/lib/format';
import type { ContainerSummary } from '@/types/docker';
import { ContainerDetailDrawer } from './components/ContainerDetailDrawer';
import { ContainerRow } from './components/ContainerRow';
import { RunContainerDialog } from './components/RunContainerDialog';
import { performContainerAction, type ContainerAction } from './containerActions';
import { getContainerName, isContainerActive } from './containerUtils';

type ContainerBucket = 'all' | 'running' | 'stopped';
const BUCKETS: ContainerBucket[] = ['all', 'running', 'stopped'];

export function ContainersView({ filter, refreshSignal, setPrimaryAction, onMutated }: ViewProps) {
  const toast = useToast();
  const { confirm } = useDialog();
  const [bucket, setBucket] = useState<ContainerBucket>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runOpen, setRunOpen] = useState(false);

  const { data, error, loading, reload } = useAsyncData(
    () => api.listContainers(true),
    refreshSignal,
  );
  useInterval(() => void reload(true), 4000);

  useEffect(() => {
    setPrimaryAction({ label: 'Run container', icon: 'plus', onClick: () => setRunOpen(true) });
    return () => setPrimaryAction(null);
  }, [setPrimaryAction]);

  const containers = useMemo(() => data ?? [], [data]);
  const rows = useMemo(() => {
    const search = filter.toLowerCase();
    return containers.filter((container) => {
      const active = isContainerActive(container);
      if (bucket === 'running' && !active) return false;
      if (bucket === 'stopped' && active) return false;
      if (!search) return true;

      const searchableText = [
        getContainerName(container),
        container.Image,
        container.Id,
        container.Status,
        container.State,
        JSON.stringify(container.Labels || {}),
      ]
        .join(' ')
        .toLowerCase();
      return searchableText.includes(search);
    });
  }, [containers, bucket, filter]);

  const handleAction = async (action: ContainerAction, container: ContainerSummary) => {
    const changed = await performContainerAction(
      action,
      { Id: container.Id, name: getContainerName(container) },
      { toast, confirm },
    );
    if (changed) {
      void reload(true);
      onMutated?.();
    }
  };

  const handleMutated = () => {
    void reload(true);
    onMutated?.();
  };

  const prune = async () => {
    const confirmed = await confirm({
      title: 'Prune stopped containers',
      message: 'Remove all stopped containers? This cannot be undone.',
      confirmLabel: 'Prune',
    });
    if (!confirmed) return;

    try {
      const result = await api.pruneContainers();
      const count = (result.ContainersDeleted || []).length;
      toast.success(
        `Pruned ${count} container(s), reclaimed ${formatBytes(result.SpaceReclaimed || 0)}`,
      );
      handleMutated();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : String(requestError));
    }
  };

  const runningCount = containers.filter((container) => container.State === 'running').length;

  return (
    <>
      <div className="view-head">
        <div className="toolbar">
          <div className="segmented">
            {BUCKETS.map((value) => (
              <button
                key={value}
                className={bucket === value ? 'is-active' : ''}
                onClick={() => setBucket(value)}
              >
                {value[0].toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn btn--sm" onClick={prune}>
            <Icon name="prune" size={15} />
            <span>Prune stopped</span>
          </button>
        </div>
        <span className="view-head__spacer" />
        <div className="muted nowrap">
          {containers.length} total · {runningCount} running
        </div>
      </div>

      {loading && !data ? (
        <LoadingState label="Loading containers…" />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState
          iconName="container"
          title={containers.length ? 'No containers match' : 'No containers yet'}
          text={
            containers.length
              ? 'Try a different filter or search term.'
              : 'Run a container from an image to get started.'
          }
          action={
            containers.length
              ? null
              : {
                  label: 'Run container',
                  icon: 'plus',
                  onClick: () => setRunOpen(true),
                }
          }
        />
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: '26%' }}>Name</th>
                  <th style={{ width: '20%' }}>Image</th>
                  <th style={{ width: '14%' }}>Status</th>
                  <th style={{ width: '16%' }}>Ports</th>
                  <th style={{ width: '9%' }}>Size</th>
                  <th className="right" style={{ width: '15%' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((container) => (
                  <ContainerRow
                    key={container.Id}
                    container={container}
                    onOpen={() => setSelectedId(container.Id)}
                    onAction={handleAction}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedId && (
        <ContainerDetailDrawer
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={handleMutated}
        />
      )}
      {runOpen && <RunContainerDialog onClose={() => setRunOpen(false)} onDone={handleMutated} />}
    </>
  );
}
