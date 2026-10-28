import type { ContainerSummary } from '@/types/docker';

export function getContainerName(container: Pick<ContainerSummary, 'Names' | 'Id'>): string {
  const name = container.Names?.[0] || container.Id || '';
  return name.replace(/^\//, '');
}

export function getContainerStatusText(container: ContainerSummary): string {
  const state = String(container.State || '').toLowerCase();
  if (state === 'running') return container.Status || 'Up';
  if (state === 'exited' || state === 'dead') return container.Status || 'Exited';
  return container.Status || state || 'unknown';
}

export function isContainerActive(container: ContainerSummary): boolean {
  return ['running', 'paused', 'restarting'].includes(container.State.toLowerCase());
}
