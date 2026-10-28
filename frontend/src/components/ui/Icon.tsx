import type { ReactNode, SVGAttributes } from 'react';

// Hand-authored inline SVGs keep the project independent of an icon library.
export type IconName =
  | 'dashboard'
  | 'container'
  | 'image'
  | 'volume'
  | 'network'
  | 'system'
  | 'search'
  | 'refresh'
  | 'plus'
  | 'play'
  | 'stop'
  | 'pause'
  | 'restart'
  | 'trash'
  | 'logs'
  | 'terminal'
  | 'inspect'
  | 'close'
  | 'check'
  | 'alert'
  | 'info'
  | 'cpu'
  | 'memory'
  | 'disk'
  | 'download'
  | 'tag'
  | 'prune'
  | 'copy'
  | 'chevron'
  | 'box'
  | 'clock'
  | 'link'
  | 'whale'
  | 'layers';

const shapeAttributes: SVGAttributes<SVGElement> = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const icons: Record<IconName, ReactNode> = {
  dashboard: (
    <path {...shapeAttributes} d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z" />
  ),
  container: (
    <path {...shapeAttributes} d="M3 8.5 12 4l9 4.5-9 4.5zM3 8.5v7L12 20l9-4.5v-7M12 12.5V20" />
  ),
  image: (
    <>
      <path {...shapeAttributes} d="M4 5h16v14H4z" />
      <circle cx="9" cy="9.5" r="1.6" {...shapeAttributes} />
      <path {...shapeAttributes} d="m4.5 17 4.5-4.5 3 3 3.5-3.5 4 4" />
    </>
  ),
  volume: (
    <path
      {...shapeAttributes}
      d="M4 6.5 12 3l8 3.5-8 3.5zM4 6.5v11L12 21l8-3.5v-11M4 12l8 3.5L20 12"
    />
  ),
  network: (
    <>
      <circle cx="12" cy="5" r="2" {...shapeAttributes} />
      <circle cx="5" cy="18" r="2" {...shapeAttributes} />
      <circle cx="19" cy="18" r="2" {...shapeAttributes} />
      <path {...shapeAttributes} d="M12 7v4m0 0-5.5 5M12 11l5.5 5" />
    </>
  ),
  system: (
    <>
      <path {...shapeAttributes} d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="8" cy="7" r="1.4" fill="currentColor" />
      <circle cx="15" cy="12" r="1.4" fill="currentColor" />
      <circle cx="10" cy="17" r="1.4" fill="currentColor" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" {...shapeAttributes} />
      <path {...shapeAttributes} d="m20 20-3.5-3.5" />
    </>
  ),
  refresh: <path {...shapeAttributes} d="M20 11a8 8 0 1 0-1.6 5.6M20 5v6h-6" />,
  plus: <path {...shapeAttributes} d="M12 5v14M5 12h14" />,
  play: <path {...shapeAttributes} d="M7 4.5v15l13-7.5z" />,
  stop: <path {...shapeAttributes} d="M6 6h12v12H6z" />,
  pause: <path {...shapeAttributes} d="M9 5v14M15 5v14" />,
  restart: <path {...shapeAttributes} d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" />,
  trash: <path {...shapeAttributes} d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  logs: <path {...shapeAttributes} d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />,
  terminal: <path {...shapeAttributes} d="M4 5h16v14H4zM7.5 9.5 10 12l-2.5 2.5M12.5 15h4" />,
  inspect: <path {...shapeAttributes} d="M10 4h9v16h-9zM6 8H4v12h2M13 8h3M13 12h3M13 16h2" />,
  close: <path {...shapeAttributes} d="M6 6l12 12M18 6 6 18" />,
  check: <path {...shapeAttributes} d="m5 12 5 5 9-10" />,
  alert: <path {...shapeAttributes} d="M12 4 2.5 20h19zM12 10v4M12 17h.01" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" {...shapeAttributes} />
      <path {...shapeAttributes} d="M12 11v5M12 8h.01" />
    </>
  ),
  cpu: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="1" {...shapeAttributes} />
      <path
        {...shapeAttributes}
        d="M9.5 3v2M14.5 3v2M9.5 19v2M14.5 19v2M3 9.5h2M3 14.5h2M19 9.5h2M19 14.5h2"
      />
    </>
  ),
  memory: <path {...shapeAttributes} d="M4 8h16v8H4zM7 16v2M12 16v2M17 16v2M7 8V6M12 8V6M17 8V6" />,
  disk: (
    <>
      <ellipse cx="12" cy="6" rx="8" ry="3" {...shapeAttributes} />
      <path
        {...shapeAttributes}
        d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"
      />
    </>
  ),
  download: <path {...shapeAttributes} d="M12 4v11M8 11l4 4 4-4M5 19h14" />,
  tag: (
    <>
      <path {...shapeAttributes} d="M4 11V4h7l9 9-7 7z" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
    </>
  ),
  prune: <path {...shapeAttributes} d="M6 6l12 12M18 6 6 18M12 3v2M12 19v2M3 12h2M19 12h2" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" {...shapeAttributes} />
      <path {...shapeAttributes} d="M5 15V5h10" />
    </>
  ),
  chevron: <path {...shapeAttributes} d="m9 6 6 6-6 6" />,
  box: <path {...shapeAttributes} d="M12 3 3 7.5v9L12 21l9-4.5v-9zM3 7.5 12 12l9-4.5M12 12v9" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" {...shapeAttributes} />
      <path {...shapeAttributes} d="M12 7v5l3.5 2" />
    </>
  ),
  link: (
    <>
      <path {...shapeAttributes} d="M10 13a4 4 0 0 0 6 .5l2-2a4 4 0 0 0-5.7-5.7l-1 1" />
      <path {...shapeAttributes} d="M14 11a4 4 0 0 0-6-.5l-2 2A4 4 0 0 0 11.7 18l1-1" />
    </>
  ),
  layers: (
    <path {...shapeAttributes} d="M12 3 3 7.5 12 12l9-4.5zM3 12.5 12 17l9-4.5M3 17 12 21.5 21 17" />
  ),
  whale: (
    <>
      <path
        fill="currentColor"
        d="M13 4h3v3h-3zM13 8h3v3h-3zM9 8h3v3H9zM9 12h3v3H9zM5 8h3v3H5zM5 12h3v3H5zM17 8h3v3h-3z"
      />
      <path
        fill="currentColor"
        d="M21.8 12.6c-.5-.3-1.6-.5-2.5-.3-.1-1-.7-1.8-1.6-2.5l-.5-.4-.4.5c-.5.8-.7 1.9-.3 2.8.2.5.6 1 1 1.3-.7.4-1.9.7-3.4.7H2.2c-.4 1.5-.2 5 2.3 6.9 1.9 1.4 4.6 1.2 6.6.2 2.5-1.3 4.4-3.6 5.6-7 .9 0 2.3-.1 3-1.3.2-.3.4-.8.5-1.1z"
      />
    </>
  ),
};

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 18, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className={className}>
      {icons[name]}
    </svg>
  );
}
