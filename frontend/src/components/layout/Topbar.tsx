import type { PrimaryAction } from '@/app/types';
import { Icon } from '@/components/ui/Icon';

interface TopbarProps {
  title: string;
  subtitle: string;
  filter: string;
  showSearch: boolean;
  primaryAction: PrimaryAction | null;
  onFilterChange: (value: string) => void;
  onRefresh: () => void;
}

export function Topbar({
  title,
  subtitle,
  filter,
  showSearch,
  primaryAction,
  onFilterChange,
  onRefresh,
}: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar__title">
        <h1>{title}</h1>
        <p className="topbar__subtitle">{subtitle}</p>
      </div>
      <div className="topbar__actions">
        {showSearch && (
          <div className="search" id="global-search-wrap">
            <span className="search__icon">
              <Icon name="search" size={16} />
            </span>
            <input
              id="global-search"
              className="search__input"
              type="search"
              placeholder="Filter…"
              aria-label="Filter current view"
              autoComplete="off"
              value={filter}
              onChange={(event) => onFilterChange(event.target.value)}
            />
          </div>
        )}
        <button className="btn btn--ghost" id="btn-refresh" title="Refresh" onClick={onRefresh}>
          <Icon name="refresh" size={18} />
        </button>
        {primaryAction && (
          <button
            className="btn btn--primary"
            id="btn-primary-action"
            onClick={primaryAction.onClick}
          >
            <Icon name={primaryAction.icon} size={16} />
            <span>{primaryAction.label}</span>
          </button>
        )}
      </div>
    </header>
  );
}
