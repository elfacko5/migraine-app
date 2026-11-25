import type { Attack, Medication } from '../types';
import { NOTHING_UNUSUAL } from '../types';
import { attackMaxSeverity, doseOutcomeWord, type DoseOutcome } from './stats';
import { attackSide, SIDE_LABELS } from './laterality';
import { unitsLabel } from './medGuardrails';
import { resolveDose } from './medResolve';
import { isRetired } from './retired';

// The readings the two flow-closing summaries share — `PastAttackSaved` and
// `AttackEndedSummary` (backlog item 18, `docs/decisions.md`). Both read back
// the attack **as stored**, and both follow a settled rule wherever their v4
// board doesn't: location is a side, never a zone; a dose's outcome is
// `doseOutcomeWord` from its 2 h reading (A1), and a dose without one says
// nothing — "no 2 h reading" was noise on both screens (June, 2026-11-25).

export interface SummaryRow { key: string; label: string; value: string; srLabel?: string }

/** "7 · left side", or the bare number when nothing recorded a side. */
export function worstText(attack: Attack): string {
  const worst = attackMaxSeverity(attack);
  const side = attackSide(attack);
  return side ? `${worst} · ${SIDE_LABELS[side].toLowerCase()}` : String(worst);
}

/** Every symptom (or relief) on any reading, once each, in the order first
 *  logged. A live attack gathers them across updates and End's closing
 *  reading; a past one has them all on its first. */
export function marksOf(attack: Attack, kind: 'symptoms' | 'reliefs'): string[] {
  const seen = new Set<string>();
  for (const s of attack.snapshots) for (const m of s[kind]) if (!isRetired(m)) seen.add(m);
  return [...seen];
}

/** Same reading as Detail's "The two days before" row. */
export function beforeText(attack: Attack): string {
  return attack.triggers.filter((t) => t !== NOTHING_UNUSUAL && !isRetired(t)).join(', ')
    || (attack.triggers.includes(NOTHING_UNUSUAL) ? 'Nothing unusual' : '');
}

/** The 2 h outcome in words, or '' when there was no reading — never
 *  "didn't help" for a dose nobody checked, and no "no 2 h reading" either
 *  (June, 2026-11-25: most doses never get one, so it was noise). */
export function outcomeText(o: DoseOutcome): string {
  if (o.after === null) return '';
  return { Helped: 'helped', 'A bit': 'helped a bit', No: 'didn’t help' }[doseOutcomeWord(o.before, o.after)];
}

/** "1 tablet" when an amount was logged, else the dose text as recorded. */
export function amountText(o: DoseOutcome, attack: Attack, medications: Medication[]): string {
  if (!o.amount) return o.dose;
  const snap = attack.snapshots.find((s) => s.time === o.time && s.medication?.name?.trim() === o.name);
  return unitsLabel(o.amount, resolveDose(snap?.medication, medications).med);
}

export const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
