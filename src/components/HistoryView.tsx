import { useMemo } from 'react';
import type { Attack } from '../types';
import { AttackCard } from './AttackCard';
import { LightIcon, NauseaIcon, SoundIcon } from './drawnIcons';
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

  const byDate = sort === 'newest' || sort === 'oldest';
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
          {/* "1 of 2 attacks": the noun follows the total when there is one. */}
          <span> {(shown !== total ? total : shown) === 1 ? 'attack' : 'attacks'}</span>
        </p>
        {/* The v4 board's outline pill (06-logs, `.pill`/`.cnt`): 44px, 15px
            medium, the control outline as a ring, the same in both states —
            only the accent count says filters are on. */}
        <button
          type="button"
          onClick={onOpenFilters}
          className="inline-flex min-h-target items-center gap-2 rounded-full px-4 text-[0.9375rem] font-medium text-text-primary ring-1 ring-inset ring-border-control transition-colors hover:bg-bg-raised"
        >
          Filter &amp; sort
          {/* The count is the only thing that says filters are on once the
              chip row has scrolled off the top of a long list. */}
          {count > 0 && (
            <span className="inline-flex h-[1.375rem] min-w-[1.375rem] items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold tabular-nums text-bg-base">
              {count}
            </span>
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
              className="tap-44-y btn-secondary min-h-0 rounded-control px-4 py-2 text-sm font-medium transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        // **Grouped under month headers while the list is in date order** (v4
        // board, 2026-11-25): each row carries its day and weekday, so the
        // month is said once. An ongoing attack sits above the first header,
        // as the board draws it — it belongs to now, not to a month. Under any
        // other sort the headers would scatter, so each row names its month
        // instead.
        <div className="space-y-2.5">
          {visible.map((a, i) => {
            const ongoing = a.end === null;
            const month = monthLabel(a.snapshots[0].time);
            const before = visible.slice(0, i).filter((p) => p.end !== null);
            const prev = before[before.length - 1];
            const header = byDate && !ongoing && (!prev || monthLabel(prev.snapshots[0].time) !== month);
            return (
              <div key={a.id} className="space-y-2.5">
                {header && <h2 className={`text-xs font-semibold text-text-secondary ${i > 0 ? 'pt-2' : ''}`}>{month}</h2>}
                <AttackCard
                  attack={a}
                  isOngoing={ongoing}
                  showMonth={!byDate}
                  onClick={() => onAttackClick(a)}
                />
              </div>
            );
          })}
          {/* The key for the three symptom marks, said once so no row has to
              (rules in utils/cardSymptoms.ts). */}
          <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-1 text-xs text-text-secondary">
            <span className="inline-flex items-center gap-1.5"><NauseaIcon className="h-4 w-4" />nausea</span>
            <span className="inline-flex items-center gap-1.5"><LightIcon className="h-4 w-4" />light</span>
            <span className="inline-flex items-center gap-1.5"><SoundIcon className="h-4 w-4" />sound</span>
          </p>
        </div>
      )}
    </div>
  );
}

/** "November", or "November 2025" outside the current year — the Logs month
 *  header. The comparison year is read here rather than in render. */
function monthLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, d.getFullYear() === now.getFullYear() ? { month: 'long' } : { month: 'long', year: 'numeric' });
}
