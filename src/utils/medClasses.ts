import type { MedClass } from '../types';
import { MOH_DAYS_COMBINATION, MOH_DAYS_SIMPLE, MOH_DAYS_TRIPTAN } from './stats';

// The four ICHD-3 classes. The class decides one thing only: which
// medication-overuse reference point a monthly count is measured against.
//
// Shared by `MedicationEditor`'s Type picker and Today's medication card, so
// the card's "Combination painkiller days" is the same words the user chose
// the type by. Lives here rather than in the editor, because a component
// module that also exports constants breaks Fast Refresh.
export const CLASSES: { value: MedClass; label: string }[] = [
  { value: 'triptan', label: 'Triptan' },
  { value: 'combination', label: 'Combination painkiller' },
  { value: 'simple', label: 'Simple painkiller' },
  { value: 'other', label: 'Other' },
];

/** The three classes with an overuse threshold, in the order Today lists them. */
export type CountedClass = 'triptan' | 'combination' | 'simple';

export const COUNTED_CLASSES: { value: CountedClass; label: string; letter: string; limit: number }[] = [
  { value: 'triptan', label: 'Triptan', letter: 'T', limit: MOH_DAYS_TRIPTAN },
  { value: 'combination', label: 'Combination painkiller', letter: 'C', limit: MOH_DAYS_COMBINATION },
  { value: 'simple', label: 'Simple painkiller', letter: 'P', limit: MOH_DAYS_SIMPLE },
];
