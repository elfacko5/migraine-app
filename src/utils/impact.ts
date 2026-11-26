import type { Attack } from '../types';

// `Attack.impact` — how much the attack stopped the user doing things. This
// is the disability axis the clinical scales (MIDAS, HIT-6) are built on, and
// what a headache history is actually judged on; severity is the other axis
// and the two are not interchangeable.
//
// Two label sets, one vocabulary (2026-11-26: the older Not at all / A little
// / A lot / Couldn't function set, `IMPACT_OPTIONS`, was the Logs filter's
// last caller and went with it):
//
//   - `END_IMPACT_LABELS` — the v4 flows' words, for buttons under the
//     "Stopped you" question: `EndAttackForm`, Detail's row and the Logs
//     filter. **They only mean something with that question present**, so a
//     caller must never shorten the heading to a bare label like "Impact".
//   - `IMPACT_SHORT` — the same words lowercased, for the active-filter chip
//     that labels itself ("Stopped you: had to stop").
type Impact = NonNullable<Attack['impact']>;

// The v4 flows' own wording for the same four degrees (A3/A8): the End flow's
// buttons, and Detail's "Stopped you" row, which reads back what was tapped.
export const END_IMPACT_LABELS: Record<Impact, string> = {
  0: 'Carried on',
  1: 'Slowed down',
  2: 'Had to stop',
  3: 'In bed',
};

// The active-filter chip has no space for a sentence, so it takes the degree
// and pairs it with a label of its own ("Stopped you: had to stop"). The End
// flow's words, lowercased, so the chip, the filter and Detail agree
// (2026-11-26; it was none / a little / a lot / couldn't function).
export const IMPACT_SHORT: Record<Impact, string> = {
  0: 'carried on',
  1: 'slowed down',
  2: 'had to stop',
  3: 'in bed',
};
