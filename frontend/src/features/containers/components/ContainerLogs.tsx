import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import * as api from '@/lib/api';
import type { StreamHandle } from '@/lib/api';
import { copyText, downloadText } from '@/lib/browser';
import { stripAnsi } from '@/lib/format';
import type { ContainerInspect } from '@/types/docker';

const MAX_LOG_CHARACTERS = 400000;

export function ContainerLogs({ detail }: { detail: ContainerInspect }) {
  const running = detail.State?.Status === 'running';
  const [tail, setTail] = useState('500');
  const [timestamps, setTimestamps] = useState(false);
  const [follow, setFollow] = useState(running);
  const [reloadKey, setReloadKey] = useState(0);
  const preRef = useRef<HTMLPreElement | null>(null);
  const autoScroll = useRef(true);

  const setLogText = useCallback((text: string) => {
    const element = preRef.current;
    if (!element) return;
    element.textContent = stripAnsi(text) || '(no output)';
    element.scrollTop = element.scrollHeight;
  }, []);

  useEffect(() => {
    const element = preRef.current;
    if (!element) return undefined;

    let stream: StreamHandle | null = null;
    let cancelled = false;

    if (follow) {
      element.textContent = '';
      api
        .followLogs(detail.Id, {
          tail,
          timestamps,
          onChunk: (chunk) => {
            const node = preRef.current;
            if (cancelled || !chunk || !node) return;

            // Direct DOM updates avoid a React render for every high-frequency log chunk.
            node.textContent += stripAnsi(chunk);
            if (node.textContent.length > MAX_LOG_CHARACTERS) {
              node.textContent = node.textContent.slice(-MAX_LOG_CHARACTERS);
            }
            if (autoScroll.current) node.scrollTop = node.scrollHeight;
          },
        })
        .then((handle) => {
          if (cancelled) handle.abort();
          else stream = handle;
        })
        .catch((requestError: unknown) => {
          if (preRef.current) {
            const message =
              requestError instanceof Error ? requestError.message : String(requestError);
            preRef.current.textContent = `Failed to follow logs: ${message}`;
          }
        });
    } else {
      element.textContent = 'Loading logs…';
      api
        .containerLogs(detail.Id, { tail, timestamps })
        .then((text) => {
          if (!cancelled) setLogText(text);
        })
        .catch((requestError: unknown) => {
          if (!cancelled && preRef.current) {
            const message =
              requestError instanceof Error ? requestError.message : String(requestError);
            preRef.current.textContent = `Failed to load logs: ${message}`;
          }
        });
    }

    return () => {
      cancelled = true;
      stream?.abort();
    };
  }, [detail.Id, tail, timestamps, follow, reloadKey, setLogText]);

  const handleScroll = () => {
    const element = preRef.current;
    if (!element) return;
    autoScroll.current = element.scrollHeight - element.scrollTop - element.clientHeight < 40;
  };

  const download = () => {
    const name = (detail.Name || detail.Id).replace(/^\//, '');
    downloadText(preRef.current?.textContent || '', `${name}.log`);
  };

  return (
    <>
      <div className="log-toolbar">
        <label className="switch">
          <span>Tail</span>
          <select
            className="select"
            style={{ width: 'auto', padding: '4px 26px 4px 8px' }}
            value={tail}
            onChange={(event) => setTail(event.target.value)}
          >
            <option>100</option>
            <option>500</option>
            <option>1000</option>
            <option>5000</option>
          </select>
        </label>
        <label className="switch">
          <input
            type="checkbox"
            checked={timestamps}
            onChange={(event) => setTimestamps(event.target.checked)}
          />
          Timestamps
        </label>
        <label className="switch">
          <input
            type="checkbox"
            checked={follow}
            onChange={(event) => setFollow(event.target.checked)}
          />
          Follow
        </label>
        <span className="spacer" style={{ flex: 1 }} />
        <button
          className="btn btn--sm"
          onClick={() => void copyText(preRef.current?.textContent || '')}
        >
          <Icon name="copy" size={15} />
          <span>Copy</span>
        </button>
        <button className="btn btn--sm" onClick={download}>
          <Icon name="download" size={15} />
          <span>Download</span>
        </button>
        <button
          className="btn btn--sm"
          onClick={() => {
            if (preRef.current) preRef.current.textContent = '';
          }}
        >
          <Icon name="close" size={15} />
          <span>Clear</span>
        </button>
        <button className="btn btn--sm" onClick={() => setReloadKey((current) => current + 1)}>
          <Icon name="refresh" size={15} />
          <span>Reload</span>
        </button>
      </div>
      <pre ref={preRef} className="log-viewer" onScroll={handleScroll} />
    </>
  );
}
