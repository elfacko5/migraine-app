import { ReliefIcon, SymptomIcon } from './drawnIcons';
import { sevFillClass } from '../utils/severity';

// Small pieces Attack detail's summary rows and timeline both draw, so a
// severity or a symptom looks the same in both places.

/** Severity as a solid box with its number — the same fill as the Logs row. */
export function SevBox({ value, className = 'h-9 w-11 text-sm' }: { value: number; className?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-badge font-semibold tabular-nums text-bg-base ${sevFillClass(value)} ${className}`}>
      {value}
    </span>
  );
}

/** Symptoms or reliefs as icon chips. Read-only: not buttons. */
export function MarkChips({ kind, names }: { kind: 'symptom' | 'relief'; names: string[] }) {
  const Icon = kind === 'symptom' ? SymptomIcon : ReliefIcon;
  return (
    <span className="flex flex-wrap gap-1.5">
      {names.map((n) => (
        <span key={n} className="inline-flex items-center gap-1.5 rounded-chip bg-bg-raised py-1 pl-2 pr-2.5 text-xs text-text-primary">
          <Icon name={n} className="h-4 w-4 shrink-0 text-accent-light" />
          <span className="[overflow-wrap:anywhere]">{n}</span>
        </span>
      ))}
    </span>
  );
}
