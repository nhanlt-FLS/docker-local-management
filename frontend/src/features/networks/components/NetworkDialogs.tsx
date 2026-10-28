import { useEffect, useState } from 'react';
import { KeyValueList } from '@/components/ui/DataDisplay';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/toastContext';
import * as api from '@/lib/api';
import { copyText } from '@/lib/browser';
import { formatRelativeTime } from '@/lib/format';
import type { NetworkSummary } from '@/types/docker';
import { getNetworkSubnet } from '../networkUtils';

export function CreateNetworkDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [driver, setDriver] = useState('bridge');
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast.error('A network name is required.');
      return;
    }

    setBusy(true);
    try {
      await api.createNetwork({
        Name: name.trim(),
        Driver: driver || 'bridge',
        Internal: internal,
      });
      toast.success(`Created network ${name.trim()}`);
      onDone();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Create network"
      desc="Create a new Docker network."
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={submit} disabled={busy}>
            {busy ? 'Creating…' : 'Create'}
          </button>
        </>
      }
    >
      <div className="field">
        <label className="field__label" htmlFor="network-name">
          Name
        </label>
        <input
          id="network-name"
          className="input"
          placeholder="my-network"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="network-driver">
          Driver
        </label>
        <select
          id="network-driver"
          className="select"
          value={driver}
          onChange={(event) => setDriver(event.target.value)}
        >
          <option value="bridge">bridge</option>
          <option value="overlay">overlay</option>
          <option value="macvlan">macvlan</option>
        </select>
      </div>
      <div className="field">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={internal}
            onChange={(event) => setInternal(event.target.checked)}
          />
          Internal (restrict external access)
        </label>
      </div>
    </Modal>
  );
}

export function NetworkInspectDialog({
  network,
  onClose,
}: {
  network: NetworkSummary;
  onClose: () => void;
}) {
  const toast = useToast();
  const [fullDetails, setFullDetails] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let active = true;
    api
      .inspectNetwork(network.Id)
      .then((details) => {
        if (active) setFullDetails(details);
      })
      .catch(() => {
        if (active) setFullDetails(null);
      });
    return () => {
      active = false;
    };
  }, [network.Id]);

  const jsonText = JSON.stringify(fullDetails || network, null, 2);
  const containers = network.Containers ? Object.values(network.Containers) : [];
  const copyJson = async () => {
    const copied = await copyText(jsonText);
    if (copied) toast.success('JSON copied');
    else toast.error('Copy failed');
  };

  return (
    <Modal
      title={network.Name}
      desc={`Driver: ${network.Driver} · Scope: ${network.Scope}`}
      wide
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={copyJson}>
            <Icon name="copy" size={15} />
            <span>Copy JSON</span>
          </button>
          <button className="btn btn--primary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <KeyValueList
        pairs={[
          ['Name', network.Name],
          ['ID', <span className="mono">{network.Id}</span>],
          ['Driver', network.Driver],
          ['Scope', network.Scope],
          ['Subnet', getNetworkSubnet(network) || '—'],
          ['Created', network.Created ? formatRelativeTime(network.Created) : '—'],
          ['Internal', network.Internal ? 'yes' : 'no'],
        ]}
      />
      <div className="section-title" style={{ margin: '18px 0 10px' }}>
        Attached containers ({containers.length})
      </div>
      {containers.length === 0 ? (
        <div className="muted">None</div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>IPv4</th>
              </tr>
            </thead>
            <tbody>
              {containers.map((container) => (
                <tr key={container.EndpointID}>
                  <td>{container.Name}</td>
                  <td className="cell-mono">{container.IPv4Address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {fullDetails && (
        <pre className="log-viewer" style={{ minHeight: 140, marginTop: 16 }}>
          {jsonText}
        </pre>
      )}
    </Modal>
  );
}
