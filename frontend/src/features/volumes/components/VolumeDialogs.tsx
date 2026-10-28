import { useEffect, useState } from 'react';
import { KeyValueList } from '@/components/ui/DataDisplay';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/toastContext';
import * as api from '@/lib/api';
import { copyText } from '@/lib/browser';
import { formatBytes, formatRelativeTime } from '@/lib/format';
import type { VolumeSummary } from '@/types/docker';

export function CreateVolumeDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [driver, setDriver] = useState('local');
  const [options, setOptions] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast.error('A volume name is required.');
      return;
    }

    setBusy(true);
    try {
      const config: Record<string, unknown> = {
        Name: name.trim(),
        Driver: driver || 'local',
      };
      const driverOptions: Record<string, string> = {};

      options
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => {
          const separator = line.indexOf('=');
          if (separator > 0) {
            driverOptions[line.slice(0, separator)] = line.slice(separator + 1);
          }
        });
      if (Object.keys(driverOptions).length) config.Options = driverOptions;

      await api.createVolume(config);
      toast.success(`Created volume ${name.trim()}`);
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
      title="Create volume"
      desc="Create a new named volume."
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
        <label className="field__label" htmlFor="volume-name">
          Name
        </label>
        <input
          id="volume-name"
          className="input"
          placeholder="my-volume"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="volume-driver">
          Driver
        </label>
        <input
          id="volume-driver"
          className="input"
          value={driver}
          onChange={(event) => setDriver(event.target.value)}
        />
      </div>
      <div className="field">
        <label className="field__label">
          Driver options <span className="muted">(optional)</span>
        </label>
        <textarea
          className="textarea"
          placeholder="key=value"
          value={options}
          onChange={(event) => setOptions(event.target.value)}
        />
      </div>
    </Modal>
  );
}

export function VolumeInspectDialog({
  volume,
  onClose,
}: {
  volume: VolumeSummary;
  onClose: () => void;
}) {
  const toast = useToast();
  const [fullDetails, setFullDetails] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let active = true;
    api
      .inspectVolume(volume.Name)
      .then((details) => {
        if (active) setFullDetails(details);
      })
      .catch(() => {
        if (active) setFullDetails(null);
      });
    return () => {
      active = false;
    };
  }, [volume.Name]);

  const jsonText = JSON.stringify(fullDetails || volume, null, 2);
  const copyJson = async () => {
    const copied = await copyText(jsonText);
    if (copied) toast.success('JSON copied');
    else toast.error('Copy failed');
  };

  return (
    <Modal
      title={volume.Name}
      desc={`Driver: ${volume.Driver}`}
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
          ['Name', volume.Name],
          ['Driver', volume.Driver],
          ['Scope', volume.Scope],
          ['Mountpoint', <span className="mono">{volume.Mountpoint}</span>],
          ['Created', volume.Created ? formatRelativeTime(volume.Created) : '—'],
          [
            'Size',
            volume.UsageData && volume.UsageData.Size >= 0
              ? formatBytes(volume.UsageData.Size)
              : '—',
          ],
          ['Ref count', volume.UsageData ? String(volume.UsageData.RefCount) : '—'],
          [
            'Labels',
            Object.keys(volume.Labels || {}).length ? (
              <span className="mono">{JSON.stringify(volume.Labels)}</span>
            ) : (
              '—'
            ),
          ],
        ]}
      />
      {fullDetails && (
        <pre className="log-viewer" style={{ minHeight: 160, marginTop: 16 }}>
          {jsonText}
        </pre>
      )}
    </Modal>
  );
}
