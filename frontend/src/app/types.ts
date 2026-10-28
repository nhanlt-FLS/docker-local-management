import type { IconName } from '@/components/ui/Icon';

export type ViewId = 'dashboard' | 'containers' | 'images' | 'volumes' | 'networks' | 'system';

export interface PrimaryAction {
  label: string;
  icon: IconName;
  onClick: () => void;
}

/** Props supplied by the app shell to each top-level feature view. */
export interface ViewProps {
  filter: string;
  refreshSignal: number;
  setPrimaryAction: (action: PrimaryAction | null) => void;
  onMutated?: () => void;
  navigate: (view: ViewId) => void;
}

export interface ResourceCounts {
  containers: number;
  images: number;
  volumes: number;
  networks: number;
}
