import type { Snapshot } from '../types';
import { formatTime } from '../utils/format';
import { medIcon, medColor } from '../utils/medDisplay';

function sevColor(s: number): string {
  if (s <= 3) return 'text-severity-low';
  if (s <= 8) return 'text-severity-mid';
  return 'text-severity-high';
}

// dateLabel is only passed when the attack spans multiple calendar days —
// for a same-day attack the header already states the date, so repeating it
// on every row is noise.
interface Props { snap: Snapshot; isFirst: boolean; dateLabel?: string }

export function SnapshotRow({ snap, isFirst, dateLabel }: Props) {
  const label =
    snap.source === 'notification_no_change' ? '(no change)' :
    snap.source === 'notification_yes' ? '(via notification)' :
    isFirst ? 'Attack start' : null;
  const areaCount = Object.keys(snap.areas).length;

  return (
    <div className="flex gap-3">
      {/* Timeline stem — the time itself sits in a pill marker instead of a
          plain dot, so the moment each reading was taken is the first thing
          that's scannable down the column. A fixed width keeps the
          connecting line's x-position — and the pill above it — identical
          across rows regardless of whether the time is 4 or 5 characters
          wide (e.g. "9:09" vs "11:03"). */}
      <div className="relative flex flex-col items-center w-16 shrink-0">
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-bg-border" />
        {dateLabel && (
          <span className="relative mb-1 text-[0.65rem] font-medium text-text-secondary whitespace-nowrap">{dateLabel}</span>
        )}
        <span className="relative shrink-0 rounded-full bg-bg-raised border border-bg-border px-2.5 py-1 text-xs font-bold tabular-nums text-text-primary whitespace-nowrap">
          {formatTime(snap.time)}
        </span>
      </div>

      <div className="pb-4 min-w-0 flex-1 pt-1">
        {/* First line: pain area + severity — the one thing worth scanning for */}
        {areaCount > 0 && (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            {Object.entries(snap.areas).map(([area, s]) => (
              <span key={area} className={`text-sm font-medium ${sevColor(s)}`}>{area} {s}</span>
            ))}
          </div>
        )}

        {label && (
          <p className={`mt-0.5 text-xs ${isFirst ? 'font-medium text-accent-light' : 'text-text-secondary'}`}>{label}</p>
        )}

        {snap.symptoms.length > 0 && (
          <p className="mt-0.5 text-xs text-text-secondary">{snap.symptoms.join(', ')}</p>
        )}

        {(snap.reliefs ?? []).length > 0 && (
          <p className="mt-0.5 text-xs text-text-secondary">Relief: {snap.reliefs!.join(', ')}</p>
        )}

        {snap.medication && (
          <p className="mt-0.5 text-xs font-medium" style={{ color: medColor(snap.medication.name) }}>
            {medIcon(snap.medication.name, snap.medication.dose)} {snap.medication.name}{snap.medication.dose && ` ${snap.medication.dose}`}
          </p>
        )}

        {snap.note && (
          <p className="mt-0.5 text-xs italic text-text-secondary">{snap.note}</p>
        )}
      </div>
    </div>
  );
}
