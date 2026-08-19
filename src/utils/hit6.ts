import type { Hit6Entry } from '../types';

/**
 * HIT-6 — the Headache Impact Test, six questions on a four-week recall.
 *
 * Chosen over MIDAS on 2026-08-19 (see docs/decisions.md): six questions are
 * short enough to answer monthly without dread, the score has published
 * severity bands so change over time is legible, and its four-week recall is
 * far closer to what a person can actually remember than MIDAS's three months
 * — which is the recall bias a prospective diary exists to avoid.
 *
 * It is a *complement* to the diary counts, not a substitute: the 2026 REFORM
 * finding is that the two disagree about treatment response, which is exactly
 * why the dossier asks for both.
 *
 * NOTE: HIT-6 is a licensed instrument. Fine for a personal diary; a public
 * release needs permission from the rights holder. Recorded in the P4 backlog.
 */
export const HIT6_QUESTIONS = [
  'When you have headaches, how often is the pain severe?',
  'How often do headaches limit your ability to do usual daily activities, including household work, work, school or social activities?',
  'When you have a headache, how often do you wish you could lie down?',
  'In the past 4 weeks, how often have you felt too tired to do work or daily activities because of your headaches?',
  'In the past 4 weeks, how often have you felt fed up or irritated because of your headaches?',
  'In the past 4 weeks, how often did your headaches limit your ability to concentrate on work or daily activities?',
];

/** The five responses and their scored values. Not evenly spaced — that is
 *  the instrument's own weighting, not a mistake to tidy up. */
export const HIT6_OPTIONS: { label: string; value: number }[] = [
  { label: 'Never', value: 6 },
  { label: 'Rarely', value: 8 },
  { label: 'Sometimes', value: 10 },
  { label: 'Very often', value: 11 },
  { label: 'Always', value: 13 },
];

export const HIT6_MIN = 36;
export const HIT6_MAX = 78;

/** Four weeks, matching the questions' own recall window. */
export const HIT6_INTERVAL_DAYS = 28;

export function hit6Score(answers: number[]): number {
  return answers.reduce((sum, a) => sum + a, 0);
}

/**
 * The published bands. Deliberately descriptive, never a verdict — the app
 * states the band the instrument defines and stops, the same rule the
 * medication-overuse caption and the preventive readout follow.
 */
export function hit6Band(score: number): { label: string; detail: string } {
  if (score >= 60) return { label: 'Severe impact', detail: 'The questions describe headaches affecting most areas of daily life.' };
  if (score >= 56) return { label: 'Substantial impact', detail: 'The questions describe headaches affecting several areas of daily life.' };
  if (score >= 50) return { label: 'Some impact', detail: 'The questions describe headaches affecting daily life some of the time.' };
  return { label: 'Little or no impact', detail: 'The questions describe headaches having little effect on daily life.' };
}

export function latestHit6(entries: Hit6Entry[]): Hit6Entry | null {
  if (entries.length === 0) return null;
  return entries.reduce((a, b) => (b.takenAt > a.takenAt ? b : a));
}

const INTERVAL_MS = HIT6_INTERVAL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Whether it is worth asking again: four weeks since the last one, or never
 * answered at all — and not waved away inside that same window.
 *
 * `dismissedAt` is what makes a Today card tolerable. Being due is a *durable*
 * state (unlike impact, which expires by itself in 24 hours), so without it a
 * cleared card would be back on the next launch and every launch after that,
 * which is nagging rather than prompting. Clearing therefore means "not this
 * cycle": it hides the card for another four weeks, or until an answer lands.
 */
export function hit6Due(
  entries: Hit6Entry[],
  dismissedAt: string | null = null,
  now: number = Date.now(),
): boolean {
  const last = latestHit6(entries);
  if (last && now - new Date(last.takenAt).getTime() < INTERVAL_MS) return false;
  if (dismissedAt && now - new Date(dismissedAt).getTime() < INTERVAL_MS) return false;
  return true;
}

/** Change against the previous entry. Negative is a lower score, i.e. less
 *  impact. Null when there is nothing to compare against. */
export function hit6Change(entries: Hit6Entry[]): number | null {
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  return sorted[sorted.length - 1].score - sorted[sorted.length - 2].score;
}
