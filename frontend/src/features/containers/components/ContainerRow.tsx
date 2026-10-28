import { Icon, type IconName } from '@/components/ui/Icon';
import { Ports, StatusPill } from '@/components/ui/DataDisplay';
import { formatBytes, shortenId } from '@/lib/format';
import type { ContainerSummary } from '@/types/docker';
import type { ContainerAction } from '../containerActions';
import { getContainerName, getContainerStatusText } from '../containerUtils';

interface ContainerRowProps {
  container: ContainerSummary;
  onOpen: () => void;
  onAction: (action: ContainerAction, container: ContainerSummary) => void;
}

export function ContainerRow({ container, onOpen, onAction }: ContainerRowProps) {
  const state = container.State.toLowerCase();
  const running = state === 'running';
  const paused = state === 'paused';

  return (
    <tr>
      <td>
        <div className="name-cell">
          <div
            className="name-cell__avatar"
            style={running ? { background: 'var(--green-soft)', color: '#7ee2a8' } : undefined}
          >
            <Icon name="container" size={18} />
          </div>
          <div className="name-cell__text">
            <span
              className="name-cell__primary open-detail"
              title="Open details"
              onClick={onOpen}
              style={{ cursor: 'pointer' }}
            >
              {getContainerName(container)}
            </span>
            <span className="name-cell__secondary">{shortenId(container.Id)}</span>
          </div>
        </div>
      </td>
      <td>
        <span className="cell-mono" title={container.Image}>
          {container.Image}
        </span>
      </td>
      <td>
        <StatusPill state={state} />
        <div className="cell-dim" style={{ marginTop: 4, fontSize: 11.5 }}>
          {getContainerStatusText(container)}
        </div>
      </td>
      <td>
        <Ports ports={container.Ports} linkable={running} />
      </td>
      <td className="cell-dim nowrap" title="Writable layer size">
        {container.SizeRw != null ? formatBytes(container.SizeRw) : '—'}
      </td>
      <td>
        <div className="cell-actions">
          <IconButton
            icon={running ? 'stop' : 'play'}
            title={running ? 'Stop' : 'Start'}
            onClick={() => onAction(running ? 'stop' : 'start', container)}
          />
          <IconButton
            icon="restart"
            title="Restart"
            onClick={() => onAction('restart', container)}
          />
          {paused ? (
            <IconButton icon="play" title="Resume" onClick={() => onAction('unpause', container)} />
          ) : (
            <IconButton
              icon="pause"
              title="Pause"
              disabled={!running}
              onClick={() => onAction('pause', container)}
            />
          )}
          <IconButton icon="logs" title="Logs & details" onClick={onOpen} />
          <IconButton
            icon="trash"
            title="Remove"
            variant="btn--danger"
            onClick={() => onAction('remove', container)}
          />
        </div>
      </td>
    </tr>
  );
}

function IconButton({
  icon,
  title,
  onClick,
  disabled,
  variant = '',
}: {
  icon: IconName;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: string;
}) {
  return (
    <button
      className={`btn btn--sm btn--icon ${variant}`}
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}
