import { isRetired } from './retired';

// **Which symptoms a Logs row shows, and in what order** (2026-11-25).
//
// At most three marks, then "+N". The ICHD-3 criterion C symptoms go first,
// always in this order — nausea/vomiting, light sensitivity, sound
// sensitivity — because they're part of what makes an attack migraine and so
// the ones worth scanning for; a fixed order gives each a place you learn to
// look. Nausea and vomiting are one criterion, so they share one mark. Any
// slots left go to the other logged symptoms, in the order they were first
// logged, each with its own icon. Only what doesn't fit is counted.
//
// The first version drew criterion C only and counted everything else, so
// an attack with just dizziness read "+1" with no mark at all — a count of
// something you couldn't see (found on device the same day).
export const CARD_SYMPTOMS = [
  { key: 'nausea', label: 'nausea', pattern: /nausea|queasy|vomit|sick\b|throwing up/i },
  { key: 'light', label: 'light sensitivity', pattern: /light|photophobia|glare|bright/i },
  { key: 'sound', label: 'sound sensitivity', pattern: /sound|noise|phonophobia/i },
] as const;

export const CARD_SYMPTOM_SLOTS = 3;

export type CardSymptom = (typeof CARD_SYMPTOMS)[number]['key'];

/** One mark on the row: a criterion-C kind, or another symptom by name. */
export type CardSymptomMark = { kind: CardSymptom; name: string } | { kind: null; name: string };

/** The marks to draw, in row order, and how many more were logged. Retired
 *  and blank entries count as neither. */
export function cardSymptoms(symptoms: string[]): { marks: CardSymptomMark[]; more: number } {
  const names = [...new Set(symptoms.map((s) => s.trim()))].filter((s) => s && !isRetired(s));
  const criterion: CardSymptomMark[] = CARD_SYMPTOMS
    .filter((c) => names.some((n) => c.pattern.test(n)))
    .map((c) => ({ kind: c.key, name: c.label }));
  const rest: CardSymptomMark[] = names
    .filter((n) => !CARD_SYMPTOMS.some((c) => c.pattern.test(n)))
    .map((n) => ({ kind: null, name: n }));
  const all = [...criterion, ...rest];
  return { marks: all.slice(0, CARD_SYMPTOM_SLOTS), more: Math.max(0, all.length - CARD_SYMPTOM_SLOTS) };
}
