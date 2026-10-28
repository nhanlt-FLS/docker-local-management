import { useCallback, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useInterval } from '@/hooks/useInterval';
import * as api from '@/lib/api';
import type { ContainerInspect, ContainerTop } from '@/types/docker';

const EMPTY_TOP: ContainerTop = { Titles: [], Processes: [] };

export function ContainerProcesses({ detail }: { detail: ContainerInspect }) {
  const running = detail.State?.Status === 'running';
  const [autoRefresh, setAutoRefresh] = useState(true);
  const loadProcesses = useCallback(
    () => (running ? api.containerTop(detail.Id) : Promise.resolve(EMPTY_TOP)),
    [detail.Id, running],
  );
  const {
    data: top,
    error,
    loading,
    reload,
  } = useAsyncData(loadProcesses, `${detail.Id}:${running}`);
  useInterval(() => void reload(true), autoRefresh && running ? 2000 : null);

  if (!running) {
    return (
      <EmptyState
        iconName="terminal"
        title="Container is not running"
        text="The process list is only available while the container is running."
      />
    );
  }
  if (error && !top) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !top) return <LoadingState label="Loading processes…" />;
  if (!top) return null;

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <label className="switch">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(event) => setAutoRefresh(event.target.checked)}
          />
          Auto-refresh (2s)
        </label>
        <span style={{ flex: 1 }} />
        <button className="btn btn--sm" onClick={() => void reload()}>
          <Icon name="refresh" size={15} />
          <span>Refresh</span>
        </button>
      </div>
      {top.Processes.length === 0 ? (
        <EmptyState title="No processes reported" />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                {top.Titles.map((title) => (
                  <th key={title}>{title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {top.Processes.map((row, rowIndex) => (
                <tr key={`${row[0]}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td className="cell-mono" key={`${cellIndex}-${cell}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
