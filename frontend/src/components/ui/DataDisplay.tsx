import type { ReactNode } from 'react';
import type { PortMapping } from '@/types/docker';

const STATE_CLASS: Record<string, string> = {
  running: 'running',
  restarting: 'restarting',
  created: 'created',
  paused: 'paused',
  exited: 'exited',
  dead: 'dead',
  removing: 'neutral',
};

export function StatusPill({ state, label }: { state: string; label?: string }) {
  const stateClass = STATE_CLASS[state.toLowerCase()] || 'neutral';
  return (
    <span className={`pill pill--${stateClass}`}>
      <span className="pill__dot" />
      {label || state}
    </span>
  );
}

export type KeyValuePair = [string, ReactNode];

export function KeyValueList({ pairs }: { pairs: KeyValuePair[] }) {
  const rows = pairs.filter(([, value]) => value !== undefined && value !== null && value !== '');
  return (
    <div className="kv">
      {rows.map(([key, value], index) => (
        <div className="kv__row" key={`${key}-${index}`}>
          <div className="kv__key">{key}</div>
          <div className="kv__val">{value}</div>
        </div>
      ))}
    </div>
  );
}

export function Ports({
  ports,
  linkable = false,
}: {
  ports?: PortMapping[];
  /** Render published TCP ports as anchors opening the local service. */
  linkable?: boolean;
}) {
  if (!ports?.length) return <span className="muted">—</span>;

  const published = ports.filter((port) => port.PublicPort);
  const visiblePorts = published.length ? published : ports;

  return (
    <span className="gap" style={{ gap: 4, flexWrap: 'wrap' }}>
      {visiblePorts.map((port, index) => {
        const protocol = port.Type || 'tcp';
        const specificIp = port.IP && port.IP !== '0.0.0.0' && port.IP !== '::' ? port.IP : '';
        const host = specificIp ? `${specificIp}:` : '';
        const label = port.PublicPort
          ? `${host}${port.PublicPort}→${port.PrivatePort}`
          : `${port.PrivatePort}/${protocol}`;
        const url =
          port.PublicPort && protocol === 'tcp'
            ? `http://${specificIp || 'localhost'}:${port.PublicPort}`
            : null;
        const title = url ? `Open ${url}` : `${port.PrivatePort}/${protocol}`;

        return linkable && url ? (
          <a
            className="tag tag--link"
            key={`${label}-${index}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            title={title}
          >
            {label}
          </a>
        ) : (
          <span className="tag" key={`${label}-${index}`} title={title}>
            {label}
          </span>
        );
      })}
    </span>
  );
}
