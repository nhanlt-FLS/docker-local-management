import type { DialogApi } from '@/components/ui/dialogContext';
import type { ToastApi } from '@/components/ui/toastContext';
import * as api from '@/lib/api';
import { shortenId } from '@/lib/format';

export type ContainerAction =
  'start' | 'stop' | 'restart' | 'kill' | 'pause' | 'unpause' | 'remove';

interface ActionTarget {
  Id: string;
  name?: string;
}

interface ActionDependencies {
  toast: Pick<ToastApi, 'success' | 'error'>;
  confirm: DialogApi['confirm'];
}

/** Shared by table rows and the detail drawer. Returns true after a mutation. */
export async function performContainerAction(
  action: ContainerAction,
  target: ActionTarget,
  { toast, confirm }: ActionDependencies,
): Promise<boolean> {
  const name = target.name || shortenId(target.Id);

  try {
    switch (action) {
      case 'start':
        await api.startContainer(target.Id);
        break;
      case 'stop':
        await api.stopContainer(target.Id);
        break;
      case 'restart':
        await api.restartContainer(target.Id);
        break;
      case 'kill':
        await api.killContainer(target.Id);
        break;
      case 'pause':
        await api.pauseContainer(target.Id);
        break;
      case 'unpause':
        await api.unpauseContainer(target.Id);
        break;
      case 'remove': {
        const confirmed = await confirm({
          title: 'Remove container',
          message: `Permanently remove "${name}"? This cannot be undone.`,
          details: target.Id,
          confirmLabel: 'Remove',
        });
        if (!confirmed) return false;
        await api.removeContainer(target.Id, { force: true, volumes: true });
        break;
      }
    }

    const messages: Record<ContainerAction, string> = {
      start: 'Started',
      stop: 'Stopped',
      restart: 'Restarted',
      kill: 'Killed',
      pause: 'Paused',
      unpause: 'Resumed',
      remove: 'Removed',
    };
    toast.success(`${messages[action]} ${name}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast.error(`${action}: ${message}`);
    return false;
  }
}
