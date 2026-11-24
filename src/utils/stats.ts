import type { Attack, Snapshot } from '../types';
import { NOTHING_UNUSUAL } from '../types';
import { isRetired } from './retired';

/** False for an ongoing attack (`end === null`) and for one whose end time
 *  is known to be a guess (`endUnknown`) — "gone when you woke up" with no
 *  time added. Both read the same way here: there is no honest duration to
 *  report, so every length-based figure must skip them rather than fabricate
 *  one from a placeholder timestamp. */
export function hasKnownDuration(attack: Attack): boolean {
  return attack.end !== null && !attack.endUnknown;
}

export function maxSeverity(snapshot: Snapshot): number {
  const vals = Object.values(snapshot.areas);
  return vals.length === 0 ? 0 : Math.max(...vals);
}

export function attackMaxSeverity(attack: Attack): number {
  return Math.max(0, ...attack.snapshots.map(maxSeverity));
}

/**
 * Severity at the most recent reading — "how bad is it right now".
 *
 * Distinct from `attackMaxSeverity`, and the distinction matters live: the
 * peak is the worst it has *been*, which on an attack that is easing off is a
 * fact about the past stated in the present tense. Falls back to the newest
 * reading that recorded any area, since a reading can be saved with none.
 */
export function attackLatestSeverity(attack: Attack): number {
  for (let i = attack.snapshots.length - 1; i >= 0; i--) {
    const sev = maxSeverity(attack.snapshots[i]);
    if (sev > 0) return sev;
  }
  return 0;
}

/**
 * The attack's average severity, **weighted by how long each reading held**.
 *
 * A plain mean of the readings would measure the diary as much as the attack.
 * Severity is sampled whenever a reminder happens to be answered, so an attack
 * logged eight times while it faded averages lower than the identical attack
 * logged twice at its worst — the number would move with how diligently
 * someone logged rather than with how bad it was.
 *
 * Weighting fixes that, and the snapshot model already says how: each reading
 * *is* the state held until the next one (the same rule the plateau analytics
 * rely on). So each contributes in proportion to the time it covered, and the
 * last one runs to the attack's end — or to now while it is still going, which
 * is why the clock is read here rather than by a component.
 *
 * Falls back to a plain mean when there is no elapsed time to weight by: one
 * reading, or several sharing a timestamp.
 */
export function attackAvgSeverity(attack: Attack, now: number = Date.now()): number {
  const snaps = attack.snapshots;
  if (snaps.length === 0) return 0;

  const endMs = attack.end ? new Date(attack.end).getTime() : now;
  let weighted = 0;
  let total = 0;
  for (let i = 0; i < snaps.length; i++) {
    const from = new Date(snaps[i].time).getTime();
    const to = i + 1 < snaps.length ? new Date(snaps[i + 1].time).getTime() : endMs;
    const held = Math.max(0, to - from);
    weighted += maxSeverity(snaps[i]) * held;
    total += held;
  }

  if (total === 0) {
    const mean = snaps.reduce((n, s) => n + maxSeverity(s), 0) / snaps.length;
    return Math.round(mean * 10) / 10;
  }
  return Math.round((weighted / total) * 10) / 10;
}

// Duration in minutes of the longest consecutive run of notification_no_change snapshots.
export function longestPlateauMinutes(attack: Attack): number {
  const snaps = attack.snapshots;
  let longest = 0;
  let runStart: number | null = null;

  for (let i = 0; i < snaps.length; i++) {
    if (snaps[i].source === 'notification_no_change') {
      if (runStart === null) runStart = i;
    } else if (runStart !== null) {
      longest = Math.max(longest, msBetween(snaps[runStart].time, snaps[i].time) / 60000);
      runStart = null;
    }
  }
  if (runStart !== null) {
    // Same fallback as an ongoing attack (`end` null): the last reading's own
    // time, never the placeholder guess an unknown end would otherwise
    // stretch this run out to.
    const end = hasKnownDuration(attack) ? attack.end! : snaps[snaps.length - 1].time;
    longest = Math.max(longest, msBetween(snaps[runStart].time, end) / 60000);
  }
  return Math.round(longest);
}

/**
 * Mean attack length in minutes, over attacks that have ended.
 *
 * **Ongoing attacks are excluded, not counted up to now.** An attack still
 * running has no length yet — counting it would pull the mean toward whatever
 * time of day the page happened to be opened, and it is the same call
 * `AttackCard` already makes in showing no duration for an ongoing attack.
 *
 * This replaced a tile reading "avg time >= 5" (2026-09-02, on Sunny's
 * suggestion). That threshold was never justified anywhere — not here, not in
 * CLAUDE.md, not in the dossier — and matched neither anchor it could have
 * used: ICHD-3 wants "moderate or severe", conventionally 4-6 and 7-10 on a
 * 0-10 scale, and the app's own severity ramp bands at <=3 / <=7. Length needs
 * no threshold to explain and is itself diagnostic: ICHD-3 1.1 defines
 * migraine as attacks of **4-72 hours untreated**, which is why the Logs row
 * already leads with duration.
 *
 * A mean, matching the other tiles rather than the median `medicationResponse`
 * uses. Worth knowing it is skewed hard by a forgotten-to-end attack — a
 * single 460-hour record moves it more than the rest of a month combined.
 */
export function avgAttackLength(attacks: Attack[]): number | null {
  const lengths = attacks
    .filter((a) => hasKnownDuration(a) && a.snapshots.length > 0)
    .map((a) => msBetween(a.snapshots[0].time, a.end!) / 60000);
  if (lengths.length === 0) return null;
  return Math.round(lengths.reduce((s, m) => s + m, 0) / lengths.length);
}

// True if 2+ consecutive no_change snapshots follow a medication snapshot.
export function hasMedicationNonResponse(attack: Attack, medicationName: string): boolean {
  const snaps = attack.snapshots;
  for (let i = 0; i < snaps.length; i++) {
    if (snaps[i].medication?.name.toLowerCase() === medicationName.toLowerCase()) {
      let noChangeCount = 0;
      for (let j = i + 1; j < snaps.length; j++) {
        if (snaps[j].source === 'notification_no_change') noChangeCount++;
        else break;
      }
      if (noChangeCount >= 2) return true;
    }
  }
  return false;
}

// Average no_change snapshot count before attack.end across completed attacks.
export function avgPreResolutionPlateauSnapshots(attacks: Attack[]): number {
  const completed = attacks.filter((a) => a.end !== null);
  if (completed.length === 0) return 0;
  const counts = completed.map((a) => {
    const snaps = a.snapshots;
    let count = 0;
    for (let i = snaps.length - 1; i >= 0; i--) {
      if (snaps[i].source === 'notification_no_change') count++;
      else break;
    }
    return count;
  });
  return parseFloat((counts.reduce((s, c) => s + c, 0) / counts.length).toFixed(1));
}

// Map attacks to (time, maxSeverity) for recharts.
export function severityTimeline(attack: Attack): { time: number; [area: string]: number }[] {
  return attack.snapshots.map((s) => ({
    time: new Date(s.time).getTime(),
    ...s.areas,
  }));
}

// Number of attacks that involved each area (not snapshot count).
export function areaFrequency(attacks: Attack[]): { area: string; count: number }[] {
  const tally: Record<string, number> = {};
  for (const a of attacks) {
    const seen = new Set<string>();
    for (const s of a.snapshots) {
      for (const area of Object.keys(s.areas)) seen.add(area);
    }
    for (const area of seen) tally[area] = (tally[area] ?? 0) + 1;
  }
  return Object.entries(tally)
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count);
}

// ── Trigger / symptom / relief frequency ─────────────────────────────────
// Each counts the number of ATTACKS that included the item (not raw
// occurrences), so attacks with many snapshots aren't over-weighted.

export interface Freq { name: string; count: number }

// Retired entries are skipped in every tally below, and in the two medication
// figures further down. These are aggregates — statements about a pattern —
// and a retired entry is by definition not part of one. The snapshots keep
// it, so AttackDetail's timeline still shows what was logged.

function tallyToFreq(tally: Record<string, number>): Freq[] {
  return Object.entries(tally)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function triggerFrequency(attacks: Attack[]): Freq[] {
  const tally: Record<string, number> = {};
  for (const a of attacks) for (const t of new Set(a.triggers)) {
    // The explicit "nothing unusual" answer is not a trigger and must never
    // be counted as one.
    if (isRetired(t) || t === NOTHING_UNUSUAL) continue;
    tally[t] = (tally[t] ?? 0) + 1;
  }
  return tallyToFreq(tally);
}

export function symptomFrequency(attacks: Attack[]): Freq[] {
  const tally: Record<string, number> = {};
  for (const a of attacks) {
    const seen = new Set<string>();
    for (const s of a.snapshots) for (const x of s.symptoms) if (!isRetired(x)) seen.add(x);
    for (const x of seen) tally[x] = (tally[x] ?? 0) + 1;
  }
  return tallyToFreq(tally);
}

export function reliefFrequency(attacks: Attack[]): Freq[] {
  const tally: Record<string, number> = {};
  for (const a of attacks) {
    const seen = new Set<string>();
    for (const s of a.snapshots) for (const x of s.reliefs ?? []) if (!isRetired(x)) seen.add(x);
    for (const x of seen) tally[x] = (tally[x] ?? 0) + 1;
  }
  return tallyToFreq(tally);
}

export function medicationFrequency(attacks: Attack[]): Freq[] {
  const tally: Record<string, number> = {};
  for (const a of attacks) {
    const seen = new Set<string>();
    for (const s of a.snapshots) {
      const name = s.medication?.name.trim();
      if (name && !isRetired(name)) seen.add(name);
    }
    for (const x of seen) tally[x] = (tally[x] ?? 0) + 1;
  }
  return tallyToFreq(tally);
}

// Order `options` by historical usage (most-used first). Ties — including
// never-used options — keep their original order (Array.sort is stable).
export function sortByFrequency(options: string[], freq: Freq[]): string[] {
  const count: Record<string, number> = {};
  for (const f of freq) count[f.name] = f.count;
  return [...options].sort((a, b) => (count[b] ?? 0) - (count[a] ?? 0));
}

// Average hours from first snapshot to max-severity snapshot.
export function avgTimeToPeak(attacks: Attack[]): number | null {
  const times = attacks
    .filter((a) => a.snapshots.length >= 2)
    .map((a) => {
      const peak = attackMaxSeverity(a);
      const peakSnap = a.snapshots.find((s) => maxSeverity(s) === peak);
      if (!peakSnap) return null;
      return msBetween(a.snapshots[0].time, peakSnap.time) / 3600000;
    })
    .filter((v): v is number => v !== null);
  if (times.length === 0) return null;
  return parseFloat((times.reduce((s, t) => s + t, 0) / times.length).toFixed(1));
}

function msBetween(a: string, b: string): number {
  return new Date(b).getTime() - new Date(a).getTime();
}

/**
 * Every calendar day an attack touched, as local YYYY-MM-DD keys. An attack
 * that runs past midnight counts as two days — which is the whole point:
 * clinical thresholds are stated in days per month, not attacks per month,
 * and a single 30-hour attack is two of them.
 *
 * An attack still running counts up to today, not to its last reading.
 */
export function attackDayKeys(attack: Attack, now: number = Date.now()): string[] {
  const start = new Date(attack.snapshots[0].time);
  const end = new Date(attack.end ?? new Date(now).toISOString());
  const keys: string[] = [];
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  // Guard against a clock change or a bad end time producing a runaway loop.
  for (let i = 0; d <= last && i < 400; i++) {
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    d.setDate(d.getDate() + 1);
  }
  return keys;
}

export interface MonthDays {
  /** YYYY-MM */
  month: string;
  label: string;
  days: number;
  /** False for the month in progress, where the count is still climbing. */
  complete: boolean;
}

/**
 * Migraine days per calendar month, most recent last.
 *
 * Deliberately *migraine* days, not "headache days": the app only records
 * migraine attacks, and ICHD-3's chronic-migraine line is headache on >=15
 * days/month of which >=8 are migrainous. Calling this "headache days" would
 * silently under-report the count it's named after, so the UI says migraine
 * days and shows the 15-day line for context rather than as a diagnosis.
 */
function migraineDaysByMonthMap(attacks: Attack[], now: number): Map<string, Set<string>> {
  const byMonth = new Map<string, Set<string>>();
  for (const a of attacks) {
    if (a.snapshots.length === 0) continue;
    for (const day of attackDayKeys(a, now)) {
      const month = day.slice(0, 7);
      if (!byMonth.has(month)) byMonth.set(month, new Set());
      byMonth.get(month)!.add(day);
    }
  }
  return byMonth;
}

/**
 * Every local calendar day with an attack on it, as `YYYY-MM-DD` keys.
 *
 * The same day set the monthly chart is built from, exposed for the week view
 * it falls back to under a 7-day period — a chart of whole months makes no
 * sense against a window that short (Sunny, 2026-09-02).
 */
export function migraineDaySet(attacks: Attack[], now: number = Date.now()): Set<string> {
  const all = new Set<string>();
  for (const days of migraineDaysByMonthMap(attacks, now).values()) {
    for (const d of days) all.add(d);
  }
  return all;
}

export interface DayCell {
  /** `YYYY-MM-DD`, local. */
  key: string;
  /** One-letter weekday, for the column head. */
  initial: string;
  /** Day of the month, shown in the cell. */
  date: number;
  /** Whether an attack covered this day. */
  hit: boolean;
}

/**
 * The last seven local days, most recent last, flagged where an attack covered
 * them. Backs the week view the migraine-days section falls back to under a
 * 7-day period.
 *
 * **The clock is read here, not in the component** — the rule the medication
 * guardrails and `greeting` already follow, so no component derives a value
 * from `Date` during render.
 */
export function lastSevenDays(attacks: Attack[], now: number = Date.now()): DayCell[] {
  const set = migraineDaySet(attacks, now);
  const base = new Date(now);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - (6 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      key,
      initial: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
      date: d.getDate(),
      hit: set.has(key),
    };
  });
}

/**
 * How many attacks overlap the same seven local days `lastSevenDays` draws —
 * ongoing or ended. Backs Today's week card, which shows only when this is 2
 * or more.
 *
 * **Attacks, not migraine days**, deliberately (Sunny, 2026-10-26): one
 * 28-hour attack covers two calendar days and marks both on the strip, but it
 * is one episode, and a single long attack is not the cluster the card exists
 * to point out.
 */
export function attacksInLastSevenDays(attacks: Attack[], now: number = Date.now()): number {
  const base = new Date(now);
  const windowStart = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 6).getTime();
  return attacks.filter((a) => {
    if (a.snapshots.length === 0) return false;
    const start = new Date(a.snapshots[0].time).getTime();
    const end = a.end ? new Date(a.end).getTime() : now;
    return start <= now && end >= windowStart;
  }).length;
}

export function migraineDaysByMonth(attacks: Attack[], months = 6, now: number = Date.now()): MonthDays[] {
  const byMonth = migraineDaysByMonthMap(attacks, now);

  const out: MonthDays[] = [];
  const cur = new Date(now);
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(cur.getFullYear(), cur.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({
      month,
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      days: byMonth.get(month)?.size ?? 0,
      complete: i > 0,
    });
  }
  return out;
}

/** The 15-days-a-month line ICHD-3 draws between episodic and chronic migraine. */
export const CHRONIC_DAYS_THRESHOLD = 15;

/**
 * Medication-overuse reference points from ICHD-3, in days per month:
 * roughly 10 for triptans and combination analgesics, 15 for simple ones,
 * sustained over three months. They are *reference points for a
 * conversation*, not a diagnosis — the app counts days and says what the
 * guideline numbers are; it never concludes anything.
 */
export const MOH_DAYS_TRIPTAN = 10;
export const MOH_DAYS_COMBINATION = 10;
export const MOH_DAYS_SIMPLE = 15;
/**
 * ICHD-3 8.2.6: overuse of more than one class counts at 10 days a month in
 * total, even when no single class reaches its own threshold.
 */
export const MOH_DAYS_MIXED = 10;

/** Today's window for every figure it shows, since v3: a rolling 30 days. */
export const TODAY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export const localDayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Migraine days in a rolling window ending now — the same day set the monthly
 * chart counts, from the local day the window starts on through today.
 *
 * **Rolling, not calendar** (Today v3, 2026-10-26): "this month" read 1 on the
 * 1st after a bad 31st and reset to zero for no reason the reader could see.
 * Today now says "last 30 days" everywhere; Insights keeps whole calendar
 * months, because that is the unit the 15-day line is stated in.
 */
export function migraineDaysInWindow(attacks: Attack[], windowMs: number = TODAY_WINDOW_MS, now: number = Date.now()): number {
  const from = localDayKey(new Date(now - windowMs));
  const to = localDayKey(new Date(now));
  let n = 0;
  for (const day of migraineDaySet(attacks, now)) if (day >= from && day <= to) n++;
  return n;
}

/** Attacks overlapping a rolling window ending now, ongoing ones included. */
export function attacksInWindow(attacks: Attack[], windowMs: number = TODAY_WINDOW_MS, now: number = Date.now()): number {
  const since = now - windowMs;
  return attacks.filter((a) => {
    if (a.snapshots.length === 0) return false;
    const start = new Date(a.snapshots[0].time).getTime();
    const end = a.end ? new Date(a.end).getTime() : now;
    return start <= now && end >= since;
  }).length;
}

/** Where one logged dose is counted: which bar (if any), whether it is in the
 *  "Any" count, and whether it is untyped (listed by name). Decided per dose by
 *  `countingOf` in `medResolve.ts`. */
export interface DoseCounting {
  bar: 'triptan' | 'combination' | 'simple' | null;
  any: boolean;
  untyped: boolean;
}

export interface ClassDays {
  triptan: number;
  combination: number;
  simple: number;
  /** Distinct days with a triptan, combination, simple or **untyped** dose
   *  (not a gepant) — the "Any attack medicine" count. A union of days, never
   *  a sum of the bars. */
  any: number;
  /** Names logged in the window that count under "Any" only because they have
   *  no type (or no library entry). A gepant is neither counted nor listed. */
  untyped: string[];
}

/**
 * Medication days per overuse class in a rolling window ending now — Today's
 * T / C / P bars and the "Any attack medicine" line.
 *
 * **Days per class, never a sum of per-drug days.** Two triptans on one day
 * are one triptan day, because the class threshold is about how often that
 * class is taken, not about which drug. `any` is the same rule across every
 * counted dose, untyped ones included, for ICHD-3's mixed-use line.
 *
 * Filtered on the snapshot's own time like `medicationDaysInWindow`, with
 * retired names skipped. `countingOf` decides, **per dose**, where it counts —
 * passed in rather than imported, since `medResolve` imports from here.
 */
export function classDaysInWindow(
  attacks: Attack[],
  countingOf: (dose: NonNullable<Snapshot['medication']>) => DoseCounting,
  windowMs: number = TODAY_WINDOW_MS,
  now: number = Date.now(),
): ClassDays {
  const since = now - windowMs;
  const days = { triptan: new Set<string>(), combination: new Set<string>(), simple: new Set<string>(), any: new Set<string>() };
  const untyped = new Set<string>();
  for (const a of attacks) {
    for (const snap of a.snapshots) {
      const name = snap.medication?.name?.trim();
      if (!snap.medication || !name || isRetired(name)) continue;
      const t = new Date(snap.time).getTime();
      if (t > now || t < since) continue;
      const day = localDayKey(new Date(t));
      const c = countingOf(snap.medication);
      if (c.bar) days[c.bar].add(day);
      if (c.any) days.any.add(day);
      if (c.untyped) untyped.add(name);
    }
  }
  return {
    triptan: days.triptan.size,
    combination: days.combination.size,
    simple: days.simple.size,
    any: days.any.size,
    untyped: [...untyped].sort((x, y) => x.localeCompare(y)),
  };
}

export interface MedMonth {
  name: string;
  /** Trimmed to the requested month count, oldest first — same shape
   *  `migraineDaysByMonth` returns, so a caller can treat the two the same
   *  way. */
  months: MonthDays[];
  /** Doses across the shown months. Days is the number the overuse
   *  thresholds are stated in, but two doses in a day is a different
   *  exposure from one and the day count can't show it — so both are kept. */
  doses: number;
}

/**
 * Days per calendar month on which each medication was logged — days, not
 * doses, since that is the unit every overuse threshold is stated in. Two
 * doses of the same drug in one day are one day. Built for Insights'
 * per-drug monthly bars (v4 sweep, 2026-11-24) — same `months`/`now` shape as
 * `migraineDaysByMonth`, clock read here rather than by the caller.
 *
 * Only counts what was logged inside an attack, which is the only place
 * medication exists in this app. Taking something without logging an attack
 * under-reports here, and the UI says so rather than implying the count is
 * complete. Returns every drug ever logged, even one with an all-zero row
 * across the shown months (last taken outside that range) — the caller's
 * own window decides which drugs are worth showing at all.
 */
export function medicationDaysByMonth(attacks: Attack[], months: number, now: number = Date.now()): MedMonth[] {
  const days = new Map<string, Map<string, Set<string>>>();
  const doses = new Map<string, Map<string, number>>();
  for (const a of attacks) {
    for (const snap of a.snapshots) {
      const name = snap.medication?.name?.trim();
      if (!name || isRetired(name)) continue;
      const t = new Date(snap.time).getTime();
      if (t > now) continue;
      const d = new Date(snap.time);
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const month = day.slice(0, 7);
      if (!days.has(name)) days.set(name, new Map());
      const dm = days.get(name)!;
      if (!dm.has(month)) dm.set(month, new Set());
      dm.get(month)!.add(day);
      if (!doses.has(name)) doses.set(name, new Map());
      const dosesMap = doses.get(name)!;
      dosesMap.set(month, (dosesMap.get(month) ?? 0) + 1);
    }
  }

  const cur = new Date(now);
  const cols: { month: string; label: string; complete: boolean }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(cur.getFullYear(), cur.getMonth() - i, 1);
    cols.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      complete: i > 0,
    });
  }

  // Not filtered to drugs with a day inside the shown months: a caller
  // already decides which drugs are relevant (its own window, usually wider
  // than `months`), and a drug last taken outside that range still belongs
  // on screen with an honestly all-zero set of bars, not missing entirely.
  return [...days.entries()]
    .map(([name, dm]) => ({
      name,
      months: cols.map((c) => ({ ...c, days: dm.get(c.month)?.size ?? 0 })),
      doses: cols.reduce((sum, c) => sum + (doses.get(name)?.get(c.month) ?? 0), 0),
    }))
    .sort((a, b) => b.doses - a.doses || a.name.localeCompare(b.name));
}

/**
 * Medication days and doses inside a rolling window, rather than per calendar
 * month.
 *
 * Added 2026-09-02, when the Insights period control started governing this
 * section: a page where half the figures ignore the control above them is
 * confusing whatever each figure is doing individually (Sunny). `since` of
 * `null` means all time.
 *
 * **It filters on the snapshot's own time, not the attack's start**, so a dose
 * taken inside the window still counts when the attack began before it — the
 * same reason `medicationDaysByMonth` reads snapshots rather than attacks.
 * Days are distinct *local* calendar days, matching every other day count here.
 */
export interface MedWindow { name: string; days: number; doses: number }

export function medicationDaysInWindow(
  attacks: Attack[], since: number | null, now: number = Date.now(),
): MedWindow[] {
  const days = new Map<string, Set<string>>();
  const doses = new Map<string, number>();
  for (const a of attacks) {
    for (const snap of a.snapshots) {
      const name = snap.medication?.name?.trim();
      if (!name || isRetired(name)) continue;
      const t = new Date(snap.time).getTime();
      if (t > now || (since !== null && t < since)) continue;
      const d = new Date(snap.time);
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!days.has(name)) days.set(name, new Set());
      days.get(name)!.add(day);
      doses.set(name, (doses.get(name) ?? 0) + 1);
    }
  }
  return [...days.entries()]
    .map(([name, set]) => ({ name, days: set.size, doses: doses.get(name) ?? 0 }))
    .sort((a, b) => b.days - a.days || a.name.localeCompare(b.name));
}

/** `medicationDaysInWindow` over Today's rolling window, reading the clock
 *  here so no component has to. */
export function medicationDaysLastWindow(
  attacks: Attack[], windowMs: number = TODAY_WINDOW_MS, now: number = Date.now(),
): MedWindow[] {
  return medicationDaysInWindow(attacks, now - windowMs, now);
}

export interface MedResponse {
  name: string;
  /** Doses that have a follow-up reading in the window. */
  measured: number;
  /** Doses with no reading in the window — the honest denominator. */
  unmeasured: number;
  /** Median severity change at ~2h. Negative is improvement. */
  medianChange: number | null;
  /** Doses where severity at least halved or fell to 3 or below. */
  helped: number;
}

// The clinical endpoint is pain freedom or pain relief at two hours, so the
// follow-up reading is whichever one falls closest to dose + 2h. A window of
// 1-4h keeps a reading that arrived late (the reminder is answered when it's
// answered) while refusing one so far out that it says nothing about the dose.
export const FOLLOW_UP_MIN_MS = 60 * 60 * 1000;
/** Exported so the reminder scheduler can aim inside the same window it will
 *  later be measured against — two copies of "4 hours" would drift. */
export const FOLLOW_UP_MAX_MS = 4 * 60 * 60 * 1000;
/** Dose + 2h — exported so the wizard's backfilled two-hour reading lands on
 *  exactly the mark this measures against. */
export const FOLLOW_UP_TARGET_MS = 2 * 60 * 60 * 1000;
const TARGET_MS = FOLLOW_UP_TARGET_MS;

/**
 * The follow-up reading for the dose at `snaps[i]`: whichever later reading
 * lands closest to dose + 2h inside the 1–4h window, or `null`.
 *
 * **The one definition of "the two-hour reading"** — Insights' response line,
 * Today's check-in card and the Logs row's "did it help" all read it from
 * here, so none of them can call a dose checked that another calls
 * unmeasured.
 */
export function followUpReading(snaps: Snapshot[], i: number): Snapshot | null {
  const doseTime = new Date(snaps[i].time).getTime();
  let best: { delta: number; snap: Snapshot } | null = null;
  for (let j = i + 1; j < snaps.length; j++) {
    const dt = new Date(snaps[j].time).getTime() - doseTime;
    if (dt < FOLLOW_UP_MIN_MS) continue;
    if (dt > FOLLOW_UP_MAX_MS) break;
    // A reading with no pain areas at all reports nothing about severity —
    // `EndAttackForm`'s own closing "what was it like" snapshot is exactly
    // this (symptoms/reliefs only, no severity step of its own) — so it's
    // not a candidate "after" reading. Without this, `maxSeverity` reads it
    // as 0, which would always pass `doseHelped` regardless of what was
    // actually logged.
    if (Object.keys(snaps[j].areas).length === 0) continue;
    const delta = Math.abs(dt - TARGET_MS);
    if (!best || delta < best.delta) best = { delta, snap: snaps[j] };
  }
  return best?.snap ?? null;
}

/** "Helped" mirrors the trial definition of pain relief: severity at least
 *  halved, or down to mild. */
export const doseHelped = (before: number, after: number) => after <= before / 2 || after <= 3;

/**
 * The same two numbers, read out in the v4 flows' own warmer words (A1:
 * "helped / a bit / no") — "Helped" is exactly `doseHelped`, so Insights'
 * and Logs' counts never diverge from what a dose-outcome card says. There
 * is no fourth, stored answer: this is always computed from `before`/
 * `after`, never tapped.
 */
export type DoseOutcomeWord = 'Helped' | 'A bit' | 'No';
export function doseOutcomeWord(before: number, after: number): DoseOutcomeWord {
  if (doseHelped(before, after)) return 'Helped';
  return after < before ? 'A bit' : 'No';
}

/** `since` scopes it to the same window as `medicationDaysInWindow`, and on
 *  the same key — the dose's own time. Two figures in one block measured over
 *  different windows is exactly the drift this page keeps correcting. */
export function medicationResponse(attacks: Attack[], since: number | null = null): MedResponse[] {
  const acc = new Map<string, { changes: number[]; unmeasured: number; helped: number }>();

  for (const a of attacks) {
    const snaps = a.snapshots;
    for (let i = 0; i < snaps.length; i++) {
      const name = snaps[i].medication?.name?.trim();
      if (!name || isRetired(name)) continue;
      if (since !== null && new Date(snaps[i].time).getTime() < since) continue;
      if (!acc.has(name)) acc.set(name, { changes: [], unmeasured: 0, helped: 0 });
      const entry = acc.get(name)!;

      const before = maxSeverity(snaps[i]);
      const follow = followUpReading(snaps, i);
      if (!follow) { entry.unmeasured++; continue; }
      const after = maxSeverity(follow);
      entry.changes.push(after - before);
      if (doseHelped(before, after)) entry.helped++;
    }
  }

  return [...acc.entries()]
    .map(([name, e]) => {
      const sorted = [...e.changes].sort((x, y) => x - y);
      const mid = Math.floor(sorted.length / 2);
      const medianChange = sorted.length === 0
        ? null
        : sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      return { name, measured: e.changes.length, unmeasured: e.unmeasured, medianChange, helped: e.helped };
    })
    .sort((a, b) => (b.measured + b.unmeasured) - (a.measured + a.unmeasured) || a.name.localeCompare(b.name));
}

/**
 * Where an ongoing attack's last dose stands against the two-hour check-in —
 * the reading `medicationResponse` will later score that dose by. Backs
 * Today's check-in card.
 *
 * - `due`: the dose is at least 1h 55m old, under `FOLLOW_UP_MAX_MS`, and no
 *   reading has landed since `FOLLOW_UP_MIN_MS` after it. Five minutes early,
 *   so the card is up when the reminder arrives rather than just after.
 * - `answered`: a reading has landed in that window; `severity` is the one
 *   closest to two hours, picked exactly as `medicationResponse` picks it.
 * - `null`: no dose, too soon, or the window has closed unanswered.
 *
 * **Same window, same constants**, because two definitions of "the 2-hour
 * reading" would let the card say a dose was checked while Insights says it
 * had no reading to compare. The clock is read here, not by the caller.
 */
export type CheckIn =
  | { state: 'due'; name: string }
  | { state: 'answered'; name: string; severity: number };

const CHECK_IN_LEAD_MS = 5 * 60 * 1000;

export function doseCheckIn(attack: Attack, now: number = Date.now()): CheckIn | null {
  const snaps = attack.snapshots;
  let i = snaps.length - 1;
  while (i >= 0 && !snaps[i].medication?.name) i--;
  if (i < 0) return null;
  const name = snaps[i].medication!.name;
  const doseAt = new Date(snaps[i].time).getTime();

  const follow = followUpReading(snaps, i);
  if (follow) return { state: 'answered', name, severity: maxSeverity(follow) };

  const age = now - doseAt;
  if (age >= TARGET_MS - CHECK_IN_LEAD_MS && age < FOLLOW_UP_MAX_MS) return { state: 'due', name };
  return null;
}

/**
 * Did it help? — the first dose of each drug in one attack, against its own
 * two-hour reading. Backs the Logs row and Attack detail (v3, 2026-10-26).
 *
 * - `helped` / `not-helped`: a follow-up reading exists; `doseHelped` decides.
 * - `pending`: no reading yet, the attack is still going and the window is
 *   still open — a fact about now, not a gap.
 * - `no-reading`: the window closed without one. Stated as absent, never as
 *   "didn't help": a missing reading says nothing about the drug.
 *
 * The first dose of each drug, because that is the one the trial endpoint is
 * about; a later dose is usually the answer to the first not working.
 * Retired names are skipped, like every other medication tally.
 */
export type DoseVerdict = 'helped' | 'not-helped' | 'pending' | 'no-reading';

export interface DoseOutcome {
  name: string;
  dose: string;
  amount?: number;
  time: string;
  verdict: DoseVerdict;
  before: number;
  after: number | null;
  /** With no two-hour reading: the next reading after the dose, if any, so
   *  the detail can say what *was* recorded ("next was 9 after 3h 28m"). */
  next: { severity: number; afterMs: number } | null;
}

export function attackDoseOutcomes(attack: Attack, now: number = Date.now()): DoseOutcome[] {
  const out: DoseOutcome[] = [];
  const snaps = attack.snapshots;
  for (let i = 0; i < snaps.length; i++) {
    const med = snaps[i].medication;
    const name = med?.name?.trim();
    if (!med || !name || isRetired(name) || out.some((o) => o.name === name)) continue;
    const before = maxSeverity(snaps[i]);
    const follow = followUpReading(snaps, i);
    const after = follow ? maxSeverity(follow) : null;
    const age = now - new Date(snaps[i].time).getTime();
    const verdict: DoseVerdict = after !== null
      ? (doseHelped(before, after) ? 'helped' : 'not-helped')
      : attack.end === null && age < FOLLOW_UP_MAX_MS ? 'pending' : 'no-reading';
    const doseMs = new Date(snaps[i].time).getTime();
    // Same "no areas, no score" rule as `followUpReading` just above — a
    // reading with none (End's own closing snapshot) isn't a pain value to
    // show as "next was 0", it just didn't report one.
    const nextSnap = after === null
      ? snaps.slice(i + 1).find((x) => new Date(x.time).getTime() > doseMs && Object.keys(x.areas).length > 0)
      : undefined;
    const next = nextSnap ? { severity: maxSeverity(nextSnap), afterMs: new Date(nextSnap.time).getTime() - doseMs } : null;
    out.push({ name, dose: med.dose, amount: med.amount, time: snaps[i].time, verdict, before, after, next });
  }
  return out;
}
