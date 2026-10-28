import { useCallback } from 'react';
import { useDialog } from '@/components/ui/dialogContext';
import { Drawer, type DrawerTab } from '@/components/ui/Drawer';
import { ErrorState, LoadingState } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/toastContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import * as api from '@/lib/api';
import { shortenId } from '@/lib/format';
import { performContainerAction, type ContainerAction } from '../containerActions';
import { ContainerInspect } from './ContainerInspect';
import { ContainerLogs } from './ContainerLogs';
import { ContainerProcesses } from './ContainerProcesses';
import { ContainerStats } from './ContainerStats';

interface ContainerDetailDrawerProps {
  id: string;
  onClose: () => void;
  onChanged?: () => void;
}

export function ContainerDetailDrawer({ id, onClose, onChanged }: ContainerDetailDrawerProps) {
  const toast = useToast();
  const { confirm } = useDialog();
  const loadDetail = useCallback(() => api.inspectContainer(id), [id]);
  const { data: detail, error, reload } = useAsyncData(loadDetail, id);

  if (error && !detail) {
    return (
      <Drawer
        title="Container"
        onClose={onClose}
        tabs={[
          { id: 'error', label: 'Error', content: <ErrorState error={error} onRetry={reload} /> },
        ]}
      />
    );
  }

  if (!detail) {
    return (
      <Drawer
        title="Container"
        onClose={onClose}
        tabs={[
          {
            id: 'loading',
            label: 'Loading',
            content: <LoadingState label="Inspecting container…" />,
          },
        ]}
      />
    );
  }

  const name = detail.Name.replace(/^\//, '') || shortenId(detail.Id);
  const status = detail.State?.Status || 'unknown';
  const running = status === 'running';

  const handleAction = async (action: ContainerAction) => {
    const changed = await performContainerAction(
      action,
      { Id: detail.Id, name },
      { toast, confirm },
    );
    if (!changed) return;

    void reload(true);
    onChanged?.();
    if (action === 'remove') onClose();
  };

  const tabs: DrawerTab[] = [
    { id: 'logs', label: 'Logs', content: <ContainerLogs detail={detail} /> },
    { id: 'stats', label: 'Stats', content: <ContainerStats detail={detail} /> },
    { id: 'inspect', label: 'Inspect', content: <ContainerInspect detail={detail} /> },
    { id: 'processes', label: 'Processes', content: <ContainerProcesses detail={detail} /> },
  ];

  return (
    <Drawer
      title={name}
      subtitle={`${shortenId(detail.Id)} · ${status}`}
      actions={
        <>
          <button className="btn btn--sm" onClick={() => handleAction(running ? 'stop' : 'start')}>
            <Icon name={running ? 'stop' : 'play'} size={15} />
            <span>{running ? 'Stop' : 'Start'}</span>
          </button>
          <button className="btn btn--sm" onClick={() => handleAction('restart')}>
            <Icon name="restart" size={15} />
            <span>Restart</span>
          </button>
          <button className="btn btn--sm btn--danger" onClick={() => handleAction('remove')}>
            <Icon name="trash" size={15} />
            <span>Remove</span>
          </button>
        </>
      }
      tabs={tabs}
      defaultTab="logs"
      onClose={onClose}
    />
  );
}
