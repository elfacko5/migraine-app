import type { Attack } from '../types';
import { formatDate, formatTime, formatDuration } from '../utils/format';
import { attackMaxSeverity } from '../utils/stats';
import { SeverityChart } from './SeverityChart';
import { SnapshotRow } from './SnapshotRow';

interface Props {
  attack: Attack;
  onDelete: () => void;
  onClose: () => void;
}

export function AttackDetail({ attack, onDelete, onClose }: Props) {
  const maxSev = attackMaxSeverity(attack);
  const start = attack.snapshots[0];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{formatDate(start.time)}</h2>
        <p className="text-sm text-text-secondary">
          {attack.end
            ? formatDuration(start.time, attack.end) + ' duration'
            : 'Ongoing'}
          {' · '}max severity {maxSev}
        </p>
        {attack.triggers.length > 0 && (
          <p className="text-xs text-text-secondary mt-1">{attack.triggers.join(', ')}</p>
        )}
      </div>

      {/* Severity chart */}
      <SeverityChart attack={attack} height={180} />

      {/* Snapshot timeline */}
      <div>
        <p className="text-xs uppercase tracking-wider font-medium text-text-secondary mb-3">Timeline</p>
        {attack.snapshots.map((snap, i) => (
          <SnapshotRow key={i} snap={snap} isFirst={i === 0} />
        ))}
        {attack.end && (
          <div className="flex gap-3 items-center">
            <div className="flex flex-col items-center">
              <div className="h-3 w-3 rounded-full bg-bg-border shrink-0 mt-0.5" />
            </div>
            <p className="text-xs text-text-secondary pb-4">Attack ended · {formatTime(attack.end)}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="pt-2 border-t border-bg-border">
        <button
          type="button"
          onClick={() => {
            if (confirm('Delete this attack?')) { onDelete(); onClose(); }
          }}
          className="w-full rounded-xl border border-severity-high/30 py-3 text-sm font-medium text-severity-high hover:bg-severity-high/10 transition-colors"
        >
          Delete attack
        </button>
      </div>
    </div>
  );
}
