import type { Attack } from '../types';
import { IMPACT_OPTIONS } from '../utils/impact';
import {
  DEFAULT_FILTERS, SORT_LABELS,
  sideOptions, filterCount, PERIOD_OPTIONS,
  type LogFilters, type SortOrder, type SeverityBand, type TreatedFilter,
} from '../utils/logFilters';
import { LOW_MAX, MID_MAX } from '../utils/severity';
import { chipClass } from '../utils/chipStyles';

// The body of the Logs "Filter & sort" sheet. It renders from App.tsx, like
// every other Sheet — inside the tab's own scroll container a Sheet anchors to
// the wrong ancestor (see the viewport rules), which is why the filter state is
// lifted out of HistoryView rather than living where it's used.
//
// **Sort is in here with the filters, not a control of its own.** It started
// as a two-state toggle, which works for exactly two options; with five, a
// cycling button makes you tap through states you don't want to see the one
// you do. Both buttons in the list header open this sheet — the sort button
// names the current sort, so it stays the discoverable route to sorting.
//
// Every group is a row of pills, all single-select except impact. Reusing one
// control shape throughout means the sheet has no interaction to learn.

interface Props {
  attacks: Attack[];
  filters: LogFilters;
  sort: SortOrder;
  onChange: (f: LogFilters) => void;
  onSort: (s: SortOrder) => void;
  onClose: () => void;
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs uppercase tracking-wider font-medium text-text-secondary">{label}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

// **`py-1`, not the `py-1.5` the period row uses.** Six groups of pills makes
// this the one screen where the chip's own height is what you scroll past, and
// 2px a row off six rows is most of a group's worth of sheet.
//
// The trade-off is real and worth stating: the dossier asks for 44px touch
// targets and these are ~32px (24px line box + 8px). They were ~36px before,
// so this loosens a target that was already under the guideline rather than
// breaking a rule that was being kept. If it turns out to matter on device,
// the fix is a transparent hit area (`py-2 -my-1` on the button with the fill
// on an inner span) rather than putting the padding back.
function Pill({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
        chipClass(active)
      }`}
    >
      {children}
    </button>
  );
}

const SEVERITY_BANDS: { value: SeverityBand; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'low', label: `1–${LOW_MAX}` },
  { value: 'mid', label: `${LOW_MAX + 1}–${MID_MAX}` },
  { value: 'high', label: `${MID_MAX + 1}–10` },
];

const TREATED: { value: TreatedFilter; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'treated', label: 'Treated' },
  { value: 'untreated', label: 'Untreated' },
];

const SORTS = Object.keys(SORT_LABELS) as SortOrder[];

export function LogsFilterPanel({ attacks, filters, sort, onChange, onSort, onClose }: Props) {
  const sides = sideOptions(attacks);

  const set = <K extends keyof LogFilters>(key: K, value: LogFilters[K]) =>
    onChange({ ...filters, [key]: value });

  // Tapping the active pill again clears it, so every single-select group can
  // be undone without hunting for an "Any" option — the two that have a
  // meaningful neutral state ("Any") keep it as well.
  const toggle = <K extends keyof LogFilters>(key: K, value: LogFilters[K]) =>
    set(key, (filters[key] === value ? DEFAULT_FILTERS[key] : value) as LogFilters[K]);

  return (
    // `flush` mode: this owns its own scroll region and pins its own footer.
    // A sticky footer inside Sheet's own scroll container was unreliable in the
    // iOS PWA (the same reason the wizards use flush), so the footer is a flex
    // sibling of the scroller rather than sticky inside it.
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
      {/* Period leads, because it decides the pool every other filter then
          narrows — and because it moved here from a permanent pill row above
          the list, where defaulting to 7 days meant the page opened hiding
          most of what it exists to show. */}
      <Group label="Period">
        {PERIOD_OPTIONS.map((p) => (
          <Pill key={p.value} active={filters.period === p.value} onClick={() => set('period', p.value)}>
            {p.label}
          </Pill>
        ))}
      </Group>

      <Group label="Sort by">
        {SORTS.map((s) => (
          <Pill key={s} active={sort === s} onClick={() => onSort(s)}>
            {SORT_LABELS[s]}
          </Pill>
        ))}
      </Group>

      <Group label="Peak severity">
        {SEVERITY_BANDS.map(({ value, label }) => (
          <Pill key={value} active={filters.severity === value} onClick={() => set('severity', value)}>
            {label}
          </Pill>
        ))}
      </Group>

      {/* Multi-select, because "a lot or couldn't function" is one question a
          person actually has. Unanswered attacks are excluded whenever any
          level is picked — "not answered" is not a level. */}
      <Group label="Impact">
        {IMPACT_OPTIONS.map(({ value, label }) => (
          <Pill
            key={value}
            active={filters.impact.includes(value)}
            onClick={() =>
              set(
                'impact',
                filters.impact.includes(value)
                  ? filters.impact.filter((i) => i !== value)
                  : [...filters.impact, value]
              )
            }
          >
            {label}
          </Pill>
        ))}
      </Group>

      <Group label="Treatment">
        {TREATED.map(({ value, label }) => (
          <Pill key={value} active={filters.treated === value} onClick={() => set('treated', value)}>
            {label}
          </Pill>
        ))}
      </Group>

      {/* No Medication group: its options would be drug names the user typed,
          which is open text rather than anything the product defines — it
          offered "Dry" as a filterable drug, the mis-parsed tail of a retired
          entry. Treatment above answers the same question within a closed set.

          **Side, not the 17 pain zones.** Filtering by a zone the row no
          longer shows asks about something you can't see, and the zone-level
          question is one the Insights heatmap answers better than a list of
          pills. Side is the part that carries diagnostic weight — ICHD-3
          criterion B's *unilateral* — and it keeps the cross-attack question
          askable: do my one-sided attacks behave differently?

          Absent entirely when there's no history to narrow to — an empty
          group heading is worse than no group. */}
      {sides.length > 0 && (
        <Group label="Side">
          {sides.map((s) => (
            <Pill key={s.value} active={filters.side === s.value} onClick={() => toggle('side', s.value)}>
              {s.label}
            </Pill>
          ))}
        </Group>
      )}

      <Group label="Onset">
        <Pill active={filters.wokeWith} onClick={() => set('wokeWith', !filters.wokeWith)}>
          Woke up with it
        </Pill>
      </Group>

      </div>

      {/* One action, edge to edge, pinned above the home indicator. "Clear all"
          moved to the sheet header: it's a reset, not a way forward, and
          sitting beside the confirm it read as an equal choice — two buttons of
          the same weight where only one continues. Up there it's also always
          reachable, instead of six groups of scrolling away. */}
      <div
        className="border-t border-bg-border bg-bg-surface px-4 sm:px-6 py-4"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="btn-primary w-full rounded-xl py-3 text-sm font-medium transition-colors"
        >
          Show results
        </button>
      </div>
    </div>
  );
}

/** The sheet header's reset. Rendered by App.tsx into `Sheet`'s `headerRight`. */
export function LogsFilterReset({ filters, onChange }: { filters: LogFilters; onChange: (f: LogFilters) => void }) {
  const count = filterCount(filters);
  return (
    <button
      type="button"
      onClick={() => onChange(DEFAULT_FILTERS)}
      disabled={count === 0}
      className="rounded-lg px-2 py-1 text-sm font-medium text-accent-light transition-colors hover:text-accent disabled:opacity-40 disabled:hover:text-accent-light"
    >
      Clear all
    </button>
  );
}
