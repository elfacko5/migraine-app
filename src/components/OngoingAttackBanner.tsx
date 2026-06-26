import { useEffect, useState } from 'react';
import type { Attack } from '../types';
import { formatElapsed } from '../utils/format';
import { attackMaxSeverity } from '../utils/stats';

interface Props {
  attack: Attack;
  onAddUpdate: () => void;
  onEnd: () => void;
}

function severityBg(s: number): string {
  if (s <= 3) return 'border-severity-low/40 bg-severity-low/10';
  if (s <= 6) return 'border-severity-mid/40 bg-severity-mid/10';
  if (s <= 8) return 'border-severity-mid/40 bg-severity-mid/10';
  return 'border-severity-high/40 bg-severity-high/10';
}

function severityText(s: number): string {
  if (s <= 3) return 'text-severity-low';
  if (s <= 6) return 'text-severity-mid';
  if (s <= 8) return 'text-severity-mid';
  return 'text-severity-high';
}

export function OngoingAttackBanner({ attack, onAddUpdate, onEnd }: Props) {
  const [, forceRender] = useState(0);

  // Tick elapsed time every minute.
  useEffect(() => {
    const id = setInterval(() => forceRender((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const maxSev = attackMaxSeverity(attack);
  const start = attack.snapshots[0].time;
  const areas = Object.keys(attack.snapshots[attack.snapshots.length - 1].areas);

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${severityBg(maxSev)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Ongoing attack</span>
            <span className={`text-xs font-bold ${severityText(maxSev)}`}>severity {maxSev}</span>
          </div>
          <p className="mt-0.5 text-sm text-text-primary">
            Started {formatElapsed(start)}
            {areas.length > 0 && <> · {areas.join(', ')}</>}
          </p>
        </div>
        <div className={`text-2xl font-bold tabular-nums leading-none ${severityText(maxSev)}`}>{maxSev}</div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAddUpdate}
          className="flex-1 rounded-lg bg-accent py-2 text-sm font-medium text-bg-base hover:bg-accent-light transition-colors"
        >
          Add update
        </button>
        <button
          type="button"
          onClick={onEnd}
          className="flex-1 rounded-lg border border-bg-border py-2 text-sm font-medium text-text-primary hover:bg-bg-raised transition-colors"
        >
          End attack
        </button>
      </div>
    </div>
  );
}
