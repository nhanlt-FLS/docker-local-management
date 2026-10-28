import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

export interface DrawerTab {
  id: string;
  label: string;
  content: ReactNode;
}

interface DrawerProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  tabs: DrawerTab[];
  defaultTab?: string;
  onClose: () => void;
}

/** Only the active tab mounts, so effects in inactive tabs cannot keep streams open. */
export function Drawer({ title, subtitle, actions, tabs, defaultTab, onClose }: DrawerProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '');
  const closing = useRef(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  const handleClose = () => {
    if (closing.current) return;
    closing.current = true;
    setOpen(false);
    closeTimer.current = window.setTimeout(onClose, 220);
  };

  const closeRef = useRef(handleClose);
  closeRef.current = handleClose;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeContent = tabs.find((tab) => tab.id === activeTab)?.content;

  return createPortal(
    <>
      <div className={`drawer-backdrop ${open ? 'is-open' : ''}`} onClick={handleClose} />
      <div
        className={`drawer ${open ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="drawer__head">
          <div className="drawer__head-info">
            <div className="drawer__title">{title}</div>
            {subtitle ? <div className="drawer__subtitle">{subtitle}</div> : null}
          </div>
          {actions ? <div className="drawer__actions gap">{actions}</div> : null}
          <button className="drawer__close" onClick={handleClose} aria-label="Close" title="Close">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="drawer__tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`drawer__tab ${tab.id === activeTab ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={tab.id === activeTab}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="drawer__body">{activeContent}</div>
      </div>
    </>,
    document.body,
  );
}
