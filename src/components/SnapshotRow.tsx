import type { Snapshot } from '../types';
import { maxSeverity } from '../utils/stats';
import { formatTime } from '../utils/format';

function sevColor(s: number): string {
  if (s <= 3) return 'text-severity-low';
  if (s <= 8) return 'text-severity-mid';
  return 'text-severity-high';
}

interface Props { snap: Snapshot; isFirst: boolean }

export function SnapshotRow({ snap, isFirst }: Props) {
  const sev = maxSeverity(snap);
  const label =
    snap.source === 'notification_no_change' ? '(no change)' :
    snap.source === 'notification_yes' ? '(via notification)' :
    isFirst ? 'Attack start' : 'Update';

  return (
    <div className="flex gap-3">
      {/* Timeline stem */}
      <div className="flex flex-col items-center">
        <div className={`h-3 w-3 rounded-full shrink-0 mt-0.5 ${isFirst ? 'bg-accent' : 'bg-bg-border'}`} />
        <div className="flex-1 w-px bg-bg-raised mt-1" />
      </div>

      <div className="pb-4 min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-text-secondary">{formatTime(snap.time)}</span>
          <span className="text-xs text-text-secondary">{label}</span>
          {sev > 0 && <span className={`text-xs font-bold ${sevColor(sev)}`}>sev {sev}</span>}
        </div>

        {Object.keys(snap.areas).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(snap.areas).map(([area, s]) => (
              <span key={area} className={`text-xs font-medium ${sevColor(s)}`}>{area} {s}</span>
            ))}
          </div>
        )}

        {snap.symptoms.length > 0 && (
          <p className="mt-0.5 text-xs text-text-secondary">{snap.symptoms.join(', ')}</p>
        )}

        {(snap.reliefs ?? []).length > 0 && (
          <p className="mt-0.5 text-xs text-text-secondary">Relief: {snap.reliefs!.join(', ')}</p>
        )}

        {snap.medication && (
          <p className="mt-0.5 text-xs text-accent-light">
            💊 {snap.medication.name}{snap.medication.dose && ` ${snap.medication.dose}`}
          </p>
        )}

        {snap.note && (
          <p className="mt-0.5 text-xs italic text-text-secondary">{snap.note}</p>
        )}
      </div>
    </div>
  );
}
