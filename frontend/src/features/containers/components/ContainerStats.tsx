import { useEffect, useState } from 'react';
import { EmptyState, LoadingState } from '@/components/ui/Feedback';
import * as api from '@/lib/api';
import type { StreamHandle } from '@/lib/api';
import { clamp, formatBytes, formatPercent } from '@/lib/format';
import type { ContainerInspect, StatsSample } from '@/types/docker';

export function ContainerStats({ detail }: { detail: ContainerInspect }) {
  const running = detail.State?.Status === 'running';
  const [sample, setSample] = useState<StatsSample | null>(null);

  useEffect(() => {
    if (!running) return undefined;

    let stream: StreamHandle | null = null;
    let cancelled = false;
    api
      .streamStats(detail.Id, {
        onJson: (nextSample) => {
          if (!cancelled) setSample(nextSample);
        },
      })
      .then((handle) => {
        if (cancelled) handle.abort();
        else stream = handle;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      stream?.abort();
    };
  }, [detail.Id, running]);

  if (!running) {
    return (
      <EmptyState
        iconName="cpu"
        title="Container is not running"
        text="Live resource statistics are only available while the container is running."
      />
    );
  }
  if (!sample) return <LoadingState label="Waiting for first stats sample…" />;

  const cpu = calculateCpuPercent(sample);
  const memory = calculateMemory(sample);
  const network = calculateNetwork(sample);
  const block = calculateBlock(sample);
  const pids = sample.pids_stats?.current ?? 0;
  const cores = sample.cpu_stats?.online_cpus || 1;

  return (
    <div className="metrics-grid">
      <Metric
        label="CPU"
        value={formatPercent(cpu)}
        sub={`${cores} core${cores > 1 ? 's' : ''}`}
        barPercent={cpu}
      />
      <Metric
        label="Memory"
        value={formatBytes(memory.usage)}
        sub={`of ${formatBytes(memory.limit)}`}
        barPercent={memory.percent}
      />
      <Metric
        label="Memory %"
        value={formatPercent(memory.percent, 1)}
        sub={`limit ${formatBytes(memory.limit)}`}
        barPercent={memory.percent}
      />
      <Metric label="PIDs" value={String(pids)} sub="processes / threads" />
      <Metric
        label="Network I/O"
        value={`${formatBytes(network.rx)} / ${formatBytes(network.tx)}`}
        sub="in / out"
      />
      <Metric
        label="Block I/O"
        value={`${formatBytes(block.read)} / ${formatBytes(block.write)}`}
        sub="read / write"
      />
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  barPercent,
}: {
  label: string;
  value: string;
  sub?: string;
  barPercent?: number;
}) {
  const percent = barPercent === undefined ? undefined : clamp(barPercent, 0, 100);
  const className =
    percent === undefined
      ? 'bar__fill'
      : percent > 85
        ? 'bar__fill bar__fill--danger'
        : percent > 60
          ? 'bar__fill bar__fill--warn'
          : 'bar__fill';

  return (
    <div className="metric">
      <div className="metric__label">{label}</div>
      <div className="metric__value">{value}</div>
      <div className="metric__sub">{sub || ''}</div>
      {percent !== undefined && (
        <div className="bar">
          <div className={className} style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
}

function calculateCpuPercent(sample: StatsSample): number {
  const current = sample.cpu_stats;
  const previous = sample.precpu_stats;
  if (!current?.cpu_usage || !previous?.cpu_usage) return 0;

  const cpuDelta = current.cpu_usage.total_usage - previous.cpu_usage.total_usage;
  const systemDelta = (current.system_cpu_usage || 0) - (previous.system_cpu_usage || 0);
  const cores = current.online_cpus || current.cpu_usage.percpu_usage?.length || 1;
  if (systemDelta <= 0 || cpuDelta <= 0) return 0;
  return (cpuDelta / systemDelta) * cores * 100;
}

function calculateMemory(sample: StatsSample) {
  const memory = sample.memory_stats || {};
  const limit = memory.limit || 0;
  const cache = memory.stats?.inactive_file ?? memory.stats?.cache ?? 0;
  const usage = Math.max(0, (memory.usage || 0) - cache);
  return { usage, limit, percent: limit ? (usage / limit) * 100 : 0 };
}

function calculateNetwork(sample: StatsSample) {
  let rx = 0;
  let tx = 0;
  Object.values(sample.networks || {}).forEach((network) => {
    rx += network.rx_bytes || 0;
    tx += network.tx_bytes || 0;
  });
  return { rx, tx };
}

function calculateBlock(sample: StatsSample) {
  const entries = sample.blkio_stats?.io_service_bytes_recursive || [];
  let read = 0;
  let write = 0;
  entries.forEach((entry) => {
    if (entry.op === 'read') read += entry.value || 0;
    if (entry.op === 'write') write += entry.value || 0;
  });
  return { read, write };
}
