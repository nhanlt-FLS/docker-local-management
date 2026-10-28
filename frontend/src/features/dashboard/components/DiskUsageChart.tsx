import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { ViewId } from '@/app/types';
import { Icon, type IconName } from '@/components/ui/Icon';
import { formatBytes } from '@/lib/format';

export interface DiskUsageEntry {
  label: string;
  value: number;
  color: string;
  iconName: IconName;
  view: ViewId | null;
}

interface DiskUsageChartProps {
  entries: DiskUsageEntry[];
  total: number;
  onNavigate: (view: ViewId) => void;
}

/** Donut chart + interactive legend summarising Docker disk usage. */
export function DiskUsageChart({ entries, total, onNavigate }: DiskUsageChartProps) {
  const segments = entries.filter((entry) => entry.value > 0);
  const percentOf = (value: number) => (value / (total || 1)) * 100;

  return (
    <div className="disk-chart">
      <div className="disk-chart__donut">
        {segments.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={segments}
                dataKey="value"
                nameKey="label"
                innerRadius="70%"
                outerRadius="94%"
                paddingAngle={2}
                cornerRadius={4}
                stroke="none"
              >
                {segments.map((entry) => (
                  <Cell key={entry.label} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) =>
                  `${formatBytes(Number(value))} · ${percentOf(Number(value)).toFixed(1)}%`
                }
                contentStyle={{
                  background: 'var(--panel-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'var(--text)',
                }}
                labelStyle={{ color: 'var(--text-dim)', marginBottom: 4 }}
                itemStyle={{ color: 'var(--text)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
        <div className="disk-chart__center">
          <span className="disk-chart__center-value">{formatBytes(total)}</span>
          <span className="disk-chart__center-label">total</span>
        </div>
      </div>

      <div className="disk-chart__legend">
        {entries.map((entry) => (
          <div
            key={entry.label}
            className={`disk-legend__row${entry.view ? ' row-clickable' : ''}`}
            onClick={() => entry.view && onNavigate(entry.view)}
          >
            <span className="disk-legend__dot" style={{ background: entry.color }} />
            <span className="disk-legend__label">
              <Icon name={entry.iconName} size={14} />
              {entry.label}
            </span>
            <span className="mono disk-legend__size">{formatBytes(entry.value)}</span>
            <span className="cell-dim disk-legend__pct">{percentOf(entry.value).toFixed(1)}%</span>
          </div>
        ))}
        <div className="disk-legend__row disk-legend__row--total">
          <span className="disk-legend__dot disk-legend__dot--hidden" />
          <span className="disk-legend__label cell-strong">Total</span>
          <span className="mono disk-legend__size cell-strong">{formatBytes(total)}</span>
          <span className="cell-dim disk-legend__pct">100%</span>
        </div>
      </div>
    </div>
  );
}
