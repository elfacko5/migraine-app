import type { Attack, Medication, Snapshot } from '../types';
import { isRetired } from './retired';
import { MOH_DAYS_SIMPLE, MOH_DAYS_TRIPTAN } from './stats';

// Acute medications carry limits that come from the prescription, not from
// migraine guidelines: how many units in one intake, how many in 24 hours, and
// how long to leave between them. The app records doses but knew none of this,
// so it couldn't say that the tablet about to be taken would be the seventh
// today, or that only 40 minutes had passed since the last one.
//
// **Every number here is the user's own, transcribed off a label.** Nothing is
// inferred, nothing is blocked, and no wording is an instruction: "you entered
// a 4-hour minimum; the last dose was 2 hours ago", never "do not take this
// yet". An app that looks like it is dosing someone is a different and much
// heavier thing than an app that counts.
//
// It all lives in one module for the reason `sevFill` and the impact labels
// were centralised: three call sites (the wizard's medication step, Today's
// ongoing row, and the Insights caption) reading the same figures is exactly
// the shape that drifted last time.
//
// **Scope, stated once and repeated in the UI:** counts come only from doses
// logged inside an attack, which is the app's only record of medication.
// Taking something without logging an attack under-reports here, the same
// limitation the Insights medication caption already states.

/** A rolling day, not a calendar one — see `unitsInWindow`. */
export const DAY_MS = 24 * 60 * 60 * 1000;

/** What a unit is called when the medication doesn't say. */
export const DEFAULT_UNIT = 'tablet';

const UNIT_WORDS = /^(\d{1,2})\s*(tablets?|capsules?|pills?|sprays?|puffs?|doses?)\b/i;

/**
 * Units taken at one intake.
 *
 * `amount` when it's there. Otherwise a deliberately **narrow** read of the
 * free-text `dose`: a small leading integer *followed by a unit word*. `"50mg"`
 * must never come back as 50, so anything unrecognised counts as **1** — which
 * under-reports a two-tablet dose logged as "100mg", and that is the safe
 * direction: it can only ever warn late, never invent an overdose.
 */
export function doseUnits(med: { dose?: string; amount?: number } | null | undefined): number {
  if (!med) return 0;
  if (typeof med.amount === 'number' && Number.isFinite(med.amount) && med.amount > 0) {
    return med.amount;
  }
  const m = (med.dose ?? '').trim().match(UNIT_WORDS);
  if (!m) return 1;
  const n = Number(m[1]);
  return n > 0 ? n : 1;
}

/** Every logged dose of one drug, oldest first. Retired entries are excluded,
 *  as they are everywhere else a medication is read. */
function dosesOf(attacks: Attack[], name: string): { time: number; units: number }[] {
  const wanted = name.trim().toLowerCase();
  if (!wanted || isRetired(wanted)) return [];
  const out: { time: number; units: number }[] = [];
  for (const attack of attacks) {
    for (const snap of attack.snapshots) {
      const med = snap.medication;
      if (!med?.name || med.name.trim().toLowerCase() !== wanted) continue;
      out.push({ time: new Date(snap.time).getTime(), units: doseUnits(med) });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

/**
 * Units of one drug logged in the window *ending* at `atMs`. The window is
 * rolling rather than a calendar day because that's how a leaflet states it,
 * and because a calendar day silently allows a late-night dose plus an
 * early-morning one to read as two separate days' worth.
 */
export function unitsInWindow(
  attacks: Attack[],
  name: string,
  atMs: number = Date.now(),
  windowMs: number = DAY_MS,
): number {
  const from = atMs - windowMs;
  return dosesOf(attacks, name)
    .filter((d) => d.time > from && d.time <= atMs)
    .reduce((n, d) => n + d.units, 0);
}

/** The most recent logged dose of one drug strictly before `beforeMs`. */
export function lastDoseAt(attacks: Attack[], name: string, beforeMs: number = Date.now()): string | null {
  const prior = dosesOf(attacks, name).filter((d) => d.time < beforeMs);
  const last = prior[prior.length - 1];
  return last ? new Date(last.time).toISOString() : null;
}

export interface DoseCheck {
  /** True only when the medication set the corresponding limit. */
  exceedsIntake: boolean;
  exceedsDaily: boolean;
  tooSoon: boolean;
  /** When `minHoursBetween` has not yet elapsed — ISO, else null. */
  nextAllowedAt: string | null;
  /** Units already logged in the rolling 24h *before* this dose. */
  unitsInWindow: number;
  /** Units left against `maxPerDay` once this dose is counted; null when the
   *  medication sets no daily limit. Never negative. */
  remaining: number | null;
}

/**
 * Where a dose of `units` at `atIso` would sit against this medication's own
 * limits. Returns findings, not permissions — the caller states the number and
 * saves anyway. **Nothing here may ever prevent a save**: if four tablets were
 * taken, the diary has to be able to say four. A tracker that refuses the
 * truth stops being a record.
 */
export function checkDose(
  med: Medication | null | undefined,
  attacks: Attack[],
  name: string,
  units: number,
  /** Defaults to now — and is read here rather than by the caller, so a
   *  component doesn't have to call `Date.now()` during its own render. */
  atIso?: string,
): DoseCheck {
  const atMs = atIso ? new Date(atIso).getTime() : Date.now();
  const priorUnits = unitsInWindow(attacks, name, atMs);
  const last = lastDoseAt(attacks, name, atMs);

  const minHours = med?.minHoursBetween;
  const nextAllowedAt =
    last && minHours && minHours > 0
      ? new Date(new Date(last).getTime() + minHours * 60 * 60 * 1000).toISOString()
      : null;

  const maxDay = med?.maxPerDay;
  return {
    exceedsIntake: !!med?.maxPerIntake && units > med.maxPerIntake,
    exceedsDaily: !!maxDay && priorUnits + units > maxDay,
    tooSoon: !!nextAllowedAt && new Date(nextAllowedAt).getTime() > atMs,
    nextAllowedAt,
    unitsInWindow: priorUnits,
    remaining: maxDay ? Math.max(0, maxDay - (priorUnits + units)) : null,
  };
}

/** The library entry for a logged drug name, if the user has one. */
export function findMedication(medications: Medication[], name: string): Medication | null {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return null;
  return medications.find((m) => m.name.trim().toLowerCase() === wanted) ?? null;
}

/**
 * The medication-overuse reference point in days per month that applies to one
 * drug: the label's own `maxDaysPerMonth` first, then the ICHD-3 number for
 * its class, and 10 when nothing is known.
 *
 * **The unknown case stays at 10**, which is the behaviour that shipped: it
 * warns earlier rather than later, and warning early about a simple analgesic
 * is a much smaller failure than staying quiet about a triptan.
 */
export function mohDaysFor(name: string, medications: Medication[]): number {
  const med = findMedication(medications, name);
  if (med?.maxDaysPerMonth && med.maxDaysPerMonth > 0) return med.maxDaysPerMonth;
  return med?.class === 'simple' ? MOH_DAYS_SIMPLE : MOH_DAYS_TRIPTAN;
}

/** The plural unit label for a count — "1 tablet" / "2 tablets". */
export function unitsLabel(units: number, med?: Medication | null): string {
  const unit = med?.unitLabel?.trim() || DEFAULT_UNIT;
  return `${units} ${units === 1 ? unit : `${unit}s`}`;
}

/** The most recent dose of any drug in one attack — Today's ongoing row. */
export function lastDoseSnapshot(attack: { snapshots: Snapshot[] }): Snapshot | null {
  return [...attack.snapshots].reverse().find((s) => s.medication?.name) ?? null;
}
