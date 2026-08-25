import { useMemo } from 'react';
import type { Attack } from '../types';
import { AttackCard } from './AttackCard';
import {
  applyFilters, sortAttacks, activeFilterChips, filterCount, clearFilterKey,
  DEFAULT_FILTERS, SORT_LABELS,
  type LogFilters, type SortOrder,
} from '../utils/logFilters';

// **The period moved into the filter sheet and the list opens on all time.**
// It had a permanent row of pills here on the argument that it was adjusted
// constantly while every other filter was set once and left — but defaulting
// to 7 days meant the page opened hiding most of what it exists to show, and
// a quiet week read as an empty diary. It is a filter like any other, so it
// lives with them; when it isn't "all time" it says so in the chip row below,
// which is the same way every other filter announces itself.
interface Props {
  attacks: Attack[];
  filters: LogFilters;
  onFilters: (f: LogFilters) => void;
  sort: SortOrder;
  /** Needed so the sort chip can reset itself to the default. */
  onSort: (s: SortOrder) => void;
  onOpenFilters: () => void;
  onAttackClick: (attack: Attack) => void;
}

export function HistoryView({
  attacks, filters, onFilters, sort, onSort, onOpenFilters, onAttackClick,
}: Props) {
  // One stage now that the period is a filter like the rest. The empty state
  // below still distinguishes "nothing matched" from "nothing logged", which
  // is the distinction that actually mattered.
  const visible = useMemo(
    // eslint-disable-next-line react-hooks/purity
    () => sortAttacks(applyFilters(attacks, filters), sort, Date.now()),
    [attacks, filters, sort]
  );

  const chips = activeFilterChips(filters);
  const count = filterCount(filters);
  const total = attacks.length;
  const shown = visible.length;

  if (total === 0) {
    return (
      <div className="py-20 text-center text-text-secondary text-sm">
        Nothing logged yet. Your attacks will appear here.
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
              : 'bg-bg-raised text-text-secondary ring-1 ring-border-control hover:text-text-primary'
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
