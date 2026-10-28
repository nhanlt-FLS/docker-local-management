import { Icon } from '@/components/ui/Icon';
import { formatBytes, formatRelativeTime, shortenId, splitImageRef } from '@/lib/format';
import type { ImageSummary } from '@/types/docker';

interface ImageRowProps {
  image: ImageSummary;
  onRun: () => void;
  onTag: () => void;
  onRemove: () => void;
}

export function ImageRow({ image, onRun, onTag, onRemove }: ImageRowProps) {
  const tags = image.RepoTags?.length ? image.RepoTags : null;
  const parsed = tags ? splitImageRef(tags[0]) : null;
  const dangling = !tags;

  return (
    <tr>
      <td>
        <div className="name-cell">
          <div
            className="name-cell__avatar"
            style={
              dangling ? { background: 'var(--grey-soft)', color: 'var(--text-mute)' } : undefined
            }
          >
            <Icon name="image" size={18} />
          </div>
          <div className="name-cell__text">
            <span className="name-cell__primary">
              {parsed ? parsed.name : <span className="muted">&lt;none&gt;</span>}
            </span>
            {tags && tags.length > 1 && (
              <span className="name-cell__secondary">{tags.slice(1).join(', ')}</span>
            )}
            {dangling && <span className="name-cell__secondary">&lt;dangling&gt;</span>}
          </div>
        </div>
      </td>
      <td>
        {parsed ? <span className="tag">{parsed.tag}</span> : <span className="muted">—</span>}
      </td>
      <td>
        <span className="cell-mono">{shortenId(image.Id)}</span>
      </td>
      <td className="cell-dim nowrap">{formatBytes(image.Size)}</td>
      <td className="cell-dim nowrap" title={new Date(image.Created * 1000).toLocaleString()}>
        {formatRelativeTime(image.Created)}
      </td>
      <td>
        <div className="cell-actions">
          <button className="btn btn--sm" onClick={onRun} title="Run a container from this image">
            <Icon name="play" size={15} />
            <span>Run</span>
          </button>
          <button
            className="btn btn--sm btn--icon"
            onClick={onTag}
            title="Tag"
            aria-label="Tag image"
          >
            <Icon name="tag" size={16} />
          </button>
          <button
            className="btn btn--sm btn--icon btn--danger"
            onClick={onRemove}
            title="Remove"
            aria-label="Remove image"
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}
