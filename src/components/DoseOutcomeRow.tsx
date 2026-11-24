import { formatTime } from '../utils/format';
import { sevTextClass } from '../utils/severity';
import type { HelpRow } from '../utils/doseOutcomes';

/**
 * One already-logged dose's "did it help?" row, shared by `UpdateAttackForm`
 * and `EndAttackForm`. `answered` just reads back `doseOutcomeWord`;
 * `too-soon` is informational, not a choice; `ask` reuses `MedicationEntry`'s
 * own follow-up slider shape so the two mechanisms read as one thing, not
 * two. There is deliberately no Yes/A bit/No tap here — `docs/redesign-v4-diff.md`
 * A1 rejected a stored verdict, so this always collects a severity reading
 * instead, which `doseOutcomeWord` turns back into words once saved.
 */
export function DoseOutcomeRow({ row, value, onChange }: {
  row: HelpRow;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const atText = formatTime(row.doseTimeIso);
  const label = `${row.name}${row.dose ? ` · ${row.dose}` : ''} · ${atText}`;

  if (row.state === 'answered') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-control bg-bg-raised p-3">
        <span className="text-sm text-text-primary">{label}</span>
        <span className="text-sm font-medium text-accent-light">{row.word}</span>
      </div>
    );
  }

  if (row.state === 'too-soon') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-control bg-bg-raised p-3">
        <span className="text-sm text-text-primary">{label}</span>
        <span className="text-sm text-text-secondary">Too soon to tell</span>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 rounded-control bg-bg-raised p-3">
      <p className="text-sm text-text-primary">{label}</p>
      {value === null ? (
        <button type="button" onClick={() => onChange(5)} className="btn-secondary btn-compact">
          Add how bad it was
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">How bad, about 2h after</span>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold tabular-nums ${sevTextClass(value)}`}>{value}</span>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="text-text-secondary hover:text-text-primary transition-colors"
                aria-label="Remove this reading"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <line x1="4" y1="4" x2="12" y2="12" />
                  <line x1="12" y1="4" x2="4" y2="12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-7">None</span>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={value}
              aria-label={`Severity about 2 hours after ${row.name}`}
              onChange={(e) => onChange(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-text-secondary w-12 text-right">Severe</span>
          </div>
        </div>
      )}
    </div>
  );
}
