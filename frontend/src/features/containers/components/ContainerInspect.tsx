import { useState } from 'react';
import { KeyValueList, StatusPill } from '@/components/ui/DataDisplay';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/toastContext';
import { copyText, downloadText } from '@/lib/browser';
import { formatDateTime } from '@/lib/format';
import type { ContainerInspect as ContainerInspectData } from '@/types/docker';

export function ContainerInspect({ detail }: { detail: ContainerInspectData }) {
  const toast = useToast();
  const [showRaw, setShowRaw] = useState(false);
  const config = detail.Config || {};
  const host = detail.HostConfig || {};
  const network = detail.NetworkSettings || {};
  const state = detail.State;
  const jsonText = JSON.stringify(detail, null, 2);
  const name = (detail.Name || detail.Id).replace(/^\//, '');
  const finished =
    state.FinishedAt && !/^0001/.test(state.FinishedAt) ? formatDateTime(state.FinishedAt) : '—';

  const copyJson = async () => {
    const copied = await copyText(jsonText);
    if (copied) toast.success('JSON copied');
    else toast.error('Copy failed');
  };

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 14 }}>
        <button className="btn btn--sm" onClick={copyJson}>
          <Icon name="copy" size={15} />
          <span>Copy JSON</span>
        </button>
        <button
          className="btn btn--sm"
          onClick={() => downloadText(jsonText, `${name}.inspect.json`, 'application/json')}
        >
          <Icon name="download" size={15} />
          <span>Download JSON</span>
        </button>
        <span style={{ flex: 1 }} />
        <label className="switch">
          <input
            type="checkbox"
            checked={showRaw}
            onChange={(event) => setShowRaw(event.target.checked)}
          />
          Raw JSON
        </label>
      </div>

      {showRaw ? (
        <pre className="log-viewer" style={{ minHeight: 200 }}>
          {jsonText}
        </pre>
      ) : (
        <>
          <div className="section-title">Overview</div>
          <KeyValueList
            pairs={[
              ['ID', <span className="mono">{detail.Id}</span>],
              ['Name', name],
              ['Status', <StatusPill state={state.Status} />],
              ['Image', <span className="mono">{config.Image || detail.Image}</span>],
              ['Created', formatDateTime(detail.Created)],
              ['Started', formatDateTime(state.StartedAt)],
              ['Finished', finished],
              ['Restart count', String(detail.RestartCount || 0)],
              [
                'Platform',
                [detail.Platform, detail.Os, detail.Architecture].filter(Boolean).join(' / ') ||
                  '—',
              ],
              ['Command', <span className="mono">{(config.Cmd || []).join(' ') || '—'}</span>],
            ]}
          />

          <div className="section-title" style={{ marginTop: 20 }}>
            Networking
          </div>
          <KeyValueList
            pairs={[
              [
                'IP address',
                network.IPAddress ? <span className="mono">{network.IPAddress}</span> : '—',
              ],
              ['Gateway', network.Gateway ? <span className="mono">{network.Gateway}</span> : '—'],
              [
                'MAC address',
                network.MacAddress ? <span className="mono">{network.MacAddress}</span> : '—',
              ],
              [
                'Networks',
                Object.keys(network.Networks || {}).map((key) => (
                  <span className="tag" key={key}>
                    {key}
                  </span>
                )),
              ],
              ['Ports', <span className="mono">{JSON.stringify(network.Ports || {})}</span>],
            ]}
          />

          <div className="section-title" style={{ marginTop: 20 }}>
            Host config
          </div>
          <KeyValueList
            pairs={[
              ['Restart policy', host.RestartPolicy?.Name || 'no'],
              ['Auto remove', host.AutoRemove ? 'yes' : 'no'],
              ['Privileged', host.Privileged ? 'yes' : 'no'],
              [
                'Binds',
                (host.Binds || []).map((bind) => (
                  <span className="mono tag" key={bind}>
                    {bind}
                  </span>
                )),
              ],
            ]}
          />
        </>
      )}
    </>
  );
}
