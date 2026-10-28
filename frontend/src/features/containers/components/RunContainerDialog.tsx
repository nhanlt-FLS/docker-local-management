import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/toastContext';
import * as api from '@/lib/api';
import type { NetworkSummary } from '@/types/docker';
import { buildContainerConfig } from '../containerConfig';

interface RunContainerDialogProps {
  onClose: () => void;
  defaultImage?: string;
  onDone?: (id: string) => void;
}

export function RunContainerDialog({
  onClose,
  defaultImage = '',
  onDone,
}: RunContainerDialogProps) {
  const toast = useToast();
  const [image, setImage] = useState(defaultImage);
  const [name, setName] = useState('');
  const [network, setNetwork] = useState('');
  const [command, setCommand] = useState('');
  const [environment, setEnvironment] = useState('');
  const [ports, setPorts] = useState('');
  const [mounts, setMounts] = useState('');
  const [restart, setRestart] = useState('');
  const [pull, setPull] = useState(true);
  const [autoRemove, setAutoRemove] = useState(false);
  const [networks, setNetworks] = useState<NetworkSummary[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .listNetworks()
      .then((result) => {
        if (active) setNetworks(result);
      })
      .catch(() => {
        if (active) setNetworks([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const submit = async () => {
    const imageReference = image.trim();
    if (!imageReference) {
      toast.error('An image reference is required.');
      return;
    }

    setBusy(true);
    try {
      const config = buildContainerConfig({
        image: imageReference,
        command,
        environment,
        ports,
        mounts,
        restart,
        autoRemove,
        network,
      });

      if (pull) {
        try {
          const handle = await api.pullImage(imageReference, { onChunk: () => undefined });
          await handle.done;
        } catch {
          // createContainer below reports a useful error if the image is unavailable.
        }
      }

      const created = await api.createContainer(config, name.trim() || undefined);
      if (!created?.Id) throw new Error('Docker did not return a container id.');
      await api.startContainer(created.Id);
      toast.success(`Container ${name.trim() || created.Id.slice(0, 12)} started`);
      onDone?.(created.Id);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Run a new container"
      desc="Create and start a container from an image."
      wide
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={submit} disabled={busy}>
            {busy ? (
              <span className="spinner" style={{ width: 14, height: 14 }} />
            ) : (
              <Icon name="play" size={15} />
            )}
            <span>{busy ? 'Starting…' : 'Run'}</span>
          </button>
        </>
      }
    >
      <div className="field">
        <label className="field__label" htmlFor="run-image">
          Image
        </label>
        <input
          id="run-image"
          className="input"
          placeholder="e.g. nginx:latest, redis:7"
          value={image}
          onChange={(event) => setImage(event.target.value)}
        />
        <div className="field__hint">
          Reference of the image to run. Use <em>Pull if missing</em> to fetch it automatically.
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="field__label">
            Container name <span className="muted">(optional)</span>
          </label>
          <input
            className="input"
            placeholder="auto-generated"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="field">
          <label className="field__label">Network</label>
          <select
            className="select"
            value={network}
            onChange={(event) => setNetwork(event.target.value)}
          >
            <option value="">(default bridge)</option>
            {networks
              .filter((item) => item.Name !== 'none')
              .map((item) => (
                <option key={item.Id} value={item.Name}>
                  {item.Name} ({item.Driver})
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label className="field__label">
          Command <span className="muted">(optional override)</span>
        </label>
        <input
          className="input"
          placeholder="leave blank to use the image default"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
        />
      </div>

      <div className="field">
        <label className="field__label">Environment variables</label>
        <textarea
          className="textarea"
          placeholder={'KEY=value\nANOTHER=value'}
          value={environment}
          onChange={(event) => setEnvironment(event.target.value)}
        />
      </div>

      <div className="field">
        <label className="field__label">Published ports</label>
        <textarea
          className="textarea"
          placeholder={'8080:80\n127.0.0.1:5432:5432/tcp'}
          value={ports}
          onChange={(event) => setPorts(event.target.value)}
        />
        <div className="field__hint">
          One per line: <span className="mono">[hostIp:]hostPort:containerPort[/proto]</span>
        </div>
      </div>

      <div className="field">
        <label className="field__label">Mounts</label>
        <textarea
          className="textarea"
          placeholder={'/host/path:/container/path\nmyvolume:/data:ro'}
          value={mounts}
          onChange={(event) => setMounts(event.target.value)}
        />
        <div className="field__hint">
          One per line: <span className="mono">source:target[:ro]</span> (host path or named
          volume).
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="field__label">Restart policy</label>
          <select
            className="select"
            value={restart}
            onChange={(event) => setRestart(event.target.value)}
          >
            <option value="">no</option>
            <option value="always">always</option>
            <option value="unless-stopped">unless-stopped</option>
            <option value="on-failure">on-failure</option>
          </select>
        </div>
        <div
          className="field"
          style={{ display: 'flex', alignItems: 'flex-end', gap: 16, paddingBottom: 4 }}
        >
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={pull}
              onChange={(event) => setPull(event.target.checked)}
            />
            Pull if missing
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={autoRemove}
              onChange={(event) => setAutoRemove(event.target.checked)}
            />
            Auto-remove
          </label>
        </div>
      </div>
    </Modal>
  );
}
