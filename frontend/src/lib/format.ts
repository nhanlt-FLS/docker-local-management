// Pure formatting helpers. Keeping them separate from components makes them
// easy to reuse and straightforward to unit test.

export function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let unitIndex = 0;
  let size = Number(value);

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const digits = size < 10 && unitIndex > 0 ? 2 : size < 100 && unitIndex > 0 ? 1 : 0;
  return `${size.toFixed(digits)} ${units[unitIndex]}`;
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return `${Number(value).toFixed(digits)}%`;
}

export function parseTime(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' && /^0001-01-01/.test(value)) return null;

  const date =
    typeof value === 'number' ? new Date(value * (value < 1e12 ? 1000 : 1)) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value: string | number | null | undefined): string {
  return parseTime(value)?.toLocaleString() ?? '—';
}

export function formatRelativeTime(value: string | number | null | undefined): string {
  const date = parseTime(value);
  if (!date) return '—';

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 0) return date.toLocaleTimeString();
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function shortenId(id: string | null | undefined, length = 12): string {
  if (!id) return '—';
  return id.replace(/^sha256:/, '').slice(0, length);
}

export function splitImageRef(reference: string): { name: string; tag: string } {
  if (!reference) return { name: '<none>', tag: '<none>' };

  const withoutDigest = reference.split('@')[0];
  const colonIndex = withoutDigest.lastIndexOf(':');
  const slashIndex = withoutDigest.lastIndexOf('/');

  if (colonIndex > slashIndex) {
    return {
      name: withoutDigest.slice(0, colonIndex),
      tag: withoutDigest.slice(colonIndex + 1),
    };
  }
  return { name: withoutDigest, tag: 'latest' };
}

export function stripAnsi(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
