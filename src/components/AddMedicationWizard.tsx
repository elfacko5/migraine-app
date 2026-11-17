import { useId, useState } from 'react';
import type { MedClass, MedGuides, Medication } from '../types';
import type { MedicationDraft } from './MedicationEditor';
import { ClassBadge } from './ClassBadge';
import { InlineNote } from './InlineNote';
import { RadioDot } from './RadioDot';
import { TYPE_OPTIONS } from '../utils/medClasses';
import { STANDARD_FORMS, findDuplicate, medLabel, parseStrength, sharedTypeForName, usualDoseExceedsMax } from '../utils/medResolve';
import { guideFor, guideKeyOf, type GuideKey } from '../utils/medGuardrails';
import { chipClass } from '../utils/chipStyles';

// The add flow (commit 1 of the medication flows; frames 15a to 15c in
// medications.html). Three steps, swapped inside one `Sheet flush bareHeader`:
// 1 Name and type → 2 Form and strength → 3 One dose and limits. It replaces
// the *add* path only; editing keeps `MedicationEditor` until commit 3.
//
// Built from Lidd's own parts: the sheet, `RadioDot` rows, `chipClass` tiles,
// `InlineNote`, `btn-primary` / `btn-secondary`. Where a frame needs something
// Lidd has no part for (the value sheet on step 3), the nearest Lidd pattern is
// built and the difference is named in the report, not hidden.
//
// **Step N of 3 is plain text, never the heading** (VoiceOver would otherwise
// announce a count before the thing). Next stays focusable when it can't
// proceed (`aria-disabled`) and says why on screen.

/** The unit each form writes. A form of the user's own writes "dose". */
const FORM_UNIT: Record<string, string> = {
  Tablet: 'tablet', Melt: 'tablet', Capsule: 'capsule', Effervescent: 'tablet',
  'Nasal spray': 'spray', Injection: 'injection', Suppository: 'suppository', Liquid: 'dose',
};
const QTY = [0.5, 1, 1.5, 2, 3, 4, 5, 6];
const GUIDE_LABEL: Record<GuideKey, string> = { triptan: 'Triptan', combination: 'Combination', simple: 'Painkiller', any: 'Any attack medicine' };
const GUIDE_SHARED: Record<GuideKey, string> = {
  triptan: 'shared by all triptans', combination: 'shared by all combinations', simple: 'shared by all painkillers', any: 'shared by all attack medicines',
};

const plural = (unit: string) => `${unit}s`;
const unitText = (q: number, unit: string) => `${q} ${q <= 1 ? unit : plural(unit)}`;

const inputClass =
  'w-full min-h-[3.25rem] rounded-field bg-bg-surface px-4 text-sm text-text-primary ring-1 ring-inset ring-border-control ' +
  'placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent';

type LimitKey = 'qty' | 'day' | 'gap';

interface Props {
  library: Medication[];
  guides: MedGuides;
  onAdd: (draft: MedicationDraft) => void;
  onEditExisting: (med: Medication) => void;
  onClose: () => void;
}

export function AddMedicationWizard({ library, guides, onAdd, onEditExisting, onClose }: Props) {
  const nameId = useId();
  const strengthId = useId();
  const ownId = useId();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [name, setName] = useState('');
  const [medClass, setMedClass] = useState<MedClass | undefined>(undefined);
  const [typeChosen, setTypeChosen] = useState(false);

  const [form, setForm] = useState<string>('Tablet');
  const [ownOpen, setOwnOpen] = useState(false);
  const [ownForm, setOwnForm] = useState('');
  const [strength, setStrength] = useState('');

  const [qty, setQty] = useState(1);
  const [maxPerDay, setMaxPerDay] = useState<number | undefined>(undefined);
  const [gap, setGap] = useState<number | undefined>(undefined);
  const [editing, setEditing] = useState<LimitKey | null>(null);

  // ── step 1 ───────────────────────────────────────────────────────────────
  const trimmed = name.trim();
  const sameName = trimmed
    ? library.filter((m) => m.name.trim().toLowerCase() === trimmed.toLowerCase())
    : [];
  // A name that matches existing entries brings the type they share, until a
  // tile has been chosen by hand. Entries that disagree bring nothing.
  const suggested = trimmed ? sharedTypeForName(trimmed, library) : undefined;
  const typeFromName = !typeChosen && suggested !== undefined;
  const effectiveClass: MedClass | undefined = typeChosen ? medClass : suggested;
  const typeSet = typeChosen || typeFromName;
  const step1Ready = !!trimmed && typeSet;

  // ── step 2 ───────────────────────────────────────────────────────────────
  const effectiveForm = ownOpen ? ownForm.trim() : form;
  const unit = FORM_UNIT[effectiveForm] ?? 'dose';
  const candidate = { name: trimmed, form: effectiveForm, strength: strength.trim(), dose: strength.trim(), unitLabel: unit };
  const duplicate = effectiveForm && strength.trim() ? findDuplicate(candidate, library) : null;
  const step2Ready = !!effectiveForm && !!strength.trim();
  const parsed = parseStrength(strength);
  const strengthNote = strength.trim() !== '' && !parsed;

  // ── step 3 ───────────────────────────────────────────────────────────────
  const aboveMax = usualDoseExceedsMax(qty, maxPerDay);
  const guideKey = guideKeyOf(effectiveClass);
  const totalMg = (n: number) => (parsed ? `${Math.round(n * parsed.value * 100) / 100} ${parsed.unit}` : null);

  function derivedDose(): string {
    const count = qty !== 1 ? unitText(qty, unit) : null;
    return [count, strength.trim()].filter(Boolean).join(' · ') || unitText(qty, unit);
  }

  function draft(): MedicationDraft {
    return {
      kind: 'acute',
      name: trimmed,
      dose: derivedDose(),
      strength: strength.trim(),
      quantity: qty,
      unitLabel: unit,
      form: effectiveForm,
      class: effectiveClass,
      maxPerDay,
      minHoursBetween: gap,
    };
  }

  const stepText = `Step ${step} of 3`;
  const heading = step === 1 ? 'Add a medicine' : step === 2 ? trimmed : 'How do you take it?';
  const sub = step === 2
    ? TYPE_OPTIONS.find((t) => t.value === effectiveClass)?.label
    : step === 3 ? medLabel(candidate) : null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        className="flex items-center justify-between gap-2 px-3 py-3 sm:px-4"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        {step > 1 ? (
          <button type="button" onClick={() => setStep((s) => (s - 1) as 1 | 2)} className="btn-tertiary flex min-h-target items-center gap-1 px-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            Back
          </button>
        ) : <span />}
        <p className="min-w-0 flex-1 text-center text-xs text-text-secondary">{stepText}</p>
        <button type="button" onClick={onClose} className="btn-tertiary min-h-target px-2">Cancel</button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-gutter pb-6 pt-2 sm:px-gutter-wide">
        <div>
          <h2 className="text-[1.5rem] font-semibold leading-tight text-text-primary">{heading}</h2>
          {sub && <p className="mt-1 text-sm text-text-secondary">{sub}</p>}
        </div>

        {step === 1 && (
          <>
            <div className="space-y-2">
              <label htmlFor={nameId} className="block text-xs font-medium text-text-secondary">Name</label>
              <input id={nameId} type="text" placeholder="As it's written on the box" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              {sameName.length > 0 && (
                <InlineNote tone="amber">
                  You already have {sameName.map(medLabel).join(', ')}.{' '}
                  <button type="button" onClick={() => onEditExisting(sameName[0])} className="font-medium text-text-primary underline underline-offset-2">Edit it instead</button>
                </InlineNote>
              )}
            </div>

            <div className="space-y-2">
              <p id={`${nameId}-type`} className="text-base font-semibold text-text-primary">What kind of medicine is it?</p>
              <div role="radiogroup" aria-labelledby={`${nameId}-type`} className="space-y-2">
                {TYPE_OPTIONS.map((t) => {
                  const on = typeSet && effectiveClass === t.value;
                  return (
                    <button
                      key={t.letter}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => { setMedClass(t.value); setTypeChosen(true); }}
                      className={`tap-44-y flex min-h-[3.5rem] w-full items-center gap-3 rounded-control px-control-x text-left ${chipClass(on)}`}
                    >
                      <ClassBadge>{t.letter}</ClassBadge>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-medium text-text-primary">{t.label}</span>
                        <span className="block text-xs text-text-secondary">{TYPE_HINT[t.letter]}</span>
                      </span>
                      <RadioDot selected={on} />
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-text-secondary">It's on the box or the leaflet. Decides which monthly guide it counts toward.</p>
              {typeFromName && (
                <InlineNote>Same type as your other {trimmed}. Change it if this one is different.</InlineNote>
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="space-y-2">
              <p id={`${nameId}-form`} className="text-xs font-medium text-text-secondary">Form</p>
              {!ownOpen ? (
                <>
                  <div role="radiogroup" aria-labelledby={`${nameId}-form`} className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
                    {STANDARD_FORMS.map((f) => {
                      const on = form === f;
                      return (
                        <button key={f} type="button" role="radio" aria-checked={on} onClick={() => setForm(f)}
                          className={`tap-44-y flex min-h-[3.25rem] items-center gap-2 rounded-control px-control-x text-left text-base ${chipClass(on)}`}>
                          <span className="min-w-0 flex-1">{f}</span>
                          <RadioDot selected={on} />
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => { setOwnOpen(true); }} className="btn-tertiary min-h-target">+ Add a different form</button>
                </>
              ) : (
                <div className="space-y-2">
                  <label htmlFor={ownId} className="block text-sm text-text-primary">Your own form</label>
                  <input id={ownId} autoFocus type="text" value={ownForm} onChange={(e) => setOwnForm(e.target.value)} className={inputClass} />
                  <p className="text-xs text-text-secondary">Only for this medicine.</p>
                  <button type="button" onClick={() => { setOwnOpen(false); setOwnForm(''); }} className="btn-tertiary min-h-target">Cancel</button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor={strengthId} className="block text-xs font-medium text-text-secondary">Strength</label>
              <input id={strengthId} type="text" placeholder="As printed on the box, e.g. 500/50 mg or 100 mg/5 ml" value={strength} onChange={(e) => setStrength(e.target.value)} className={inputClass} />
              {strengthNote && <InlineNote>Lidd can't work out totals for this strength. Counts still work.</InlineNote>}
            </div>

            {duplicate && (
              <InlineNote tone="amber">
                You already have {medLabel(duplicate)}.{' '}
                <button type="button" onClick={() => onEditExisting(duplicate)} className="font-medium text-text-primary underline underline-offset-2">Edit it instead</button>
              </InlineNote>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <div className="rounded-card bg-bg-raised">
              <LimitRow
                label="Usual dose"
                hint={`${plural(unit[0].toUpperCase() + unit.slice(1))} you take at once`}
                value={unitText(qty, unit)}
                extra={totalMg(qty)}
                onOpen={() => setEditing('qty')}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">From the leaflet <span className="font-normal text-text-secondary">· optional</span></p>
              <p className="text-xs text-text-secondary">Lidd shows where you are; it never stops you logging.</p>
              <div className="overflow-hidden rounded-card bg-bg-raised [&>*+*]:border-t [&>*+*]:border-bg-border">
                <LimitRow label="Max in 24 hours" value={maxPerDay ? unitText(maxPerDay, unit) : 'Not set'} extra={maxPerDay ? totalMg(maxPerDay) : null} onOpen={() => setEditing('day')} />
                <LimitRow label="Time between doses" value={gap ? `${gap} ${gap === 1 ? 'hour' : 'hours'}` : 'Not set'} onOpen={() => setEditing('gap')} />
              </div>
            </div>

            {guideKey && (
              <p className="text-xs text-text-secondary">
                {GUIDE_LABEL[guideKey]} days a month: <span className="font-medium text-text-primary">{guideFor(guideKey, guides)} days</span> · {GUIDE_SHARED[guideKey]}
              </p>
            )}

            {aboveMax && (
              <InlineNote tone="amber">Your usual dose ({qty}) is more than the max in 24 hours ({maxPerDay}). Check the leaflet.</InlineNote>
            )}
          </>
        )}
      </div>

      <div
        className="space-y-2 bg-bg-surface px-gutter py-4 sm:px-gutter-wide"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        {step === 1 && !step1Ready && (
          <p className="text-center text-xs text-text-secondary">{!trimmed ? 'Add the name to continue' : 'Choose a type to continue'}</p>
        )}
        {step === 2 && !step2Ready && (
          <p className="text-center text-xs text-text-secondary">{!effectiveForm ? 'Choose or type a form to continue' : 'Add the strength to continue'}</p>
        )}
        {step === 2 && step2Ready && duplicate && (
          <p className="text-center text-xs text-text-secondary">You already have this exact medicine.</p>
        )}
        {step < 3 ? (
          <button
            type="button"
            aria-disabled={step === 1 ? !step1Ready : !step2Ready || !!duplicate}
            onClick={() => {
              if (step === 1 && step1Ready) setStep(2);
              else if (step === 2 && step2Ready && !duplicate) setStep(3);
            }}
            className="btn-primary w-full"
          >
            Next
          </button>
        ) : (
          <button type="button" onClick={() => onAdd(draft())} className="btn-primary w-full">Add {trimmed}</button>
        )}
      </div>

      {editing && (
        <ValueSheet
          key={editing}
          title={editing === 'qty' ? 'Usual dose' : editing === 'day' ? 'Max in 24 hours' : 'Time between doses'}
          hint={editing === 'day' ? 'On the leaflet, under “How much to take”' : editing === 'gap' ? 'Shortest gap the leaflet allows between two doses' : `${plural(unit[0].toUpperCase() + unit.slice(1))} you take at once`}
          unit={editing === 'gap' ? 'hours' : plural(unit)}
          steps={editing === 'gap' ? GAP_STEPS : QTY}
          value={editing === 'qty' ? qty : editing === 'day' ? maxPerDay : gap}
          fallback={editing === 'qty' ? 1 : editing === 'day' ? 2 : 2}
          total={editing === 'gap' ? null : totalMg}
          onClear={editing === 'qty' ? undefined : () => { if (editing === 'day') setMaxPerDay(undefined); else setGap(undefined); setEditing(null); }}
          onDone={(v) => { if (editing === 'qty') setQty(v); else if (editing === 'day') setMaxPerDay(v); else setGap(v); setEditing(null); }}
        />
      )}
    </div>
  );
}

const TYPE_HINT: Record<string, string> = {
  T: 'Name usually ends in “-triptan”',
  C: 'Two or more medicines in one tablet',
  P: 'Paracetamol, ibuprofen, naproxen, aspirin',
  G: 'Name usually ends in “-gepant”',
  '?': 'Counted under “Any” until you choose',
};
const GAP_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8, 12, 24];

function LimitRow({ label, hint, value, extra, onOpen }: { label: string; hint?: string; value: string; extra?: string | null; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="tap-44-y flex min-h-[3.5rem] w-full items-center gap-3 px-control-x py-control-y text-left">
      <span className="min-w-0 flex-1">
        <span className="block text-base text-text-primary">{label}</span>
        {hint && <span className="block text-xs text-text-secondary">{hint}</span>}
      </span>
      <span className="text-right">
        <span className="block text-base font-medium text-text-primary">{value}</span>
        {extra && <span className="block text-xs text-text-secondary">{extra}</span>}
      </span>
    </button>
  );
}

/** One number at a time, set with − and +, over the wizard (frames 15c-2 and
 *  15c-3). Lidd has no bottom sheet smaller than a full `Sheet`, so this is the
 *  nearest pattern: a panel anchored to the bottom of the wizard on a scrim. */
function ValueSheet({ title, hint, unit, steps, value, fallback, total, onClear, onDone }: {
  title: string; hint: string; unit: string; steps: number[]; value: number | undefined; fallback: number;
  total: ((n: number) => string | null) | null; onClear?: () => void; onDone: (v: number) => void;
}) {
  const [v, setV] = useState(value ?? fallback);
  const i = Math.max(0, steps.indexOf(v));
  const t = total ? total(v) : null;
  return (
    <div className="absolute inset-0 z-10 flex items-end bg-bg-base/70" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full space-y-4 rounded-t-sheet bg-bg-surface px-gutter pt-5 sm:px-gutter-wide" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <div>
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
          <p className="text-xs text-text-secondary">{hint}</p>
        </div>
        <div className="flex items-center justify-center gap-4">
          <button type="button" aria-label="Less" disabled={i === 0} onClick={() => setV(steps[i - 1])}
            className="flex size-14 items-center justify-center rounded-full text-2xl text-text-primary ring-1 ring-inset ring-border-control disabled:text-text-secondary/50">−</button>
          <div className="min-w-[6rem] text-center" aria-live="polite">
            <span className="block text-[2.5rem] font-semibold tabular-nums leading-none text-text-primary">{v}</span>
            <span className="block text-sm text-text-secondary">{unit}</span>
            {t && <span className="block text-xs text-text-secondary">= {t}</span>}
          </div>
          <button type="button" aria-label="More" disabled={i === steps.length - 1} onClick={() => setV(steps[i + 1])}
            className="flex size-14 items-center justify-center rounded-full text-2xl text-text-primary ring-1 ring-inset ring-border-control disabled:text-text-secondary/50">+</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {onClear && <button type="button" onClick={onClear} className="btn-secondary flex-1">Clear</button>}
          <button type="button" onClick={() => onDone(v)} className="btn-primary flex-1">Done</button>
        </div>
      </div>
    </div>
  );
}
