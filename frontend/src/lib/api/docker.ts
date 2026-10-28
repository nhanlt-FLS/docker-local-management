// Typed Docker Engine API endpoints exposed by server.py.
import { ApiError, request, streamRequest } from './client';
import type {
  ContainerCreateConfig,
  ContainerInspect,
  ContainerSummary,
  ContainerTop,
  CreateResponse,
  DiskUsage,
  DockerEvent,
  ImageSummary,
  InfoResponse,
  NetworkSummary,
  PruneResponse,
  StatsSample,
  VersionResponse,
  VolumesResponse,
} from '@/types/docker';

export const health = () =>
  request<{ ok: boolean; ping?: string; error?: string }>('GET', '/_health');
export const version = () => request<VersionResponse>('GET', '/version');
export const info = () => request<InfoResponse>('GET', '/info');
export const diskUsage = () => request<DiskUsage>('GET', '/system/df');

export const listContainers = (all = true, withSize = true) =>
  request<ContainerSummary[]>('GET', '/containers/json', {
    // size=1 makes the daemon compute rw-layer sizes per container, which is
    // noticeably slower; only callers displaying the size column need it.
    query: { all: all ? 1 : 0, size: withSize ? 1 : undefined },
  });
export const inspectContainer = (id: string) =>
  request<ContainerInspect>('GET', `/containers/${id}/json`);
export const containerTop = (id: string) => request<ContainerTop>('GET', `/containers/${id}/top`);

export async function containerLogs(
  id: string,
  {
    tail = 1000,
    timestamps = false,
    signal,
  }: { tail?: number | string; timestamps?: boolean; signal?: AbortSignal } = {},
): Promise<string> {
  const query = new URLSearchParams({ stdout: '1', stderr: '1', tail: String(tail) });
  if (timestamps) query.set('timestamps', '1');

  const response = await fetch(`/api/containers/${id}/logs?${query}`, { signal });
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to fetch logs (${response.status})`);
  }
  return response.text();
}

export function followLogs(
  id: string,
  {
    tail = 200,
    timestamps = false,
    onChunk,
    signal,
  }: {
    tail?: number | string;
    timestamps?: boolean;
    onChunk: (chunk: string) => void;
    signal?: AbortSignal;
  },
) {
  return streamRequest('GET', `/containers/${id}/logs`, {
    query: { stdout: 1, stderr: 1, follow: 1, tail, timestamps: timestamps ? 1 : 0 },
    onChunk,
    signal,
  });
}

function streamJsonLines<T>(
  path: string,
  query: Record<string, string | number>,
  onJson: (value: T) => void,
  signal?: AbortSignal,
) {
  let buffer = '';

  return streamRequest('GET', path, {
    query,
    signal,
    onChunk: (chunk) => {
      buffer += chunk;
      let newlineIndex: number;

      while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line) continue;

        try {
          onJson(JSON.parse(line) as T);
        } catch {
          // Ignore malformed/partial lines and continue with the next chunk.
        }
      }
    },
  });
}

export const streamStats = (
  id: string,
  { onJson, signal }: { onJson: (sample: StatsSample) => void; signal?: AbortSignal },
) => streamJsonLines<StatsSample>(`/containers/${id}/stats`, { stream: 1 }, onJson, signal);

export const streamEvents = ({
  onJson,
  signal,
}: {
  onJson: (event: DockerEvent) => void;
  signal?: AbortSignal;
}) => streamJsonLines<DockerEvent>('/events', {}, onJson, signal);

export const startContainer = (id: string) => request<void>('POST', `/containers/${id}/start`);
export const stopContainer = (id: string, timeout = 10) =>
  request<void>('POST', `/containers/${id}/stop`, { query: { t: timeout } });
export const restartContainer = (id: string, timeout = 10) =>
  request<void>('POST', `/containers/${id}/restart`, { query: { t: timeout } });
export const killContainer = (id: string, signal = 'SIGKILL') =>
  request<void>('POST', `/containers/${id}/kill`, { query: { signal } });
export const pauseContainer = (id: string) => request<void>('POST', `/containers/${id}/pause`);
export const unpauseContainer = (id: string) => request<void>('POST', `/containers/${id}/unpause`);
export const removeContainer = (id: string, { force = false, volumes = false } = {}) =>
  request<void>('DELETE', `/containers/${id}`, {
    query: { force: force ? 1 : 0, v: volumes ? 1 : 0 },
  });
export const pruneContainers = () => request<PruneResponse>('POST', '/containers/prune');
export const pruneBuildCache = () => request<PruneResponse>('POST', '/build/prune');
export const createContainer = (config: ContainerCreateConfig, name?: string) =>
  request<CreateResponse>('POST', '/containers/create', {
    body: config,
    query: name ? { name } : undefined,
  });

export const listImages = () => request<ImageSummary[]>('GET', '/images/json');
export const removeImage = (id: string, { force = false, noprune = false } = {}) =>
  request<unknown>('DELETE', `/images/${id}`, {
    query: { force: force ? 1 : 0, noprune: noprune ? 1 : 0 },
  });
export const tagImage = (id: string, repo: string, tag: string) =>
  request<void>('POST', `/images/${id}/tag`, { query: { repo, tag } });
export const pruneImages = (danglingOnly = true) =>
  request<PruneResponse>(
    'POST',
    '/images/prune',
    danglingOnly ? {} : { query: { filters: JSON.stringify({ dangling: ['false'] }) } },
  );

function splitImageReferenceForPull(reference: string): { name: string; tag: string } {
  if (reference.includes('@')) {
    return { name: reference.split('@')[0], tag: '' };
  }

  const colonIndex = reference.lastIndexOf(':');
  const slashIndex = reference.lastIndexOf('/');
  if (colonIndex > slashIndex) {
    return {
      name: reference.slice(0, colonIndex),
      tag: reference.slice(colonIndex + 1),
    };
  }
  return { name: reference, tag: 'latest' };
}

export function pullImage(
  imageRef: string,
  { onChunk, signal }: { onChunk: (chunk: string) => void; signal?: AbortSignal },
) {
  const { name, tag } = splitImageReferenceForPull(imageRef);
  return streamRequest('POST', '/images/create', {
    query: { fromImage: name, tag: tag || 'latest' },
    signal,
    onChunk,
  });
}

export const listVolumes = () => request<VolumesResponse>('GET', '/volumes');
export const inspectVolume = (name: string) =>
  request<Record<string, unknown>>('GET', `/volumes/${encodeURIComponent(name)}`);
export const createVolume = (config: Record<string, unknown>) =>
  request<Record<string, unknown>>('POST', '/volumes/create', { body: config });
export const removeVolume = (name: string, { force = false } = {}) =>
  request<void>('DELETE', `/volumes/${encodeURIComponent(name)}`, {
    query: { force: force ? 1 : 0 },
  });
export const pruneVolumes = () => request<PruneResponse>('POST', '/volumes/prune');

export const listNetworks = () => request<NetworkSummary[]>('GET', '/networks');
export const inspectNetwork = (id: string) =>
  request<Record<string, unknown>>('GET', `/networks/${id}`);
export const createNetwork = (config: Record<string, unknown>) =>
  request<Record<string, unknown>>('POST', '/networks/create', { body: config });
export const removeNetwork = (id: string) => request<void>('DELETE', `/networks/${id}`);
export const pruneNetworks = () => request<PruneResponse>('POST', '/networks/prune');
