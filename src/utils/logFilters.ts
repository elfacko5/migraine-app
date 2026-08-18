import type { Attack } from '../types';
import { attackMaxSeverity } from './stats';
import { isRetired } from './retired';
import { IMPACT_SHORT } from './impact';
import { LOW_MAX, MID_MAX } from './severity';

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
// Symptoms are deliberately absent: ~15 possible values needs its own picker
// and earns less than any of the above.

export type SeverityBand = 'any' | 'low' | 'mid' | 'high';
export type TreatedFilter = 'any' | 'treated' | 'untreated';
export type SortOrder = 'newest' | 'oldest' | 'longest' | 'severity' | 'impact';

export interface LogFilters {
  treated: TreatedFilter;
  /** Impact levels to include. Empty means "any" — see the note below. */
  impact: number[];
  area: string | null;
  severity: SeverityBand;
  /** True = only attacks flagged as woken up with. Never "only those not". */
  wokeWith: boolean;
}

export const DEFAULT_FILTERS: LogFilters = {
  treated: 'any',
  impact: [],
  area: null,
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

/** Every pain area recorded at any point in the attack. */
export function attackAreas(attack: Attack): string[] {
  const areas = attack.snapshots.flatMap((s) => Object.keys(s.areas));
  return [...new Set(areas)];
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
// Areas are narrowed to the ones that actually appear in history, so the sheet
// never offers a filter returning nothing and doesn't list all 17 zones when
// most people use a handful. Every value is still one `PAIN_AREAS` defines —
// narrowing a closed set is not the same as building options out of free text.

export function areaOptions(attacks: Attack[]): string[] {
  const areas = new Set<string>();
  for (const a of attacks) for (const x of attackAreas(a)) areas.add(x);
  return [...areas].sort((a, b) => a.localeCompare(b));
}

// ── Applying ─────────────────────────────────────────────────────────────

export function applyFilters(attacks: Attack[], f: LogFilters): Attack[] {
  return attacks.filter((a) => {
    if (f.severity !== 'any' && !inBand(attackMaxSeverity(a), f.severity)) return false;

    // An unanswered impact is not 0 and must never be matched by a filter for
    // "no impact" — the same rule that keeps it out of the card and the sync
    // payload. So an impact filter excludes unanswered attacks outright.
    if (f.impact.length > 0) {
      if (a.impact === undefined) return false;
      if (!f.impact.includes(a.impact)) return false;
    }

    if (f.area && !attackAreas(a).includes(f.area)) return false;

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
  if (f.area) chips.push({ key: 'area', label: f.area });
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
