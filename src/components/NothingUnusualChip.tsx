import { chipClass } from '../utils/chipStyles';
import { ChipCheck } from './ChipCheck';

/**
 * "Nothing unusual" — the explicit answer to "the two days before", as
 * distinct from leaving it unanswered (v4 decision A4(ii)). One component for
 * every place that asks it (End, Past, Detail's editor), so it can't drift.
 *
 * Same size and type as `ChipSelector`'s chips — it used to carry its own
 * larger padding and medium weight, and read as a different control. It sits
 * in its own row with a 16px gap above, so it doesn't look like one more chip
 * trailing after "Add custom…" (2026-11-27).
 */
export function NothingUnusualChip({ selected, onToggle }: { selected: boolean; onToggle: () => void }) {
  return (
    <div className="pt-4">
      <button
        type="button"
        aria-pressed={selected}
        onClick={onToggle}
        className={`tap-44-y inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${chipClass(selected)}`}
      >
        Nothing unusual
        <ChipCheck selected={selected} />
      </button>
    </div>
  );
}
