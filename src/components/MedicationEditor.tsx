import { useId, useState } from 'react';
import type { MedClass, Medication } from '../types';
import { DEFAULT_UNIT } from '../utils/medGuardrails';
import { MOH_DAYS_SIMPLE, MOH_DAYS_TRIPTAN } from '../utils/stats';
import { TYPE_OPTIONS } from '../utils/medClasses';
import { ConfirmDialog } from './ConfirmDialog';
import { ClassBadge } from './ClassBadge';
import { OptionTile } from './settingsUi';
import { InjectionIcon, SprayIcon, TabletIcon } from './drawnIcons';
import { BinIcon } from './icons';

// Add / edit a medication — the v3.9 design (docs/redesign-v3, "My
// medications and dose in onboarding"), rebuilt 2026-10-26: tiles and a
// stepper instead of dropdowns, limits tucked away and never pre-filled.
//
// Opened as a bottom sheet from the list, so it enters from the bottom behind
// a close X — it interrupts the list rather than being a level of it.
//
// **Only a name and a strength are required.** One dose is a stepper that
// starts at 1, and the unit comes from the Form tile, so neither can be left
// unset — the old editor had four required fields, two of them dropdowns that
// started empty.

/** The form tiles, and the unit each one writes. "Other" keeps whatever
 *  non-standard unit the medication already had (sachet, drop…), else "dose". */
type Form = 'tablet' | 'spray' | 'injection' | 'other';
const FORMS: { value: Form; label: string; unit: string | null }[] = [
  { value: 'tablet', label: 'Tablet', unit: 'tablet' },
  { value: 'spray', label: 'Spray', unit: 'spray' },
  { value: 'injection', label: 'Injection', unit: 'injection' },
  { value: 'other', label: 'Other', unit: null },
];

function formOf(unitLabel: string | undefined): Form {
  if (!unitLabel || unitLabel === 'tablet' || unitLabel === 'capsule') return 'tablet';
  if (unitLabel === 'spray' || unitLabel === 'puff') return 'spray';
  if (unitLabel === 'injection') return 'injection';
  return 'other';
}

/** Lucide `circle-ellipsis` — the "Other" form. */
function OtherFormIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="M17 12h.01" /><path d="M12 12h.01" /><path d="M7 12h.01" />
    </svg>
  );
}
const FORM_ICON: Record<Form, (p: { className?: string }) => React.ReactElement> = {
  tablet: TabletIcon, spray: SprayIcon, injection: InjectionIcon, other: OtherFormIcon,
};

// Steps for "one dose". Halves at the low end, where a split tablet is real;
// whole units above.
const QTY = [0.5, 1, 1.5, 2, 3, 4, 5, 6];

const plural = (unit: string) => `${unit}s`;
const unitText = (q: number, unit: string) => `${q} ${q <= 1 ? unit : plural(unit)}`;

/** Empty means "no limit set", which is different from zero. */
function toNumber(text: string): number | undefined {
  const n = Number(text.trim());
  return text.trim() !== '' && Number.isFinite(n) && n > 0 ? n : undefined;
}

/** What the editor hands back — everything but the fields the hook owns. */
export type MedicationDraft = Omit<Medication, 'id' | 'createdAt'>;

interface Props {
  /** Absent when adding. */
  medication?: Medication;
  onSave: (next: MedicationDraft) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const inputClass =
  'w-full min-h-[3.25rem] rounded-2xl bg-bg-surface px-4 text-sm text-text-primary ring-1 ring-inset ring-border-control ' +
  'placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent';

export function MedicationEditor({ medication, onSave, onDelete, onClose }: Props) {
  const nameId = useId();
  const strengthId = useId();

  // Every new medication is for an attack: the "Every day" list was removed
  // (Sunny, 2026-10-26). A preventive stored before then keeps its kind.
  const kind: Medication['kind'] = medication?.kind ?? 'acute';
  const [name, setName] = useState(medication?.name ?? '');
  const initialForm = formOf(medication?.unitLabel);
  const [form, setForm] = useState<Form>(initialForm);
  const [strength, setStrength] = useState(medication?.strength ?? '');
  const [qty, setQty] = useState<number>(medication?.quantity ?? 1);

  // `undefined` is a real answer here ("Not sure"), so whether a type has been
  // *chosen* is tracked separately: a new medication starts with no tile
  // selected, an existing one opens on its own (an old 'other' reads as Not
  // sure, which counts the same way).
  const initialClass = medication?.class === 'other' ? undefined : medication?.class;
  const [medClass, setMedClass] = useState<MedClass | undefined>(initialClass);
  const [typeChosen, setTypeChosen] = useState<boolean>(!!medication);
  const [typeInfo, setTypeInfo] = useState(false);

  const [limitsOpen, setLimitsOpen] = useState(false);
  const [maxPerIntake, setMaxPerIntake] = useState(medication?.maxPerIntake?.toString() ?? '');
  const [maxPerDay, setMaxPerDay] = useState(medication?.maxPerDay?.toString() ?? '');
  const [minHoursBetween, setMinHoursBetween] = useState(medication?.minHoursBetween?.toString() ?? '');
  const [maxDaysPerMonth, setMaxDaysPerMonth] = useState(medication?.maxDaysPerMonth?.toString() ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const acute = kind === 'acute';
  // Unchanged form keeps the stored unit (a "capsule" stays a capsule);
  // a newly picked form writes its own.
  const unit = form === initialForm
    ? (medication?.unitLabel || FORMS.find((f) => f.value === form)!.unit || 'dose')
    : (FORMS.find((f) => f.value === form)!.unit ?? (initialForm === 'other' && medication?.unitLabel ? medication.unitLabel : 'dose'));
  const complete = !!name.trim() && !!strength.trim();

  // A guideline is a placeholder hint only — never written in, so a figure the
  // app invented can't end up stored as though it came off the label.
  const guideline = medClass === 'simple' ? MOH_DAYS_SIMPLE : medClass === 'gepant' ? null : MOH_DAYS_TRIPTAN;
  // "Max in one go" isn't in the v3 design; it is kept for a medication that
  // already has one, so the figure can still be seen and cleared.
  const limits = [
    ...(medication?.maxPerIntake ? [{ key: 'intake', label: 'Max in one go', hint: 'From the leaflet', unit: plural(unit), value: maxPerIntake, set: setMaxPerIntake }] : []),
    { key: 'day', label: 'Max in 24 hours', hint: 'From the leaflet', unit: plural(unit), value: maxPerDay, set: setMaxPerDay },
    { key: 'gap', label: 'Time between doses', hint: 'Shortest gap allowed', unit: 'hours', value: minHoursBetween, set: setMinHoursBetween },
    { key: 'month', label: 'Max days a month', hint: guideline ? `Guideline for this type: ${guideline}` : 'No overuse guideline for gepants', unit: 'days', value: maxDaysPerMonth, set: setMaxDaysPerMonth },
  ];
  const limitsSet = limits.filter((l) => l.value.trim() !== '').length;

  // `dose` stays the one string every other screen renders, so it's derived
  // here rather than stored twice and allowed to disagree. A quantity of one
  // is left out of it — "1 tablet · 50mg" says nothing "50mg" doesn't.
  function derivedDose(): string {
    const count = qty !== 1 ? unitText(qty, unit) : null;
    return [count, strength.trim()].filter(Boolean).join(' · ') || unitText(qty, unit || DEFAULT_UNIT);
  }

  // Every key is always present, explicitly undefined when empty:
  // updateMedication merges with a spread, so a key left out would keep the
  // old value and a limit could never be cleared.
  function draft(): MedicationDraft {
    return {
      kind,
      name: name.trim(),
      dose: derivedDose(),
      strength: strength.trim() || undefined,
      quantity: qty,
      unitLabel: unit,
      class: acute && typeChosen ? medClass : undefined,
      maxPerIntake: acute ? toNumber(maxPerIntake) : undefined,
      maxPerDay: acute ? toNumber(maxPerDay) : undefined,
      minHoursBetween: acute ? toNumber(minHoursBetween) : undefined,
      maxDaysPerMonth: acute ? toNumber(maxDaysPerMonth) : undefined,
      startedOn: acute ? undefined : medication?.startedOn,
    };
  }

  const qi = Math.max(0, QTY.indexOf(qty));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Top bar — close, title, and Delete as a bin at the trailing edge
          (Sunny, 2026-10-26), the same shape as Attack detail's header: away
          from Save in the footer, and still confirmed. */}
      <div
        className="relative flex items-center px-3 py-3 sm:px-4"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-11 w-11 items-center justify-center rounded-full text-text-primary transition-colors hover:bg-bg-raised"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-6 w-6" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <h2 className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-base font-semibold text-text-primary">
          {medication ? 'Edit medication' : 'Add medication'}
        </h2>
        {onDelete && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete medication"
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-full text-text-primary transition-colors hover:bg-severity-high/15 hover:text-severity-high"
          >
            <BinIcon className="h-6 w-6" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-6 pt-2 sm:px-6">
        <div className="space-y-2">
          <label htmlFor={nameId} className="block text-xs font-medium text-text-secondary">Name</label>
          <input id={nameId} type="text" placeholder="e.g. Sumatriptan" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-text-secondary" id={`${nameId}-form`}>Form</p>
          <div role="radiogroup" aria-labelledby={`${nameId}-form`} className="grid grid-cols-4 gap-2">
            {FORMS.map((f) => {
              const Icon = FORM_ICON[f.value];
              const on = form === f.value;
              return (
                <OptionTile key={f.value} compact selected={on} onSelect={() => setForm(f.value)} className={`text-text-primary ${on ? 'bg-accent/20' : 'bg-bg-raised'}`}>
                  <Icon className="h-6 w-6" />
                  <span className="text-xs">{f.label}</span>
                </OptionTile>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor={strengthId} className="block text-xs font-medium text-text-secondary">One dose</label>
          <div className="flex items-center gap-2">
            <input
              id={strengthId}
              type="text"
              placeholder="Strength, e.g. 50 mg"
              value={strength}
              onChange={(e) => setStrength(e.target.value)}
              className={`${inputClass} min-w-0 flex-1`}
            />
            <button
              type="button"
              aria-label="One fewer"
              disabled={qi === 0}
              onClick={() => setQty(QTY[qi - 1])}
              className="flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center rounded-full text-xl text-text-primary ring-1 ring-inset ring-border-control transition-colors hover:bg-bg-raised disabled:text-text-secondary/50"
            >
              −
            </button>
            <span aria-live="polite" className="min-w-[4.5rem] text-center text-sm font-semibold tabular-nums text-text-primary">
              {unitText(qty, unit)}
            </span>
            <button
              type="button"
              aria-label="One more"
              disabled={qi === QTY.length - 1}
              onClick={() => setQty(QTY[qi + 1])}
              className="flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center rounded-full text-xl text-text-primary ring-1 ring-inset ring-border-control transition-colors hover:bg-bg-raised disabled:text-text-secondary/50"
            >
              +
            </button>
          </div>
        </div>

        {acute && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-text-secondary" id={`${nameId}-type`}>Type</p>
                <button
                  type="button"
                  aria-label="Why the type matters"
                  aria-expanded={typeInfo}
                  onClick={() => setTypeInfo((v) => !v)}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-medium text-text-secondary ring-1 ring-inset ring-border-control transition-colors hover:text-text-primary"
                >
                  i
                </button>
              </div>
              {/* Descriptive, never dosing advice — the rule every overuse
                  caption in the app follows. */}
              {typeInfo && (
                <p className="text-xs text-text-secondary">
                  Monthly limits differ by type: {MOH_DAYS_TRIPTAN} days for triptans and combinations, {MOH_DAYS_SIMPLE} for simple painkillers. Gepants aren't counted towards overuse. Not sure counts with {MOH_DAYS_TRIPTAN}.
                </p>
              )}
              <div role="radiogroup" aria-labelledby={`${nameId}-type`} className="grid grid-cols-3 gap-2">
                {TYPE_OPTIONS.map((t) => {
                  const on = typeChosen && medClass === t.value;
                  return (
                    <OptionTile
                      key={t.letter}
                      compact
                      selected={on}
                      onSelect={() => { setMedClass(t.value); setTypeChosen(true); }}
                      className={`text-text-primary ${on ? 'bg-accent/20' : 'bg-bg-raised'}`}
                    >
                      <ClassBadge large>{t.letter}</ClassBadge>
                      <span className="text-xs">{t.label}</span>
                    </OptionTile>
                  );
                })}
              </div>
            </div>

            {/* Limits, folded away. They come off a leaflet the app knows
                nothing about, so nothing here is ever pre-filled, and nothing
                warns until the user has entered a number. */}
            <div className="rounded-[1.25rem] bg-bg-raised p-4">
              <button
                type="button"
                aria-expanded={limitsOpen}
                onClick={() => setLimitsOpen((v) => !v)}
                className="flex min-h-12 w-full items-center gap-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-text-primary">Limits from your leaflet · optional</span>
                  <span className="block text-xs text-text-secondary">{limitsSet ? `${limitsSet} of ${limits.length} set` : 'None set'}</span>
                </span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 text-text-secondary" aria-hidden="true">
                  <path d={limitsOpen ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
                </svg>
              </button>
              {limitsOpen && (
                <div className="mt-3 space-y-3">
                  <p className="text-xs text-text-secondary">
                    Lidd counts your doses against these and shows where you are. It never stops you logging a dose.
                  </p>
                  {limits.map((l) => (
                    <label key={l.key} className="flex items-center gap-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-text-primary">{l.label}</span>
                        <span className="block text-xs text-text-secondary">{l.hint}</span>
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="–"
                        value={l.value}
                        onChange={(e) => l.set(e.target.value.replace(/[^0-9.]/g, ''))}
                        className="min-h-11 w-[5.25rem] rounded-xl bg-bg-surface px-2 text-center text-sm tabular-nums text-text-primary ring-1 ring-inset ring-border-control placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <span className="w-[3.25rem] text-xs text-text-secondary">{l.unit}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </div>

      <div
        className="space-y-2 bg-bg-surface px-4 py-4 sm:px-6"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        {/* Disabled rather than hidden, with the reason above it. */}
        {!complete && (
          <p className="text-center text-xs text-text-secondary">Add a name and the strength to save</p>
        )}
        <button type="button" disabled={!complete} onClick={() => onSave(draft())} className="btn-primary w-full">
          Save
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        danger
        title="Delete this medication?"
        message={medication ? `${medication.name} will no longer be suggested when you log. Attacks that already record it are not affected.` : ''}
        confirmLabel="Delete"
        onConfirm={() => { setConfirmDelete(false); onDelete?.(); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
