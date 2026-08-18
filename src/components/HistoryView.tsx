import { useMemo } from 'react';
import type { Attack } from '../types';
import { AttackCard } from './AttackCard';
import {
  applyFilters, sortAttacks, activeFilterChips, filterCount, clearFilterKey,
  DEFAULT_FILTERS, SORT_LABELS,
  type LogFilters, type SortOrder,
} from '../utils/logFilters';
import { chipClass } from '../utils/chipStyles';

type Period = 'all' | '7d' | '30d' | '3m';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d',   label: '7 days' },
  { value: '30d',  label: '30 days' },
  { value: '3m',   label: '3 months' },
  { value: 'all',  label: 'All' },
];

const PERIOD_MS: Record<Exclude<Period, 'all'>, number> = {
  '7d':  7  * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '3m':  90 * 24 * 60 * 60 * 1000,
};

// The period row stays a row of its own rather than moving into the filter
// sheet: it's the one control that's adjusted constantly, and every other
// filter is set occasionally and then left alone.
interface Props {
  attacks: Attack[];
  period: Period;
  onPeriod: (p: Period) => void;
  filters: LogFilters;
  onFilters: (f: LogFilters) => void;
  sort: SortOrder;
  /** Needed so the sort chip can reset itself to the default. */
  onSort: (s: SortOrder) => void;
  onOpenFilters: () => void;
  onAttackClick: (attack: Attack) => void;
}

export function HistoryView({
  attacks, period, onPeriod, filters, onFilters, sort, onSort, onOpenFilters, onAttackClick,
}: Props) {
  // Two stages, kept separate so the empty state can tell the user which one
  // emptied the list — the period or the filters. Blaming the wrong one sends
  // someone looking in a sheet they never opened.
  const inPeriod = useMemo(() => {
    if (period === 'all') return attacks;
    const cutoff = Date.now() - PERIOD_MS[period];
    return attacks.filter((a) => new Date(a.snapshots[0].time).getTime() >= cutoff);
  }, [attacks, period]);

  const visible = useMemo(
    () => sortAttacks(applyFilters(inPeriod, filters), sort, Date.now()),
    [inPeriod, filters, sort]
  );

  const chips = activeFilterChips(filters);
  const count = filterCount(filters);
  const total = attacks.length;
  const shown = visible.length;

  if (total === 0) {
    return (
      <div className="py-20 text-center text-text-secondary text-sm">
        No attacks logged yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Count + **one** route into the sheet.
          There were two buttons here, "Filter" and the current sort, and both
          opened the same sheet — two affordances with one outcome, which is a
          false affordance however tidy it looks. Filtering and sorting are
          genuinely different operations (one changes the set, the other the
          order) and with two or three sort options they'd deserve separate
          controls; with five and no menu primitive in this app, one sheet is
          the honest answer.
          Combining them costs one thing, so it's paid for below: the current
          sort has to stay readable *without* opening the sheet, which is what
          the chip row does. */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">
          <span className="text-text-primary font-medium">{shown}</span>
          {shown !== total && <span> of {total}</span>}
          <span> {shown === 1 ? 'attack' : 'attacks'}</span>
        </p>
        <button
          type="button"
          onClick={onOpenFilters}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            count > 0
              ? 'bg-accent/15 text-accent-light ring-1 ring-accent/40'
              : 'bg-bg-raised text-text-secondary ring-1 ring-bg-border hover:text-text-primary'
          }`}
        >
          Filter &amp; sort
          {/* The count is the only thing that says filters are on once the
              chip row has scrolled off the top of a long list. */}
          {count > 0 && (
            <span className="rounded-full bg-accent/25 px-1.5 tabular-nums">{count}</span>
          )}
        </button>
      </div>

      {/* Period filter chips */}
      <div className="flex gap-2 flex-wrap">
        {PERIOD_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onPeriod(value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              chipClass(period === value)
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Active filters and a non-default sort, each removable on its own.
          Without this row the only way to see what's applied is to reopen the
          sheet and read seven groups.
          The sort chip only appears when it *isn't* the default: "Newest
          first" is what an unconfigured list already looks like, so a chip
          announcing it would be noise on every visit. Removing it returns to
          newest, which is what "clearing" a sort means. */}
      {(chips.length > 0 || sort !== 'newest') && (
        <div className="flex flex-wrap gap-2">
          {sort !== 'newest' && (
            <button
              type="button"
              onClick={() => onSort('newest')}
              className="flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent-light ring-1 ring-accent/30 transition-colors hover:bg-accent/25"
            >
              {SORT_LABELS[sort]}
              <span aria-hidden="true">×</span>
              <span className="sr-only">Back to newest first</span>
            </button>
          )}
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => onFilters(clearFilterKey(filters, chip.key))}
              className="flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent-light ring-1 ring-accent/30 transition-colors hover:bg-accent/25"
            >
              {chip.label}
              <span aria-hidden="true">×</span>
              <span className="sr-only">Remove filter</span>
            </button>
          ))}
        </div>
      )}

      {/* Attack list */}
      {shown === 0 ? (
        <div className="py-12 text-center space-y-3">
          {/* Names the actual cause. A filter set three taps deep in a sheet
              emptying the list looks identical to a quiet week, and the two
              want opposite responses from the reader. */}
          <p className="text-sm text-text-secondary">
            {count > 0
              ? 'No attacks match these filters.'
              : 'No attacks in this period.'}
          </p>
          {count > 0 && (
            <button
              type="button"
              onClick={() => onFilters(DEFAULT_FILTERS)}
              className="btn-secondary rounded-xl px-4 py-2 text-sm font-medium transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((a) => (
            <AttackCard
              key={a.id}
              attack={a}
              isOngoing={a.end === null}
              onClick={() => onAttackClick(a)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export type { Period };
