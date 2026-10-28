import type { IconName } from '@/components/ui/Icon';
import type { ResourceCounts, ViewId } from './types';

export interface NavigationItem {
  id: ViewId;
  label: string;
  icon: IconName;
  countKey?: keyof ResourceCounts;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'containers', label: 'Containers', icon: 'container', countKey: 'containers' },
  { id: 'images', label: 'Images', icon: 'image', countKey: 'images' },
  { id: 'volumes', label: 'Volumes', icon: 'volume', countKey: 'volumes' },
  { id: 'networks', label: 'Networks', icon: 'network', countKey: 'networks' },
  { id: 'system', label: 'System', icon: 'system' },
];

export const VIEW_METADATA: Record<ViewId, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Overview of the local Docker engine.' },
  containers: {
    title: 'Containers',
    subtitle: 'Manage running and stopped containers on this host.',
  },
  images: { title: 'Images', subtitle: 'Local images - pull, run, tag and remove.' },
  volumes: { title: 'Volumes', subtitle: 'Persistent data volumes.' },
  networks: { title: 'Networks', subtitle: 'Docker networks and their attached containers.' },
  system: { title: 'System', subtitle: 'Engine information, disk usage and live events.' },
};
