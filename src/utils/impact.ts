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
//     that supplies the context. Used by `EndAttackForm`, AttackDetail and
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

// The list row has no space for a sentence, so it takes the degree and pairs
// it with a label of its own ("Impact: a lot") — the same information, made
// self-describing by the caller instead of by the string.
export const IMPACT_SHORT: Record<Impact, string> = {
  0: 'none',
  1: 'a little',
  2: 'a lot',
  3: "couldn't function",
};
