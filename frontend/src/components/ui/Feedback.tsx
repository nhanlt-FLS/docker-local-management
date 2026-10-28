import { Icon, type IconName } from './Icon';

export interface EmptyAction {
  label: string;
  icon?: IconName;
  onClick: () => void;
}

interface EmptyStateProps {
  title: string;
  text?: string;
  iconName?: IconName;
  action?: EmptyAction | null;
}

export function EmptyState({ title, text, iconName = 'box', action }: EmptyStateProps) {
  return (
    <div className="empty">
      <span className="empty__icon">
        <Icon name={iconName} size={44} />
      </span>
      <div className="empty__title">{title}</div>
      {text ? <div className="empty__text">{text}</div> : null}
      {action ? (
        <button className="btn btn--primary" onClick={action.onClick}>
          <Icon name={action.icon || 'plus'} size={16} />
          <span>{action.label}</span>
        </button>
      ) : null}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="empty">
      <span className="empty__icon" style={{ color: 'var(--red)' }}>
        <Icon name="alert" size={42} />
      </span>
      <div className="empty__title">Something went wrong</div>
      <div className="empty__text">{message}</div>
      {onRetry ? (
        <button className="btn" onClick={onRetry}>
          <Icon name="refresh" size={16} />
          <span>Retry</span>
        </button>
      ) : null}
    </div>
  );
}
