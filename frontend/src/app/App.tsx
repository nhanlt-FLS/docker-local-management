import { useCallback, useState, type ComponentType } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { ContainersView } from '@/features/containers/ContainersView';
import { DashboardView } from '@/features/dashboard/DashboardView';
import { ImagesView } from '@/features/images/ImagesView';
import { NetworksView } from '@/features/networks/NetworksView';
import { SystemView } from '@/features/system/SystemView';
import { VolumesView } from '@/features/volumes/VolumesView';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useInterval } from '@/hooks/useInterval';
import * as api from '@/lib/api';
import { VIEW_METADATA } from './navigation';
import type { PrimaryAction, ResourceCounts, ViewId, ViewProps } from './types';

const EMPTY_COUNTS: ResourceCounts = { containers: 0, images: 0, volumes: 0, networks: 0 };

const VIEW_COMPONENTS: Record<ViewId, ComponentType<ViewProps>> = {
  dashboard: DashboardView,
  containers: ContainersView,
  images: ImagesView,
  volumes: VolumesView,
  networks: NetworksView,
  system: SystemView,
};

/** Owns application-wide state; feature views own their resource-specific state. */
export function App() {
  const [activeView, setActiveView] = useState<ViewId>('dashboard');
  const [filter, setFilter] = useState('');
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [primaryAction, setPrimaryAction] = useState<PrimaryAction | null>(null);

  const loadCounts = useCallback(async (): Promise<ResourceCounts> => {
    const [info, images, volumes, networks] = await Promise.all([
      api.info().catch(() => null),
      api.listImages().catch(() => []),
      api
        .listVolumes()
        .then((response) => response.Volumes || [])
        .catch(() => []),
      api.listNetworks().catch(() => []),
    ]);

    return {
      containers: info?.Containers ?? 0,
      images: info?.Images ?? images.length,
      volumes: volumes.length,
      networks: networks.length,
    };
  }, []);

  const { data: counts, reload: reloadCounts } = useAsyncData(loadCounts, refreshSignal);
  useInterval(() => void reloadCounts(true), 7000);

  const navigate = useCallback((view: ViewId) => {
    setActiveView(view);
    setFilter('');
  }, []);
  const updatePrimaryAction = useCallback((action: PrimaryAction | null) => {
    setPrimaryAction(action);
  }, []);
  const handleMutated = useCallback(() => {
    void reloadCounts(true);
  }, [reloadCounts]);

  const ActiveView = VIEW_COMPONENTS[activeView];
  const metadata = VIEW_METADATA[activeView];
  const viewProps: ViewProps = {
    filter,
    refreshSignal,
    setPrimaryAction: updatePrimaryAction,
    onMutated: handleMutated,
    navigate,
  };

  return (
    <div className="app-shell" id="app">
      <Sidebar activeView={activeView} counts={counts ?? EMPTY_COUNTS} onNavigate={navigate} />
      <main className="main">
        <Topbar
          title={metadata.title}
          subtitle={metadata.subtitle}
          filter={filter}
          showSearch={activeView !== 'dashboard' && activeView !== 'system'}
          primaryAction={primaryAction}
          onFilterChange={setFilter}
          onRefresh={() => setRefreshSignal((current) => current + 1)}
        />
        <section className="content" id="content">
          <ActiveView {...viewProps} />
        </section>
      </main>
    </div>
  );
}
