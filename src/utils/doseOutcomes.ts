import type { Attack } from '../types';
import { isRetired } from './retired';
import {
  maxSeverity, followUpReading, doseOutcomeWord,
  FOLLOW_UP_MIN_MS, FOLLOW_UP_MAX_MS, FOLLOW_UP_TARGET_MS, type DoseOutcomeWord,
} from './stats';

// Shared by UpdateAttackForm and EndAttackForm — both ask "did it help?"
// about doses already logged earlier in an attack, inserting the answer
// into *existing* history rather than building a brand-new attack from
// scratch the way LogForm/LiveAttackForm/PastAttackForm do. That difference
// is what makes this its own module instead of another copy of
// `MedicationEntry`'s own follow-up row: a reading inserted here can collide
// in time with whatever *other* full-state reading this same submission is
// about to save (Update's "how bad now", End's own closing reading), and
// five reviewer rounds on Update went into getting that right. Don't
// re-derive this per flow — extend it here instead.

/** The area a dose's own "about 2 hours after?" reading is recorded
 *  against — the worst one *at the time of that dose*, same rule
 *  `PastAttackForm`/`LogForm` use for their own follow-up area. */
export function peakArea(areas: Record<string, number>): string | null {
  let best: string | null = null;
  for (const [k, v] of Object.entries(areas)) if (best === null || v > areas[best]) best = k;
  return best;
}

export type HelpRowState = 'answered' | 'ask' | 'too-soon';

export interface HelpRow {
  name: string;
  dose: string;
  amount?: number;
  doseTimeIso: string;
  state: HelpRowState;
  word?: DoseOutcomeWord;
  peakArea: string | null;
}

/**
 * Doses already logged earlier in `attack` that a "did it help?" reading
 * could still apply to — the first dose of each (unretired) drug, same
 * scope as `attackDoseOutcomes` (stats.ts), but windowed against `nowMs`
 * directly rather than that function's ongoing-attack-only `pending` gate:
 * a past attack being backfilled (or ended) here can still take a reading
 * for a dose that's old enough and inside the window, which
 * `attackDoseOutcomes` never offers for an attack that already has an
 * `end`. Pass a synthetic `{ ...attack, end: <the end this flow is about to
 * save> }` when the real `attack.end` isn't set yet (End flow) so the
 * "never eligible" check below has the right ceiling to measure against.
 */
export function doseHelpRows(attack: Attack, nowMs: number): HelpRow[] {
  const raw: HelpRow[] = [];
  const snaps = attack.snapshots;
  for (let i = 0; i < snaps.length; i++) {
    const med = snaps[i].medication;
    const name = med?.name?.trim();
    if (!med || !name || isRetired(name) || raw.some((o) => o.name === name)) continue;
    const before = maxSeverity(snaps[i]);
    const follow = followUpReading(snaps, i);
    const doseMs = new Date(snaps[i].time).getTime();
    const area = peakArea(snaps[i].areas);
    if (follow) {
      raw.push({ name, dose: med.dose, amount: med.amount, doseTimeIso: snaps[i].time, state: 'answered', word: doseOutcomeWord(before, maxSeverity(follow)), peakArea: area });
      continue;
    }
    const age = nowMs - doseMs;
    if (age >= FOLLOW_UP_MAX_MS) continue; // window closed — nothing to ask
    // Gated on the real +2h mark, not the 1h floor `followUpReading` itself
    // accepts — `placeDoseOutcomeEvents` always places this answer *before*
    // whatever full-state reading this submission is also saving, which
    // means that other reading is always at least as close to +2h as this
    // one whenever the dose is under two hours old, and so always wins the
    // match instead. Asking earlier than that would collect an answer that
    // saves but is never the one counted.
    raw.push({ name, dose: med.dose, amount: med.amount, doseTimeIso: snaps[i].time, state: age < FOLLOW_UP_TARGET_MS ? 'too-soon' : 'ask', peakArea: area });
  }
  if (!attack.end) return raw;
  // An attack that already ended (or is about to) too soon after a dose for
  // any reading to ever clear the padded +2h mark (the same padding
  // `rowEligible` applies) has nothing to wait for — left out entirely
  // rather than shown as "too soon to tell", which would read as temporary
  // when it can never be answered.
  const endMs = new Date(attack.end).getTime();
  const padded = FOLLOW_UP_TARGET_MS + 1000 * raw.length;
  return raw.filter((row) => row.state === 'answered' || endMs - new Date(row.doseTimeIso).getTime() >= padded);
}

/**
 * Whether a "did it help?" answer for `row` would land far enough past its
 * dose to actually win `followUpReading`'s match once the caller's own
 * full-state reading saves at `resolvedMs` — `helpRows`' own `state` is
 * normally decided once, against the clock when a sheet opens (so a step
 * doesn't vanish mid-flow), but the save time itself can move earlier
 * afterwards (a manual time picked on the flow's own first step; `endMs`
 * for an End flow whose own end time the user then changes).
 *
 * Gated on +2h, not the 1h floor `followUpReading` itself would still
 * accept: the caller always places this answer *before* its own primary
 * reading, so a gap under two hours leaves that reading closer to the +2h
 * mark every time, and it wins the match instead — the slider answer would
 * still save, just never be the one counted. Padded by `helpRowCount`
 * seconds on top of that for the same reason `doseHelpRows` pads its own
 * "never eligible" check: `placeDoseOutcomeEvents` staggers every answered
 * row a further second or so earlier to keep each one strictly before the
 * primary reading, so a gap only barely over 2h can still land under the
 * +2h mark once that stagger is applied.
 */
export function rowEligible(row: HelpRow, resolvedMs: number, helpRowCount: number): boolean {
  return resolvedMs - new Date(row.doseTimeIso).getTime() >= FOLLOW_UP_TARGET_MS + 1000 * helpRowCount;
}

/**
 * Resolves every answered, eligible row into a single-area reading's time —
 * aimed at `doseTime + 2h` (the real mark `followUpReading` measures
 * against) but always kept *before* `resolvedPrimaryMs`, never at or after
 * it. Landing one on the primary reading's own moment would make this
 * single-area reading the attack's newest snapshot, which every "last
 * reading = current state" reader (a no-change copy-forward, the reminder
 * body, the next session's own `prev`) would then take as the whole
 * picture. `rowEligible` already guarantees at least two hours (plus this
 * same padding) between the dose and `resolvedPrimaryMs`, so the floor
 * below only exists as a defensive lower bound, never expected to bind.
 * Staggered a second apart, nearest the primary reading last, so two
 * answered rows in one submission don't collide on the same timestamp.
 */
export function placeDoseOutcomeEvents(
  helpRows: HelpRow[],
  helpAnswers: Record<string, number>,
  resolvedPrimaryMs: number,
): Array<{ ms: number; area: string; value: number }> {
  const answered = helpRows.filter(
    (row) => helpAnswers[row.name] !== undefined && row.peakArea && rowEligible(row, resolvedPrimaryMs, helpRows.length),
  );
  return answered.map((row, i) => {
    const doseMs = new Date(row.doseTimeIso).getTime();
    const floor = doseMs + FOLLOW_UP_MIN_MS;
    const ceiling = resolvedPrimaryMs - 1000 * (answered.length - i);
    const target = Math.min(doseMs + FOLLOW_UP_TARGET_MS, ceiling);
    return { ms: Math.min(Math.max(floor, target), ceiling), area: row.peakArea!, value: helpAnswers[row.name] };
  });
}
