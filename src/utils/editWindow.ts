import type { Attack } from '../types';

// **How long an ended attack's details stay editable** (2026-11-25, Sunny).
//
// What it was like — woke up with it, pain quality, symptoms, reliefs, the two
// days before — is memory, so it closes after 48 hours. The end time (or, for
// "gone when you woke up", the wake time) stays open 7 days: forgetting to end
// an attack is common and a wrong end distorts every length figure. Impact is
// asked only in the End flow, and deleting is always possible. Both numbers
// are a judgement, not a clinical figure.
//
// The clock starts at the later of the attack's end and when it was logged, so
// an attack added afterwards isn't locked the moment it's saved. `id` is the
// creation time (`Date.now()`). For an unknown end, `end` is the last reading —
// the app doesn't store when the End flow was finished — so that window can
// start a few hours early.
export const ANSWERS_WINDOW_MS = 48 * 60 * 60 * 1000;
export const END_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface EditWindows {
  /** ISO — the last moment the descriptive answers can change. */
  answersUntil: string;
  /** ISO — the same for the end or wake time. */
  endUntil: string;
  answersOpen: boolean;
  endOpen: boolean;
}

/** `null` while the attack is ongoing: nothing here is edited mid-attack. The
 *  clock is read here, not by the caller. */
export function editWindows(attack: Attack, now: number = Date.now()): EditWindows | null {
  if (attack.end === null) return null;
  const from = Math.max(new Date(attack.end).getTime(), attack.id);
  const answers = from + ANSWERS_WINDOW_MS;
  const end = from + END_WINDOW_MS;
  return {
    answersUntil: new Date(answers).toISOString(),
    endUntil: new Date(end).toISOString(),
    answersOpen: now <= answers,
    endOpen: now <= end,
  };
}
