import { isRetired } from './retired';

// **Which symptoms a Logs row shows, and in what order** (2026-11-25).
//
// Only ICHD-3 criterion C: nausea/vomiting, light sensitivity, sound
// sensitivity — the part of what makes an attack migraine that a list is worth
// scanning for. Nausea and vomiting are one criterion ("nausea and/or
// vomiting"), so they share one mark: the row never shows more than three, and
// always in this order, so each mark has a fixed place you learn to look at.
// Anything else logged is counted ("+3") rather than drawn — the attack's own
// page lists it, and seven icons on a row was the problem this solves.
export const CARD_SYMPTOMS = [
  { key: 'nausea', label: 'nausea', pattern: /nausea|queasy|vomit|sick\b|throwing up/i },
  { key: 'light', label: 'light', pattern: /light|photophobia|glare|bright/i },
  { key: 'sound', label: 'sound', pattern: /sound|noise|phonophobia/i },
] as const;

export type CardSymptom = (typeof CARD_SYMPTOMS)[number]['key'];

/** The criterion-C marks present, in card order, and how many other symptoms
 *  were logged. Retired and blank entries count as neither. */
export function cardSymptoms(symptoms: string[]): { shown: CardSymptom[]; others: number } {
  const names = [...new Set(symptoms.map((s) => s.trim()))].filter((s) => s && !isRetired(s));
  const shown = CARD_SYMPTOMS.filter((c) => names.some((n) => c.pattern.test(n))).map((c) => c.key);
  const others = names.filter((n) => !CARD_SYMPTOMS.some((c) => c.pattern.test(n))).length;
  return { shown, others };
}
