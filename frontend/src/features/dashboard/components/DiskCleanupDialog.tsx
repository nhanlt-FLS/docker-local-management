import { useMemo, useState } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/toastContext';
import * as api from '@/lib/api';
import { formatBytes } from '@/lib/format';
import type { DiskUsage, PruneResponse } from '@/types/docker';

interface CleanupTarget {
  id: string;
  label: string;
  description: string;
  iconName: IconName;
  count: number | null;
  /** Estimated reclaimable bytes; null when the daemon reports no size. */
  estimate: number | null;
  dangerous?: boolean;
  run: () => Promise<PruneResponse>;
}

interface DiskCleanupDialogProps {
  diskUsage: DiskUsage | null;
  onClose: () => void;
  onDone: () => void;
}

/**
 * Offers prune operations for unused Docker resources with per-target
 * reclaimable-space estimates derived from the last /system/df scan.
 * Safe targets are preselected; data-destroying ones (volumes) are not.
 */
export function DiskCleanupDialog({ diskUsage, onClose, onDone }: DiskCleanupDialogProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({
    containers: true,
    images: true,
    cache: true,
  });

  const targets = useMemo<CleanupTarget[]>(() => {
    const stopped = (diskUsage?.Containers || []).filter((c) => c.State !== 'running');
    const dangling = (diskUsage?.Images || []).filter(
      (image) => !image.RepoTags || image.RepoTags.length === 0,
    );
    const unusedVolumes = (diskUsage?.Volumes || []).filter(
      (volume) => (volume.UsageData?.RefCount ?? 0) === 0,
    );
    const cache = diskUsage?.BuildCache || [];

    return [
      {
        id: 'containers',
        label: 'Stopped containers',
        description: 'Exited and dead containers, including their writable layers.',
        iconName: 'container',
        count: stopped.length,
        estimate: stopped.reduce((sum, c) => sum + (c.SizeRw || 0), 0),
        run: api.pruneContainers,
      },
      {
        id: 'images',
        label: 'Dangling images',
        description: 'Untagged images left behind by builds and re-tags.',
        iconName: 'image',
        count: dangling.length,
        estimate: dangling.reduce((sum, image) => sum + (image.Size || 0), 0),
        run: () => api.pruneImages(true),
      },
      {
        id: 'cache',
        label: 'Build cache',
        description: 'Unused builder cache layers from previous builds.',
        iconName: 'layers',
        count: cache.length,
        estimate: cache.reduce(
          (sum: number, item) => sum + ((item as { Size?: number }).Size || 0),
          0,
        ),
        run: api.pruneBuildCache,
      },
      {
        id: 'volumes',
        label: 'Unused volumes',
        description: 'Volumes attached to no container. Their data is lost permanently.',
        iconName: 'volume',
        count: unusedVolumes.length,
        estimate: unusedVolumes.reduce(
          (sum, volume) =>
            sum + (volume.UsageData && volume.UsageData.Size >= 0 ? volume.UsageData.Size : 0),
          0,
        ),
        dangerous: true,
        run: api.pruneVolumes,
      },
      {
        id: 'networks',
        label: 'Unused networks',
        description: 'Custom networks with no attached containers.',
        iconName: 'network',
        count: null,
        estimate: null,
        run: api.pruneNetworks,
      },
    ];
  }, [diskUsage]);

  const chosen = targets.filter((target) => selected[target.id]);
  const estimatedTotal = chosen.reduce((sum, target) => sum + (target.estimate || 0), 0);

  const clean = async () => {
    setBusy(true);
    let reclaimed = 0;
    const failures: string[] = [];

    for (const target of chosen) {
      try {
        const result = await target.run();
        reclaimed += result.SpaceReclaimed || 0;
      } catch (error) {
        failures.push(`${target.label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    setBusy(false);
    if (failures.length) toast.error(failures.join(' · '));
    if (reclaimed > 0) toast.success(`Clean up finished, reclaimed ${formatBytes(reclaimed)}`);
    else if (!failures.length) toast.info('Clean up finished, nothing to reclaim');
    onDone();
    onClose();
  };

  return (
    <Modal
      title="Clean up disk space"
      desc="Prune unused Docker resources. Estimates come from the last disk usage scan."
      onClose={onClose}
      footer={
        <>
          <span className="muted" style={{ marginRight: 'auto' }}>
            ≈ {formatBytes(estimatedTotal)} reclaimable
          </span>
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn btn--primary"
            onClick={clean}
            disabled={busy || chosen.length === 0}
          >
            <Icon name="prune" size={15} />
            <span>{busy ? 'Cleaning…' : `Clean up (${chosen.length})`}</span>
          </button>
        </>
      }
    >
      <div className="cleanup-list">
        {targets.map((target) => (
          <label key={target.id} className="cleanup-row">
            <input
              type="checkbox"
              checked={!!selected[target.id]}
              disabled={busy}
              onChange={(event) =>
                setSelected((current) => ({ ...current, [target.id]: event.target.checked }))
              }
            />
            <span
              className="cleanup-row__icon"
              style={target.dangerous ? { color: 'var(--red)' } : undefined}
            >
              <Icon name={target.iconName} size={16} />
            </span>
            <span className="cleanup-row__text">
              <span className="cleanup-row__label">{target.label}</span>
              <span className="cleanup-row__desc">{target.description}</span>
            </span>
            <span className="cleanup-row__meta">
              <span className="mono">
                {target.estimate != null ? formatBytes(target.estimate) : '—'}
              </span>
              <span className="cell-dim">
                {target.count != null ? `${target.count} item(s)` : 'size n/a'}
              </span>
            </span>
          </label>
        ))}
      </div>
    </Modal>
  );
}
