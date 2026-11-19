import type { MedGuides } from '../types';
import { guideFor, type GuideKey } from './medGuardrails';

// The info line under a medicine's limits ("Triptan days a month: 10 days ·
// shared by all triptans"), shared by the add wizard and the edit form. The
// number is read through `guideFor`, so it is the same one Today and Insights
// use. Wording follows frames 15c, 15f and 16d; the plan holds guide wording
// for June to reword.
export const GUIDE_LABEL: Record<GuideKey, string> = { triptan: 'Triptan', combination: 'Combination', simple: 'Painkiller', any: 'Any medicine' };
export const GUIDE_SHARED: Record<GuideKey, string> = {
  triptan: 'shared by all triptans',
  combination: 'shared by all combinations',
  simple: 'shared by all painkillers',
  any: 'shared by all attack medicines',
};

export function guideLine(key: GuideKey, guides: MedGuides): { lead: string; days: string; tail: string } {
  const n = guideFor(key, guides);
  return { lead: `${GUIDE_LABEL[key]} days a month:`, days: `${n} ${n === 1 ? 'day' : 'days'}`, tail: GUIDE_SHARED[key] };
}
