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
