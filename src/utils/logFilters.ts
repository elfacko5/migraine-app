import type { Attack } from '../types';
import { attackMaxSeverity } from './stats';
import { isRetired } from './retired';
import { IMPACT_SHORT } from './impact';
import { LOW_MAX, MID_MAX } from './severity';
import { attackSide, SIDE_SHORT, type Side } from './laterality';

// Filtering and sorting for the Logs list. It lives out here rather than in
// `HistoryView` because the filter *sheet* has to be rendered from `App.tsx`
// (see the viewport rules — a Sheet inside the tab's scroll container anchors
// to the wrong ancestor), so the state is lifted and two components need the
// same predicates.
//
// **Every option here is a value the product defines**, never one the user
// typed. Severity bands, impact levels, treated/untreated and `PAIN_AREAS` are
// all closed sets; a medication name, a custom relief or a custom symptom is
// open text that grows forever, arrives mis-spelled or mis-dictated, and can't
// be presented as a tidy row of pills. The medication filter proved it — it
// offered "Dry", the mis-parsed tail of a retired entry, as a drug to filter
// by. Treated/untreated answers the medication question within a closed set,
// which is the version worth having.
//
// **Which axes, and why these.** Severity, impact and pain area are things a
// row already shows, so filtering by them is filtering by what you can see.
// The two additions are less obvious:
//
//   - **Treated / untreated.** ICHD-3's 4–72h duration criterion is defined
//     for *untreated* attacks, so this is the filter that makes the duration
//     column mean what the guideline means. It is not the same question as
//     "which drug" — an attack can be untreated and that is itself the answer.
//   - **Woke with it.** The flag is recorded and the card shows it, but a
//     pattern across attacks is the only useful form of it, and scrolling
//     looking for sunrise icons is not a way to find one.
//
// **Side replaced the 17-zone area filter**, following the card. Filtering by
// a zone the row no longer shows asks about something you can't see, and the
// zone-level question ("which attacks touched my left eye") is one the
// Insights heatmap answers better than a list ever did. Side is the part that
// carries diagnostic weight — ICHD-3 criterion B's *unilateral* — and it keeps
// the real cross-attack question askable: whether one-sided attacks behave
// differently from both-sided ones.
//
// Symptoms are deliberately absent: ~15 possible values needs its own picker
// and earns less than any of the above.

export type Period = 'all' | '7d' | '30d' | '3m';

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '3m', label: 'Last 3 months' },
];

export const PERIOD_MS: Record<Exclude<Period, 'all'>, number> = {
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '3m': 90 * 24 * 60 * 60 * 1000,
};

export type SeverityBand = 'any' | 'low' | 'mid' | 'high';
export type TreatedFilter = 'any' | 'treated' | 'untreated';
export type SortOrder = 'newest' | 'oldest' | 'longest' | 'severity' | 'impact';

export interface LogFilters {
  /** **The list opens on all time.** The period used to be a permanent row of
   *  pills above the list, defaulting to 7 days — which meant the page opened
   *  hiding most of what it exists to show, and a quiet week looked like an
   *  empty diary. It is a filter like any other, so it lives with the rest of
   *  them and announces itself in the chip row when it is not "all". */
  period: Period;
  treated: TreatedFilter;
  /** Impact levels to include. Empty means "any" — see the note below. */
  impact: number[];
  side: Side | null;
  severity: SeverityBand;
  /** True = only attacks flagged as woken up with. Never "only those not". */
  wokeWith: boolean;
}

export const DEFAULT_FILTERS: LogFilters = {
  period: 'all',
  treated: 'any',
  impact: [],
  side: null,
  severity: 'any',
  wokeWith: false,
};

export const SORT_LABELS: Record<SortOrder, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  longest: 'Longest first',
  severity: 'Most severe first',
  impact: 'Most disabling first',
};

// ── Reading an attack ────────────────────────────────────────────────────

/** Distinct medication names in an attack, retired entries excluded. */
export function attackMedications(attack: Attack): string[] {
  const names = attack.snapshots
    .map((s) => s.medication?.name?.trim())
    .filter((n): n is string => !!n && !isRetired(n));
  return [...new Set(names)];
}

// Ongoing attacks measure to now, so a live attack sorts by how long it has
// been running rather than falling to the bottom as a zero.
function durationMs(attack: Attack, now: number): number {
  const start = new Date(attack.snapshots[0].time).getTime();
  const end = attack.end ? new Date(attack.end).getTime() : now;
  return Math.max(0, end - start);
}

function inBand(sev: number, band: SeverityBand): boolean {
  if (band === 'any') return true;
  if (band === 'low') return sev <= LOW_MAX;
  if (band === 'mid') return sev > LOW_MAX && sev <= MID_MAX;
  return sev > MID_MAX;
}

// ── The options a user can actually pick ─────────────────────────────────
// Narrowed to sides that actually appear in history, so the sheet never offers
// a filter that returns nothing. Three fixed values rather than seventeen
// narrowed ones — which is most of the point of the change.

const SIDE_ORDER: Side[] = ['left', 'right', 'both'];

export function sideOptions(attacks: Attack[]): { value: Side; label: string }[] {
  const present = new Set<Side>();
  for (const a of attacks) {
    const side = attackSide(a);
    if (side) present.add(side);
  }
  return SIDE_ORDER.filter((s) => present.has(s)).map((s) => ({ value: s, label: SIDE_SHORT[s] }));
}

// ── Applying ─────────────────────────────────────────────────────────────

export function applyFilters(attacks: Attack[], f: LogFilters, now: number = Date.now()): Attack[] {
  // Relative to now by definition, and re-derived on every render that changes
  // the inputs — freezing it would stop the window moving on an app left open
  // overnight. The clock is read here rather than by the caller so it stays
  // out of a component's render.
  const cutoff = f.period === 'all' ? null : now - PERIOD_MS[f.period];
  return attacks.filter((a) => {
    if (cutoff !== null && new Date(a.snapshots[0].time).getTime() < cutoff) return false;
    if (f.severity !== 'any' && !inBand(attackMaxSeverity(a), f.severity)) return false;

    // An unanswered impact is not 0 and must never be matched by a filter for
    // "no impact" — the same rule that keeps it out of the card and the sync
    // payload. So an impact filter excludes unanswered attacks outright.
    if (f.impact.length > 0) {
      if (a.impact === undefined) return false;
      if (!f.impact.includes(a.impact)) return false;
    }

    // An attack with no laterality recorded (only `Nose`, the one sideless
    // zone) matches no side filter — the same rule as an unanswered impact:
    // absent is not a value, and must not be matched by one.
    if (f.side && attackSide(a) !== f.side) return false;

    const meds = attackMedications(a);
    if (f.treated === 'treated' && meds.length === 0) return false;
    if (f.treated === 'untreated' && meds.length > 0) return false;

    if (f.wokeWith && !a.wokeWithMigraine) return false;

    return true;
  });
}

export function sortAttacks(attacks: Attack[], sort: SortOrder, now: number): Attack[] {
  const startOf = (a: Attack) => new Date(a.snapshots[0].time).getTime();
  const list = [...attacks];

  switch (sort) {
    case 'oldest':
      return list.sort((a, b) => startOf(a) - startOf(b));
    case 'longest':
      return list.sort((a, b) => durationMs(b, now) - durationMs(a, now));
    case 'severity':
      // Ties fall back to newest, so equal-severity rows still read
      // chronologically instead of in storage order.
      return list.sort(
        (a, b) => attackMaxSeverity(b) - attackMaxSeverity(a) || startOf(b) - startOf(a)
      );
    case 'impact':
      // Unanswered sorts last rather than as 0: "not answered" is not "no
      // impact", and putting it among the mildest attacks would assert that.
      return list.sort((a, b) => {
        const ai = a.impact ?? -1;
        const bi = b.impact ?? -1;
        return bi - ai || startOf(b) - startOf(a);
      });
    default:
      return list.sort((a, b) => startOf(b) - startOf(a));
  }
}

// ── Describing what's on ─────────────────────────────────────────────────

export interface FilterChip {
  /** Which key to reset when the chip's × is tapped. */
  key: keyof LogFilters;
  label: string;
}

export function activeFilterChips(f: LogFilters): FilterChip[] {
  const chips: FilterChip[] = [];

  if (f.period !== 'all') {
    chips.push({ key: 'period', label: PERIOD_OPTIONS.find((p) => p.value === f.period)!.label });
  }

  if (f.severity !== 'any') {
    const band = { low: '1–3', mid: `${LOW_MAX + 1}–${MID_MAX}`, high: `${MID_MAX + 1}–10` }[f.severity];
    chips.push({ key: 'severity', label: `Severity ${band}` });
  }
  if (f.impact.length > 0) {
    const sorted = [...f.impact].sort((a, b) => b - a);
    chips.push({
      key: 'impact',
      label: `Impact: ${sorted.map((i) => IMPACT_SHORT[i as 0 | 1 | 2 | 3]).join(', ')}`,
    });
  }
  if (f.side) chips.push({ key: 'side', label: `${SIDE_SHORT[f.side]} side` });
  if (f.treated !== 'any') {
    chips.push({ key: 'treated', label: f.treated === 'treated' ? 'Treated' : 'Untreated' });
  }
  if (f.wokeWith) chips.push({ key: 'wokeWith', label: 'Woke up with it' });

  return chips;
}

export function filterCount(f: LogFilters): number {
  return activeFilterChips(f).length;
}

/** Reset one key to its default, for a chip's × button. */
export function clearFilterKey(f: LogFilters, key: keyof LogFilters): LogFilters {
  return { ...f, [key]: DEFAULT_FILTERS[key] };
}
