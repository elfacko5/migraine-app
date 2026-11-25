import type { Attack, Snapshot } from '../types';

/**
 * A reading that only says what the attack was like — no pain, no medicine, no
 * note, and not a "No change" reply. The End flow's closing answer, and
 * symptoms added later from Detail.
 *
 * It is stamped at whatever the end was when it was saved, and the end can be
 * edited afterwards (snapshots can't be). So **its time means nothing**: it
 * doesn't bound the end or a new update, carries no severity into an average,
 * and is shown on the end row wherever its timestamp now falls.
 */
export function isDetailOnly(s: Snapshot): boolean {
  return Object.keys(s.areas).length === 0 && !s.medication && !s.note && s.source !== 'notification_no_change';
}

/** The latest reading whose time does mean something. */
export function lastReading(attack: Attack): Snapshot {
  return [...attack.snapshots].reverse().find((s) => !isDetailOnly(s)) ?? attack.snapshots[0];
}
