import { useEffect, useMemo, useState } from 'react';
import type { ViewProps } from '@/app/types';
import { useDialog } from '@/components/ui/dialogContext';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/toastContext';
import { RunContainerDialog } from '@/features/containers/components/RunContainerDialog';
import { useAsyncData } from '@/hooks/useAsyncData';
import * as api from '@/lib/api';
import { formatBytes, shortenId, splitImageRef } from '@/lib/format';
import type { ImageSummary } from '@/types/docker';
import { ImageRow } from './components/ImageRow';
import { PullImageDialog } from './components/PullImageDialog';

export function ImagesView({ filter, refreshSignal, setPrimaryAction, onMutated }: ViewProps) {
  const toast = useToast();
  const { confirm, prompt } = useDialog();
  const [pullOpen, setPullOpen] = useState(false);
  const [runImage, setRunImage] = useState<string | null>(null);
  const { data, error, loading, reload } = useAsyncData(api.listImages, refreshSignal);

  useEffect(() => {
    setPrimaryAction({ label: 'Pull image', icon: 'download', onClick: () => setPullOpen(true) });
    return () => setPrimaryAction(null);
  }, [setPrimaryAction]);

  const images = useMemo(() => data ?? [], [data]);
  const rows = useMemo(() => {
    const sorted = [...images].sort((a, b) => b.Created - a.Created);
    const search = filter.toLowerCase();
    if (!search) return sorted;

    return sorted.filter((image) =>
      [image.Id, ...(image.RepoTags || []), ...(image.RepoDigests || [])]
        .join(' ')
        .toLowerCase()
        .includes(search),
    );
  }, [images, filter]);

  const handleMutated = () => {
    void reload(true);
    onMutated?.();
  };

  const remove = async (image: ImageSummary) => {
    const label = image.RepoTags?.[0] || shortenId(image.Id);
    const confirmed = await confirm({
      title: 'Remove image',
      message: `Remove image "${label}"? Containers using it may break.`,
      details: image.Id,
      confirmLabel: 'Remove',
    });
    if (!confirmed) return;

    try {
      await api.removeImage(image.Id, { force: true });
      toast.success(`Removed ${label}`);
      handleMutated();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : String(requestError));
    }
  };

  const tag = async (image: ImageSummary) => {
    const current = image.RepoTags?.[0] || '';
    const value = await prompt({
      title: 'Tag image',
      label: 'New tag (repository:tag)',
      placeholder: 'myrepo/myimage:v1',
      value: current ? `${splitImageRef(current).name}:` : '',
      confirmLabel: 'Tag',
    });
    if (!value) return;

    const { name, tag: newTag } = splitImageRef(value.trim());
    try {
      await api.tagImage(image.Id, name, newTag);
      toast.success(`Tagged as ${name}:${newTag}`);
      handleMutated();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : String(requestError));
    }
  };

  const prune = async () => {
    const confirmed = await confirm({
      title: 'Prune dangling images',
      message: 'Remove all dangling (untagged) images? This cannot be undone.',
      confirmLabel: 'Prune',
    });
    if (!confirmed) return;

    try {
      const result = await api.pruneImages(true);
      toast.success(
        `Pruned ${(result.ImagesDeleted || []).length} image(s), reclaimed ${formatBytes(result.SpaceReclaimed || 0)}`,
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
          <button className="btn btn--sm" onClick={() => setPullOpen(true)}>
            <Icon name="download" size={15} />
            <span>Pull</span>
          </button>
          <button className="btn btn--sm" onClick={prune}>
            <Icon name="prune" size={15} />
            <span>Prune dangling</span>
          </button>
        </div>
        <span className="view-head__spacer" />
        <div className="muted nowrap">{images.length} images</div>
      </div>

      {loading && !data ? (
        <LoadingState label="Loading images…" />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState
          iconName="image"
          title={images.length ? 'No images match' : 'No images yet'}
          text={
            images.length
              ? 'Try a different search term.'
              : 'Pull an image from a registry to get started.'
          }
          action={{ label: 'Pull image', icon: 'download', onClick: () => setPullOpen(true) }}
        />
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: '34%' }}>Repository</th>
                  <th style={{ width: '12%' }}>Tag</th>
                  <th style={{ width: '14%' }}>ID</th>
                  <th style={{ width: '12%' }}>Size</th>
                  <th style={{ width: '13%' }}>Created</th>
                  <th className="right" style={{ width: '15%' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((image) => (
                  <ImageRow
                    key={image.Id}
                    image={image}
                    onRun={() => setRunImage(image.RepoTags?.[0] || image.Id)}
                    onTag={() => tag(image)}
                    onRemove={() => remove(image)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pullOpen && <PullImageDialog onClose={() => setPullOpen(false)} onDone={handleMutated} />}
      {runImage && (
        <RunContainerDialog
          defaultImage={runImage}
          onClose={() => setRunImage(null)}
          onDone={handleMutated}
        />
      )}
    </>
  );
}
