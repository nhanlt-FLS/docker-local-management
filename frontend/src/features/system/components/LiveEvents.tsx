import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import * as api from '@/lib/api';
import type { StreamHandle } from '@/lib/api';
import { shortenId } from '@/lib/format';
import type { DockerEvent } from '@/types/docker';

export function LiveEvents() {
  const [streaming, setStreaming] = useState(false);
  const [events, setEvents] = useState<DockerEvent[]>([]);
  const streamRef = useRef<StreamHandle | null>(null);

  useEffect(() => () => streamRef.current?.abort(), []);

  const toggle = async () => {
    if (streaming) {
      streamRef.current?.abort();
      streamRef.current = null;
      setStreaming(false);
      return;
    }

    setEvents([]);
    setStreaming(true);
    try {
      streamRef.current = await api.streamEvents({
        onJson: (event) => setEvents((current) => [event, ...current].slice(0, 80)),
      });
    } catch {
      setStreaming(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel__head">
        <span className="panel__title">
          <Icon name="clock" size={16} /> Live events
        </span>
        <span style={{ flex: 1 }} />
        <label className="switch" style={{ marginRight: 10 }}>
          <input type="checkbox" checked={streaming} onChange={toggle} />
          <span>{streaming ? 'Streaming' : 'Paused'}</span>
        </label>
        <button className="btn btn--sm" onClick={() => setEvents([])} disabled={!events.length}>
          Clear
        </button>
      </div>
      <div className="panel__body" style={{ padding: 0 }}>
        {!streaming && events.length === 0 ? (
          <div className="empty" style={{ padding: '28px 16px' }}>
            <div className="empty__title">Event stream is paused</div>
            <div className="empty__text">
              Toggle the switch to stream Docker engine events (start, stop, die, pull, …) in real
              time.
            </div>
          </div>
        ) : events.length === 0 ? (
          <div className="empty" style={{ padding: '28px 16px' }}>
            <div className="empty__title">Waiting for events…</div>
            <div className="empty__text">Interact with Docker and events will appear here.</div>
          </div>
        ) : (
          <div className="table-wrap" style={{ maxHeight: 340, overflow: 'auto' }}>
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Time</th>
                  <th style={{ width: 90 }}>Type</th>
                  <th style={{ width: 130 }}>Action</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event, index) => (
                  <tr key={`${event.timeNano || event.time}-${event.id}-${index}`}>
                    <td className="cell-dim nowrap">
                      {new Date(event.time * 1000).toLocaleTimeString()}
                    </td>
                    <td>
                      <span className="tag">{event.Type || '—'}</span>
                    </td>
                    <td className="cell-mono">{event.Action || event.status || '—'}</td>
                    <td className="cell-mono">
                      {event.Actor?.Attributes?.name || shortenId(event.Actor?.ID || event.id, 16)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
