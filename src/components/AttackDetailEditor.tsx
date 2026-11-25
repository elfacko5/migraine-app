import { useState } from 'react';
import type { Attack } from '../types';
import { NOTHING_UNUSUAL, PAIN_QUALITY_OPTIONS } from '../types';
import { isoToLocalInput, localInputToIso, formatDatetime } from '../utils/format';
import { chipClass } from '../utils/chipStyles';
import { ChipSelector } from './ChipSelector';
import { ChipCheck } from './ChipCheck';
import { RadioDot } from './RadioDot';
import { DateTimeField } from './DateTimeField';
import { SymptomIcon, ReliefIcon, TriggerIcon } from './drawnIcons';
import { MarkChips } from './AttackDetailParts';
import { usePanelDialog } from './usePanelDialog';
import { lastReading } from '../utils/readings';

export type EditField = 'end' | 'wake' | 'woke' | 'quality' | 'symptoms' | 'reliefs' | 'before';

export type DetailPatch = Partial<Pick<Attack, 'triggers' | 'wokeWithMigraine' | 'end' | 'painQuality' | 'confirmedReal' | 'wokeAt'>>;

const TITLES: Record<EditField, string> = {
  end: 'When did it end?',
  wake: 'When did you wake?',
  woke: 'Did you wake up with it?',
  quality: 'What did it feel like?',
  symptoms: 'What else did you have?',
  reliefs: 'What did you try?',
  before: 'In the two days before',
};

interface Props {
  field: EditField;
  attack: Attack;
  /** What's already on the attack's readings, for the two add-only fields. */
  recorded: { symptoms: string[]; reliefs: string[] };
  symptomOptions: string[];
  reliefOptions: string[];
  triggerOptions: string[];
  onAddSymptom?: (label: string) => void;
  onAddRelief?: (label: string) => void;
  onAddTrigger?: (label: string) => void;
  onSave: (patch: DetailPatch) => void;
  onAddLater: (details: { symptoms: string[]; reliefs: string[] }) => void;
  onClose: () => void;
}

/**
 * One question about an ended attack, in a panel over Attack detail. Each row
 * on that screen opens its own — there is no combined edit form.
 *
 * Starts from what is stored, and **Save does nothing until something has
 * changed**: opening a time and closing it must never turn a prefilled value
 * into a recorded one. Symptoms and reliefs live on readings, which are never
 * rewritten, so those two only add.
 */
export function AttackDetailEditor({ field, attack, recorded, symptomOptions, reliefOptions, triggerOptions, onAddSymptom, onAddRelief, onAddTrigger, onSave, onAddLater, onClose }: Props) {
  const dialogRef = usePanelDialog();
  // Neither an end nor a wake time can come before the last reading. Details
  // saved at an earlier end don't count (see `isDetailOnly`).
  const earliest = lastReading(attack).time;

  const [time, setTime] = useState(() => isoToLocalInput((field === 'wake' ? attack.wokeAt : attack.end) ?? undefined));
  const [woke, setWoke] = useState(attack.wokeWithMigraine ?? false);
  const [quality, setQuality] = useState<string[]>(attack.painQuality ?? []);
  const [added, setAdded] = useState<string[]>([]);
  const [triggers, setTriggers] = useState<string[]>(attack.triggers);
  const [touched, setTouched] = useState(false);

  const change = <T,>(set: (v: T) => void) => (v: T) => { set(v); setTouched(true); };
  const has = field === 'symptoms' ? recorded.symptoms : recorded.reliefs;
  const canSave = field === 'symptoms' || field === 'reliefs' ? added.length > 0 : touched;
  const nothing = triggers.includes(NOTHING_UNUSUAL);

  function save() {
    if (field === 'symptoms') onAddLater({ symptoms: added, reliefs: [] });
    else if (field === 'reliefs') onAddLater({ symptoms: [], reliefs: added });
    else if (field === 'woke') onSave({ wokeWithMigraine: woke });
    else if (field === 'quality') onSave({ painQuality: quality });
    else if (field === 'before') onSave({ triggers });
    else {
      // Minute-precision picker against second-precision readings: choosing
      // the earliest minute can land a few seconds early.
      const iso = localInputToIso(time);
      const clamped = iso < earliest ? earliest : iso;
      onSave(field === 'wake' ? { wokeAt: clamped } : { end: clamped });
    }
    onClose();
  }

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}
      className="absolute inset-0 z-10 flex items-end bg-bg-base/70 outline-none"
      role="dialog" aria-modal="true" aria-label={TITLES[field]}
    >
      <div className="max-h-[85%] w-full space-y-4 overflow-y-auto rounded-t-sheet bg-bg-surface px-gutter pt-5 sm:px-gutter-wide" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <h3 className="text-base font-semibold text-text-primary">{TITLES[field]}</h3>

        {(field === 'end' || field === 'wake') && (
          <div className="space-y-2">
            <DateTimeField
              label={field === 'wake' ? 'Wake time' : 'End time'}
              value={time}
              min={isoToLocalInput(earliest)}
              max={isoToLocalInput()}
              onChange={change(setTime)}
            />
            <p className="text-xs text-text-secondary">
              {field === 'wake'
                ? `Your last reading was ${formatDatetime(earliest)}. It may have stopped before you woke.`
                : `It can't be set before the last reading, ${formatDatetime(earliest)}.`}
            </p>
          </div>
        )}

        {field === 'woke' && (
          <div role="radiogroup" aria-label={TITLES.woke} className="space-y-2">
            {([['Yes', true], ['No', false]] as const).map(([label, v]) => (
              <button key={label} type="button" role="radio" aria-checked={woke === v}
                onClick={() => change(setWoke)(v)}
                className={`flex min-h-target w-full items-center gap-3 rounded-control px-control-x py-control-y text-left text-sm transition-colors ${chipClass(woke === v)}`}>
                <RadioDot selected={woke === v} />
                {label}
              </button>
            ))}
          </div>
        )}

        {field === 'quality' && (
          <ChipSelector options={PAIN_QUALITY_OPTIONS} selected={quality} onChange={change(setQuality)} />
        )}

        {(field === 'symptoms' || field === 'reliefs') && (
          <div className="space-y-3">
            {has.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-text-secondary">Already recorded</p>
                <MarkChips kind={field === 'symptoms' ? 'symptom' : 'relief'} names={has} />
              </div>
            )}
            <ChipSelector
              options={[...new Set([...(field === 'symptoms' ? symptomOptions : reliefOptions), ...added])].filter((o) => !has.includes(o))}
              selected={added}
              // A custom entry that is already on the attack adds nothing.
              onChange={(v) => setAdded(v.filter((x) => !has.includes(x)))}
              onAddCustom={field === 'symptoms' ? onAddSymptom : onAddRelief}
              renderIcon={(o) => field === 'symptoms'
                ? <SymptomIcon name={o} className="h-4 w-4" />
                : <ReliefIcon name={o} className="h-4 w-4" />}
            />
          </div>
        )}

        {field === 'before' && (
          <div className="space-y-3">
            <ChipSelector
              options={triggerOptions}
              selected={triggers.filter((t) => t !== NOTHING_UNUSUAL)}
              onChange={change(setTriggers)}
              onAddCustom={onAddTrigger}
              renderIcon={(t) => <TriggerIcon name={t} className="h-4 w-4" />}
            />
            <button type="button" aria-pressed={nothing}
              onClick={() => change(setTriggers)(nothing ? [] : [NOTHING_UNUSUAL])}
              className={`tap-44-y inline-flex items-center gap-1.5 rounded-chip px-3.5 py-2 text-sm font-medium transition-colors ${chipClass(nothing)}`}>
              Nothing unusual
              <ChipCheck selected={nothing} />
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="button" onClick={save} disabled={!canSave} className="btn-primary flex-1">Save</button>
        </div>
      </div>
    </div>
  );
}
