import type { Attack, Snapshot } from '../types';

export function maxSeverity(snapshot: Snapshot): number {
  const vals = Object.values(snapshot.areas);
  return vals.length === 0 ? 0 : Math.max(...vals);
}

export function attackMaxSeverity(attack: Attack): number {
  return Math.max(0, ...attack.snapshots.map(maxSeverity));
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

function tallyToFreq(tally: Record<string, number>): Freq[] {
  return Object.entries(tally)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function triggerFrequency(attacks: Attack[]): Freq[] {
  const tally: Record<string, number> = {};
  for (const a of attacks) for (const t of new Set(a.triggers)) tally[t] = (tally[t] ?? 0) + 1;
  return tallyToFreq(tally);
}

export function symptomFrequency(attacks: Attack[]): Freq[] {
  const tally: Record<string, number> = {};
  for (const a of attacks) {
    const seen = new Set<string>();
    for (const s of a.snapshots) for (const x of s.symptoms) seen.add(x);
    for (const x of seen) tally[x] = (tally[x] ?? 0) + 1;
  }
  return tallyToFreq(tally);
}

export function reliefFrequency(attacks: Attack[]): Freq[] {
  const tally: Record<string, number> = {};
  for (const a of attacks) {
    const seen = new Set<string>();
    for (const s of a.snapshots) for (const x of s.reliefs ?? []) seen.add(x);
    for (const x of seen) tally[x] = (tally[x] ?? 0) + 1;
  }
  return tallyToFreq(tally);
}

export function medicationFrequency(attacks: Attack[]): Freq[] {
  const tally: Record<string, number> = {};
  for (const a of attacks) {
    const seen = new Set<string>();
    for (const s of a.snapshots) if (s.medication?.name.trim()) seen.add(s.medication.name.trim());
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
