import type { Attack } from '../types';
import { formatDate, formatTime, formatDuration } from '../utils/format';
import { attackMaxSeverity } from '../utils/stats';
import { SeveritySparkline } from './SeverityChart';

function sevBadge(s: number): string {
  if (s <= 3) return 'bg-severity-low/20 text-severity-low border-severity-low/30';
  if (s <= 6) return 'bg-severity-mid/20 text-severity-mid border-severity-mid/30';
  if (s <= 8) return 'bg-severity-mid/20 text-severity-mid border-severity-mid/30';
  return 'bg-severity-high/20 text-severity-high border-severity-high/30';
}

interface Props {
  attack: Attack;
  onClick: () => void;
  isOngoing?: boolean;
}

export function AttackCard({ attack, onClick, isOngoing }: Props) {
  const maxSev = attackMaxSeverity(attack);
  const start = attack.snapshots[0];
  const peakAreas = Object.keys(
    attack.snapshots.reduce<Record<string, number>>((acc, s) => {
      for (const [k, v] of Object.entries(s.areas)) {
        if ((acc[k] ?? 0) < v) acc[k] = v;
      }
      return acc;
    }, {})
  );
  const meds = [
    ...new Set(attack.snapshots.map((s) => s.medication?.name).filter(Boolean)),
  ] as string[];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition-colors hover:bg-bg-raised/70 ${
        isOngoing ? 'border-accent/40 bg-accent/10' : 'border-bg-border/60 bg-bg-raised/40'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isOngoing && (
              <span className="text-xs font-medium text-accent-light uppercase tracking-wider">Ongoing</span>
            )}
            <span className="text-sm font-medium text-text-primary">{formatDate(start.time)}</span>
            <span className="text-xs text-text-secondary">{formatTime(start.time)}</span>
          </div>

          <p className="text-xs text-text-secondary">
            {isOngoing ? 'In progress' : formatDuration(start.time, attack.end)}
            {attack.snapshots.length > 1 && ` · ${attack.snapshots.length} snapshots`}
          </p>

          {peakAreas.length > 0 && (
            <p className="text-xs text-text-secondary truncate">{peakAreas.join(', ')}</p>
          )}

          <div className="flex flex-wrap gap-1 pt-0.5">
            {attack.triggers.slice(0, 3).map((t) => (
              <span key={t} className="text-xs bg-bg-border/60 text-text-secondary rounded-full px-2 py-0.5">{t}</span>
            ))}
            {meds.map((m) => (
              <span key={m} className="text-xs bg-accent/20 text-accent-light rounded-full px-2 py-0.5">💊 {m}</span>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`rounded-lg border px-2 py-1 text-lg font-bold tabular-nums ${sevBadge(maxSev)}`}>
            {maxSev}
          </span>
          <SeveritySparkline attack={attack} />
        </div>
      </div>
    </button>
  );
}
