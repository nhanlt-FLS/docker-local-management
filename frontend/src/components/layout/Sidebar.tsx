import { NAVIGATION_ITEMS } from '@/app/navigation';
import type { ResourceCounts, ViewId } from '@/app/types';
import { Icon } from '@/components/ui/Icon';
import { EngineStatus } from './EngineStatus';

interface SidebarProps {
  activeView: ViewId;
  counts: ResourceCounts;
  onNavigate: (view: ViewId) => void;
}

export function Sidebar({ activeView, counts, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand__logo" aria-hidden="true">
          <Icon name="whale" size={26} />
        </span>
        <div className="brand__text">
          <strong>Docker</strong>
          <span>Local Manager</span>
        </div>
      </div>

      <nav className="nav" id="nav" aria-label="Main navigation">
        {NAVIGATION_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav__item ${activeView === item.id ? 'is-active' : ''}`}
            onClick={() => onNavigate(item.id)}
            aria-current={activeView === item.id ? 'page' : undefined}
          >
            <span className="nav__icon">
              <Icon name={item.icon} size={18} />
            </span>
            <span className="nav__label">{item.label}</span>
            {item.countKey && <span className="nav__badge">{counts[item.countKey] || ''}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar__footer">
        <EngineStatus />
      </div>
    </aside>
  );
}
