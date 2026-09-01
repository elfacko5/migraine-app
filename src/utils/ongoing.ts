import type { Attack } from '../types';

/**
 * Whether an attack is still running.
 *
 * **One definition, because there were two and they disagreed.** `useAttacks`
 * and every screen asked `attack.end === null`; `widgetSnapshot` asked
 * `!attack.end`. Those are the same answer only while `end` is exactly `null`
 * — an `undefined` (a field absent from an imported backup, or a row that
 * predates the column) is falsy but not null, so the widget would call an
 * attack ongoing that the app had already finished with, and the two would
 * describe different attacks on the same screen.
 *
 * That is precisely the drift the computed-payload design exists to prevent,
 * and it slipped in because the predicate was spelled out at each call site
 * rather than shared. `end` being absent is treated as **not ongoing**, which
 * matches what every screen already did.
 */
export function isOngoing(attack: Attack): boolean {
  return attack.end === null;
}

/** The running attack, or null. The one place that decision is made. */
export function findOngoing(attacks: Attack[]): Attack | null {
  return attacks.find(isOngoing) ?? null;
}
