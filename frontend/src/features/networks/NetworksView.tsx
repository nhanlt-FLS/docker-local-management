import { useEffect, useMemo, useState } from 'react';
import type { ViewProps } from '@/app/types';
import { useDialog } from '@/components/ui/dialogContext';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/toastContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import * as api from '@/lib/api';
import { shortenId } from '@/lib/format';
import type { NetworkSummary } from '@/types/docker';
import { CreateNetworkDialog, NetworkInspectDialog } from './components/NetworkDialogs';
import { getNetworkSubnet, isBuiltInNetwork } from './networkUtils';

export function NetworksView({ filter, refreshSignal, setPrimaryAction, onMutated }: ViewProps) {
  const toast = useToast();
  const { confirm } = useDialog();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkSummary | null>(null);
  const { data, error, loading, reload } = useAsyncData(api.listNetworks, refreshSignal);

  useEffect(() => {
    setPrimaryAction({ label: 'Create network', icon: 'plus', onClick: () => setCreateOpen(true) });
    return () => setPrimaryAction(null);
  }, [setPrimaryAction]);

  const networks = useMemo(() => data ?? [], [data]);
  const rows = useMemo(() => {
    const sorted = [...networks].sort((a, b) => a.Name.localeCompare(b.Name));
    const search = filter.toLowerCase();
    if (!search) return sorted;
    return sorted.filter((network) =>
      [network.Name, network.Id, network.Driver, network.Scope]
        .join(' ')
        .toLowerCase()
        .includes(search),
    );
  }, [networks, filter]);

  const handleMutated = () => {
    void reload(true);
    onMutated?.();
  };

  const remove = async (network: NetworkSummary) => {
    const confirmed = await confirm({
      title: 'Remove network',
      message: `Remove network "${network.Name}"?`,
      details: network.Id,
      confirmLabel: 'Remove',
    });
    if (!confirmed) return;

    try {
      await api.removeNetwork(network.Id);
      toast.success(`Removed ${network.Name}`);
      handleMutated();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : String(requestError));
    }
  };

  const prune = async () => {
    const confirmed = await confirm({
      title: 'Prune networks',
      message: 'Remove all unused networks? This cannot be undone.',
      confirmLabel: 'Prune',
    });
    if (!confirmed) return;

    try {
      const result = await api.pruneNetworks();
      toast.success(`Pruned ${(result.NetworksDeleted || []).length} network(s)`);
      handleMutated();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : String(requestError));
    }
  };

  return (
    <>
      <div className="view-head">
        <div className="toolbar">
          <button className="btn btn--sm" onClick={() => setCreateOpen(true)}>
            <Icon name="plus" size={15} />
            <span>Create</span>
          </button>
          <button className="btn btn--sm" onClick={prune}>
            <Icon name="prune" size={15} />
            <span>Prune unused</span>
          </button>
        </div>
        <span className="view-head__spacer" />
        <div className="muted nowrap">{networks.length} networks</div>
      </div>

      {loading && !data ? (
        <LoadingState label="Loading networks…" />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState
          iconName="network"
          title={networks.length ? 'No networks match' : 'No networks'}
          text={
            networks.length
              ? 'Try a different search term.'
              : 'Create a network to connect containers.'
          }
          action={{ label: 'Create network', icon: 'plus', onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: '24%' }}>Name</th>
                  <th style={{ width: '12%' }}>Driver</th>
                  <th style={{ width: '10%' }}>Scope</th>
                  <th style={{ width: '18%' }}>Subnet</th>
                  <th style={{ width: '12%' }}>Containers</th>
                  <th className="right" style={{ width: '14%' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((network) => {
                  const builtIn = isBuiltInNetwork(network);
                  return (
                    <tr key={network.Id}>
                      <td>
                        <div className="name-cell">
                          <div
                            className="name-cell__avatar"
                            style={
                              builtIn
                                ? { background: 'var(--grey-soft)', color: 'var(--text-mute)' }
                                : undefined
                            }
                          >
                            <Icon name="network" size={18} />
                          </div>
                          <div className="name-cell__text">
                            <span
                              className="name-cell__primary"
                              style={{ cursor: 'pointer' }}
                              onClick={() => setSelectedNetwork(network)}
                            >
                              {network.Name} {builtIn && <span className="tag">built-in</span>}
                            </span>
                            <span className="name-cell__secondary">{shortenId(network.Id)}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="tag">{network.Driver}</span>
                      </td>
                      <td className="cell-dim">{network.Scope}</td>
                      <td className="cell-mono">{getNetworkSubnet(network) || '—'}</td>
                      <td className="cell-dim nowrap">
                        {network.Containers ? Object.keys(network.Containers).length : 0}
                      </td>
                      <td>
                        <div className="cell-actions">
                          <button
                            className="btn btn--sm btn--icon"
                            title="Inspect"
                            aria-label="Inspect network"
                            onClick={() => setSelectedNetwork(network)}
                          >
                            <Icon name="inspect" size={16} />
                          </button>
                          <button
                            className="btn btn--sm btn--icon btn--danger"
                            title={builtIn ? 'Built-in networks cannot be removed' : 'Remove'}
                            aria-label="Remove network"
                            disabled={builtIn}
                            onClick={() => remove(network)}
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {createOpen && (
        <CreateNetworkDialog onClose={() => setCreateOpen(false)} onDone={handleMutated} />
      )}
      {selectedNetwork && (
        <NetworkInspectDialog network={selectedNetwork} onClose={() => setSelectedNetwork(null)} />
      )}
    </>
  );
}
