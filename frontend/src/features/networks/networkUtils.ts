import type { NetworkSummary } from '@/types/docker';

const BUILT_IN_NETWORKS = new Set(['bridge', 'host', 'none']);

export function isBuiltInNetwork(network: NetworkSummary): boolean {
  return BUILT_IN_NETWORKS.has(network.Name);
}

export function getNetworkSubnet(network: NetworkSummary): string {
  const config = network.IPAM?.Config;
  if (!config?.length) return '';
  return config
    .map((item) => item.Subnet)
    .filter(Boolean)
    .join(', ');
}
