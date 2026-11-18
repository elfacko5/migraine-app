import type { MedClass } from '../types';
import { TYPE_OPTIONS } from '../utils/medClasses';
import { chipClass } from '../utils/chipStyles';
import { ClassBadge } from './ClassBadge';
import { RadioDot } from './RadioDot';

// The type rows, shared by the add wizard (step 1) and the edit form's Type
// screen: one pick-one radio group, a letter badge, the plain-words hint.
// `chosen` is separate from `value` because "Not sure" is a real answer
// (`undefined`), so "nothing picked yet" cannot be read off the value.
const HINT: Record<string, string> = {
  T: 'Name usually ends in “-triptan”',
  C: 'Two or more medicines in one tablet',
  P: 'Paracetamol, ibuprofen, naproxen, aspirin',
  G: 'Name usually ends in “-gepant”',
  '?': 'Counted under “Any” until you choose',
};

export function TypeList({ value, chosen, onChange, labelledBy }: {
  value: MedClass | undefined;
  chosen: boolean;
  onChange: (cls: MedClass | undefined) => void;
  labelledBy: string;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="space-y-2">
      {TYPE_OPTIONS.map((t) => {
        const on = chosen && value === t.value;
        return (
          <button
            key={t.letter}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(t.value)}
            className={`tap-44-y flex min-h-[3.5rem] w-full items-center gap-3 rounded-control px-control-x text-left ${chipClass(on)}`}
          >
            <ClassBadge>{t.letter}</ClassBadge>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-medium text-text-primary">{t.label}</span>
              <span className="block text-xs text-text-secondary">{HINT[t.letter]}</span>
            </span>
            <RadioDot selected={on} />
          </button>
        );
      })}
    </div>
  );
}
