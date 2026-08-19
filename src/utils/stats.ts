import type { Attack, Snapshot } from '../types';
import { isRetired } from './retired';

export function maxSeverity(snapshot: Snapshot): number {
  const vals = Object.values(snapshot.areas);
  return vals.length === 0 ? 0 : Math.max(...vals);
}

export function attackMaxSeverity(attack: Attack): number {
  return Math.max(0, ...attack.snapshots.map(maxSeverity));
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
    const end = attack.end ?? snaps[snaps.length - 1].time;
    longest = Math.max(longest, msBetween(snaps[runStart].time, end) / 60000);
  }
  return Math.round(longest);
}

// Total minutes per attack where max severity was at or above the threshold.
export function minutesAboveSeverity(attack: Attack, threshold: number): number {
  const snaps = attack.snapshots;
  let total = 0;
  for (let i = 0; i < snaps.length; i++) {
    if (maxSeverity(snaps[i]) >= threshold) {
      const nextTime = snaps[i + 1]?.time ?? attack.end ?? snaps[i].time;
      total += msBetween(snaps[i].time, nextTime) / 60000;
    }
  }
  return Math.round(total);
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

// For stats tab: streak of calendar days with >= 1 attack.
export function currentAttackStreak(attacks: Attack[]): number {
  if (attacks.length === 0) return 0;
  const days = new Set(attacks.map((a) => calendarDay(a.snapshots[0].time)));
  const today = calendarDay(new Date().toISOString());
  let streak = 0;
  let d = today;
  while (days.has(d)) { streak++; d = prevDay(d); }
  return streak;
}

export function currentPainFreeStreak(attacks: Attack[]): number {
  if (attacks.length === 0) return 0;
  const days = new Set(attacks.map((a) => calendarDay(a.snapshots[0].time)));
  const today = calendarDay(new Date().toISOString());
  let streak = 0;
  let d = today;
  while (!days.has(d)) { streak++; d = prevDay(d); if (streak > 3650) break; }
  return streak;
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
    if (isRetired(t)) continue;
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

function calendarDay(iso: string): string {
  return iso.slice(0, 10);
}

function prevDay(day: string): string {
  const d = new Date(day + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return calendarDay(d.toISOString());
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
export function migraineDaysByMonth(attacks: Attack[], months = 6, now: number = Date.now()): MonthDays[] {
  const byMonth = new Map<string, Set<string>>();
  for (const a of attacks) {
    if (a.snapshots.length === 0) continue;
    for (const day of attackDayKeys(a, now)) {
      const month = day.slice(0, 7);
      if (!byMonth.has(month)) byMonth.set(month, new Set());
      byMonth.get(month)!.add(day);
    }
  }

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
export const MOH_DAYS_SIMPLE = 15;

export interface MedMonth {
  name: string;
  /** YYYY-MM → number of distinct local days a dose was logged. */
  byMonth: Map<string, number>;
  /** Days in the current calendar month so far. */
  thisMonth: number;
  /**
   * Doses in the current calendar month. Days is the number the overuse
   * thresholds are stated in, but two doses in a day is a different exposure
   * from one and the day count can't show it — so both are kept.
   */
  dosesThisMonth: number;
}

/**
 * Days per month on which each medication was logged — days, not doses, since
 * that is the unit every overuse threshold is stated in. Two doses of the
 * same drug in one day are one day.
 *
 * Only counts what was logged inside an attack, which is the only place
 * medication exists in this app. Taking something without logging an attack
 * under-reports here, and the UI says so rather than implying the count is
 * complete.
 */
export function medicationDaysByMonth(attacks: Attack[], now: number = Date.now()): MedMonth[] {
  const seen = new Map<string, Map<string, Set<string>>>();
  const doses = new Map<string, Map<string, number>>();
  for (const a of attacks) {
    for (const snap of a.snapshots) {
      const name = snap.medication?.name?.trim();
      if (!name || isRetired(name)) continue;
      const d = new Date(snap.time);
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const month = day.slice(0, 7);
      if (!seen.has(name)) seen.set(name, new Map());
      const months = seen.get(name)!;
      if (!months.has(month)) months.set(month, new Set());
      months.get(month)!.add(day);
      if (!doses.has(name)) doses.set(name, new Map());
      const dm = doses.get(name)!;
      dm.set(month, (dm.get(month) ?? 0) + 1);
    }
  }

  const cur = new Date(now);
  const thisMonthKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
  return [...seen.entries()]
    .map(([name, months]) => ({
      name,
      byMonth: new Map([...months.entries()].map(([m, days]) => [m, days.size])),
      thisMonth: months.get(thisMonthKey)?.size ?? 0,
      dosesThisMonth: doses.get(name)?.get(thisMonthKey) ?? 0,
    }))
    .sort((a, b) => b.thisMonth - a.thisMonth || a.name.localeCompare(b.name));
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
const FOLLOW_UP_MIN_MS = 60 * 60 * 1000;
const FOLLOW_UP_MAX_MS = 4 * 60 * 60 * 1000;
const TARGET_MS = 2 * 60 * 60 * 1000;

export function medicationResponse(attacks: Attack[]): MedResponse[] {
  const acc = new Map<string, { changes: number[]; unmeasured: number; helped: number }>();

  for (const a of attacks) {
    const snaps = a.snapshots;
    for (let i = 0; i < snaps.length; i++) {
      const name = snaps[i].medication?.name?.trim();
      if (!name || isRetired(name)) continue;
      if (!acc.has(name)) acc.set(name, { changes: [], unmeasured: 0, helped: 0 });
      const entry = acc.get(name)!;

      const doseTime = new Date(snaps[i].time).getTime();
      const before = maxSeverity(snaps[i]);
      let best: { delta: number; sev: number } | null = null;
      for (let j = i + 1; j < snaps.length; j++) {
        const dt = new Date(snaps[j].time).getTime() - doseTime;
        if (dt < FOLLOW_UP_MIN_MS) continue;
        if (dt > FOLLOW_UP_MAX_MS) break;
        const distance = Math.abs(dt - TARGET_MS);
        if (!best || distance < best.delta) best = { delta: distance, sev: maxSeverity(snaps[j]) };
      }

      if (!best) { entry.unmeasured++; continue; }
      entry.changes.push(best.sev - before);
      // "Helped" mirrors the trial definition of pain relief: severity at
      // least halved, or down to mild.
      if (best.sev <= before / 2 || best.sev <= 3) entry.helped++;
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
