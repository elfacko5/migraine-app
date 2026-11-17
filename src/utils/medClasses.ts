import type { MedClass } from '../types';

// The types the v3 editor offers (2026-10-26), with the letter each wears on
// every screen — My medications, Today's medication card, Attack detail and
// its pain chart. "Not sure" is no class at all (`undefined`), which counts
// like an untyped drug: no bar, the default reference point of 10.
export const TYPE_OPTIONS: { value: MedClass | undefined; label: string; letter: string }[] = [
  { value: 'triptan', label: 'Triptan', letter: 'T' },
  { value: 'combination', label: 'Combination', letter: 'C' },
  { value: 'simple', label: 'Painkiller', letter: 'P' },
  { value: 'gepant', label: 'Gepant', letter: 'G' },
  { value: undefined, label: 'Not sure', letter: '?' },
];

/** The badge letter for a class; `null` for none, so the caller can draw the
 *  form icon instead. `'other'` (pre-v3) reads as no class. */
export function classLetter(cls: MedClass | undefined): string | null {
  return TYPE_OPTIONS.find((t) => t.value === cls && t.value !== undefined)?.letter ?? null;
}

/** The three classes with an overuse threshold, in the order Today lists them. */
export type CountedClass = 'triptan' | 'combination' | 'simple';

// No limit here any more: it comes from `guideFor(value, guides)` at the call
// site, so a constant cannot go stale when a guide changes (0b).
export const COUNTED_CLASSES: { value: CountedClass; label: string; letter: string }[] = [
  { value: 'triptan', label: 'Triptan', letter: 'T' },
  { value: 'combination', label: 'Combination painkiller', letter: 'C' },
  { value: 'simple', label: 'Simple painkiller', letter: 'P' },
];
