import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import * as api from '@/lib/api';
import type { StreamHandle } from '@/lib/api';

interface LayerProgress {
  status: string;
  current?: number;
  total?: number;
}

interface PullEvent {
  id?: string;
  status?: string;
  error?: string;
  progressDetail?: { current?: number; total?: number };
}

export function PullImageDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [reference, setReference] = useState('');
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [layers, setLayers] = useState<Record<string, LayerProgress>>({});
  const streamRef = useRef<StreamHandle | null>(null);

  useEffect(() => () => streamRef.current?.abort(), []);

  const start = async () => {
    const target = reference.trim();
    if (!target) return;

    setStarted(true);
    setFinished(false);
    setError('');
    setLayers({});
    setStatus(`Pulling ${target}…`);

    let buffer = '';
    let failed = false;

    try {
      const handle = await api.pullImage(target, {
        onChunk: (chunk) => {
          buffer += chunk;
          let newlineIndex: number;
          let updates: Record<string, LayerProgress> | null = null;

          while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            if (!line) continue;

            try {
              const event = JSON.parse(line) as PullEvent;
              if (event.error) {
                failed = true;
                setError(event.error);
                continue;
              }
              if (event.id) {
                updates ??= {};
                updates[event.id] = {
                  status: event.status || '',
                  current: event.progressDetail?.current,
                  total: event.progressDetail?.total,
                };
              }
              if (event.status && !event.id) setStatus(event.status);
            } catch {
              // A partial JSON line is completed by a later stream chunk.
            }
          }

          if (updates) setLayers((current) => ({ ...current, ...updates }));
        },
      });

      streamRef.current = handle;
      await handle.done;
      setFinished(true);
      if (!failed) {
        setStatus('Pull complete');
        onDone();
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    }
  };

  const close = () => {
    streamRef.current?.abort();
    onClose();
  };
  const layerEntries = Object.entries(layers);

  return (
    <Modal
      title="Pull an image"
      desc="Download an image from a registry (Docker Hub by default)."
      wide
      onClose={close}
      footer={
        <>
          <button className="btn btn--ghost" onClick={close}>
            {finished ? 'Close' : 'Cancel'}
          </button>
          {!finished && (
            <button className="btn btn--primary" onClick={start} disabled={started}>
              {started ? (
                <span className="spinner" style={{ width: 14, height: 14 }} />
              ) : (
                <Icon name="download" size={15} />
              )}
              <span>{started ? 'Pulling…' : 'Pull'}</span>
            </button>
          )}
        </>
      }
    >
      <div className="field">
        <label className="field__label" htmlFor="pull-image-ref">
          Image reference
        </label>
        <input
          id="pull-image-ref"
          className="input"
          placeholder="nginx:latest"
          value={reference}
          disabled={started}
          onChange={(event) => setReference(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !started) void start();
          }}
        />
        <div className="field__hint">
          Format: <span className="mono">[registry/]repository[:tag]</span>. Defaults to Docker Hub
          and <span className="mono">:latest</span>.
        </div>
      </div>

      {started && (
        <div style={{ marginTop: 8 }}>
          <div className="section-title">Progress</div>
          {error ? (
            <div className="error-box">{error}</div>
          ) : layerEntries.length === 0 ? (
            <div className="pull-stream">{status || 'Contacting registry…'}</div>
          ) : (
            <div className="pull-stream" style={{ whiteSpace: 'normal' }}>
              {layerEntries.map(([id, layer]) => {
                const percent = layer.total
                  ? Math.min(100, Math.round(((layer.current || 0) / layer.total) * 100))
                  : 0;
                return (
                  <div className="pull-layer" key={id}>
                    <span className="pull-layer__id">{id}</span>
                    <span className="pull-layer__bar">
                      <span className="pull-layer__fill" style={{ width: `${percent}%` }} />
                    </span>
                    <span className="pull-layer__status">
                      {layer.status}
                      {layer.total ? ` ${percent}%` : ''}
                    </span>
                  </div>
                );
              })}
              <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                {status}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
