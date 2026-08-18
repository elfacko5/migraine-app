import type { Attack } from '../types';

// `Attack.impact` — how much the attack stopped the user doing things. This
// is the disability axis the clinical scales (MIDAS, HIT-6) are built on, and
// what a headache history is actually judged on; severity is the other axis
// and the two are not interchangeable.
//
// Two label sets, because the value is read in two different situations and
// one wording can't serve both:
//
//   - `IMPACT_OPTIONS` — bare degrees, for buttons sitting under a question
//     that supplies the context. Used by the Today prompt, AttackDetail and
//     the Logs filter, all of which print the question above them. **The
//     labels only mean something with that question present**: "A little" on
//     its own says nothing, so a caller must never shorten the heading to a
//     bare label like "Impact".
//   - `IMPACT_SHORT` — a lowercase degree the caller labels itself, for the
//     list row and the filter chips ("Impact: a lot").
//
// There was a third, `IMPACT_SUMMARY`, holding sentence forms ("Stopped you
// doing a lot") for AttackDetail when it displayed impact as read-only text.
// AttackDetail now shows the same tappable pills as everywhere else, so
// nothing needed sentences and it was removed rather than left as dead code.
type Impact = NonNullable<Attack['impact']>;

export const IMPACT_OPTIONS: { value: Impact; label: string }[] = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'A little' },
  { value: 2, label: 'A lot' },
  { value: 3, label: "Couldn't function" },
];

/** How long after an attack ends the Today prompt stays offered. */
const PROMPT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * The attack Today should ask the impact of, or null.
 *
 * **The rule is "the latest attack, if it just ended unanswered"** — and that
 * single condition covers both halves of the intent. Picking the attack with
 * the latest *start* means a newly logged attack displaces the question by
 * itself: still running, and there's nothing ended to ask about; already
 * ended, and it becomes the thing being asked about. Asking about the previous
 * attack while a newer one exists would be ambiguous anyway, since "your last
 * attack" stops having one meaning.
 *
 * **Expiry is silent and leaves impact unanswered.** A late answer is the bad
 * outcome, not the missing one: impact is a judgement about what an attack
 * cost you, and a day later it's reconstruction — the recall bias a
 * prospective diary exists to avoid. A badly remembered "2" counts in the
 * disability figures; an absent answer doesn't. It's also why expiry needs no
 * stored "declined" flag: the window closes on its own, so dismissal can be
 * session-only and nothing new has to be persisted or synced.
 *
 * Answering late is still possible on purpose, from `AttackDetail`. What
 * expires is the nagging, not the option.
 *
 * Lives here rather than beside `ImpactPrompt` because a component file that
 * also exports a plain function loses fast refresh.
 */
export function attackAwaitingImpact(attacks: Attack[], now: number): Attack | null {
  let latest: Attack | null = null;
  for (const a of attacks) {
    const start = new Date(a.snapshots[0].time).getTime();
    if (!latest || start > new Date(latest.snapshots[0].time).getTime()) latest = a;
  }
  if (!latest || !latest.end) return null;
  if (latest.impact !== undefined) return null;
  if (now - new Date(latest.end).getTime() > PROMPT_WINDOW_MS) return null;
  return latest;
}

// The list row has no space for a sentence, so it takes the degree and pairs
// it with a label of its own ("Impact: a lot") — the same information, made
// self-describing by the caller instead of by the string.
export const IMPACT_SHORT: Record<Impact, string> = {
  0: 'none',
  1: 'a little',
  2: 'a lot',
  3: "couldn't function",
};
