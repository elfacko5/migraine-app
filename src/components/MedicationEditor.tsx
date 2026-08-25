import { cloneElement, useId, useState } from 'react';
import type { MedClass, Medication } from '../types';
import { DEFAULT_UNIT } from '../utils/medGuardrails';
import { MOH_DAYS_SIMPLE, MOH_DAYS_TRIPTAN } from '../utils/stats';
import { ConfirmDialog } from './ConfirmDialog';
import { BinIcon } from './icons';

// The four ICHD-3 classes. The class decides one thing only: which
// medication-overuse reference point a monthly count is measured against.
const CLASSES: { value: MedClass; label: string }[] = [
  { value: 'triptan', label: 'Triptan' },
  { value: 'combination', label: 'Combination painkiller' },
  { value: 'simple', label: 'Simple painkiller' },
  { value: 'other', label: 'Other' },
];

// A fixed list rather than free text: the unit is only ever one of a handful
// of words, it labels the wizard's quantity picker ("2 sprays"), and a typo
// would read as a different medication's unit for good. The plural is formed
// by adding an "s", which holds for every option here.
const UNITS = ['tablet', 'capsule', 'spray', 'puff', 'sachet', 'injection', 'drop'];

const QUANTITIES = ['0.5', '1', '1.5', '2', '3', '4'];

const mohSuggestion = (cls: MedClass | undefined) =>
  cls === 'simple' ? MOH_DAYS_SIMPLE : cls ? MOH_DAYS_TRIPTAN : null;

/** Empty means "no limit set", which is different from zero. */
function toNumber(text: string): number | undefined {
  const n = Number(text.trim());
  return text.trim() !== '' && Number.isFinite(n) && n > 0 ? n : undefined;
}

const plural = (unit: string) => `${unit}s`;

// **What each optional field means, in its own words.** The fields are
// transcribed off a label, and a label doesn't explain itself — "max days a
// month" reads as a limit the app is imposing until you know it's the number
// *you* typed and that it's only ever counted against.
//
// Every one of these has to stay descriptive. The app states what it counts
// and what your figure is; it must never read as dosing advice, which is the
// same rule the Insights caption and the Today warning already follow.
const INFO: Record<string, { title: string; message: string }> = {
  type: {
    title: 'Type',
    message:
      `Which family the medication belongs to. It's used for one thing: which overuse guideline your ` +
      `monthly count is measured against — around ${MOH_DAYS_TRIPTAN} days a month for triptans and ` +
      `combination painkillers, ${MOH_DAYS_SIMPLE} for simple ones. If you enter your own "maximum days ` +
      `a month" below, that is used instead and the type stops mattering.`,
  },
  maxPerIntake: {
    title: 'Max in one go',
    message:
      'The most units your prescription or the leaflet says to take at once. When a dose you are logging ' +
      'is above it, the app says so and shows your number — it never stops you logging what you actually took.',
  },
  maxPerDay: {
    title: 'Max in 24 hours',
    message:
      'The most units in a rolling 24 hours, which is how a leaflet usually states it. Rolling rather than ' +
      'per calendar day, so a late-night dose and an early-morning one count together instead of falling ' +
      'either side of midnight. This is the figure behind "3 of 6 in the last 24h" on your Today screen.',
  },
  minHoursBetween: {
    title: 'Time between doses',
    message:
      'The smallest gap the label asks you to leave between intakes. The app works out when the next dose ' +
      'falls due and shows the time — as your own figure, not as an instruction.',
  },
  maxDaysPerMonth: {
    title: 'Max days a month',
    message:
      'The most days a month the label allows — some boxes print this directly. Leave it blank and the ' +
      'guideline number for the Type above is used instead. It counts days, not doses, so twice in one day ' +
      'is one day; and it can only count doses you logged inside an attack.',
  },
  started: {
    title: 'Started',
    message:
      'When you began taking it. It lets your migraine days a month before that date be compared with after, ' +
      'which is the usual way a preventive is judged to be working. Nothing else uses it.',
  },
};

// A label row with the field's own "More info" opener, then the control.
//
// **The text is a real `<label>` tied to the control, not a styled span.** As
// a span it looked identical and named nothing: all seven fields in this
// editor announced themselves as "edit text, blank" to a screen reader, and a
// placeholder is not a name — it disappears the moment you type. The id is
// generated and injected into the child, so the association can't be
// forgotten and the layout stays as it was: label row on top, full-width
// control beneath.
//
// "More info" is outside the label, and names the field it explains — nested
// inside it would activate the control on tap and be read out as part of the
// field's own name, and four identical "More info" buttons in a row tell a
// screen-reader user nothing about which is which.
function Field({ label, infoKey, onInfo, children }: {
  label: string;
  infoKey?: string;
  onInfo?: (key: string) => void;
  children: React.ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-3">
        <label htmlFor={id} className="min-w-0 flex-1 text-sm text-text-secondary">{label}</label>
        {infoKey && onInfo && (
          <button
            type="button"
            onClick={() => onInfo(infoKey)}
            aria-label={`More info about ${label}`}
            // `tap-44` expands the touch target without changing the layout:
            // as drawn this was 66×21, under even WCAG 2.2's 24px floor.
            className="tap-44 shrink-0 text-xs text-accent-light hover:underline"
          >
            More info
          </button>
        )}
      </div>
      {cloneElement(children, { id })}
    </div>
  );
}

const inputClass =
  'w-full rounded-lg bg-bg-raised border border-border-control px-3 py-2.5 text-sm text-text-primary ' +
  'placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent';

/** A numeric limit with its unit spelled out at the trailing edge of the box. */
function NumberField({ id, value, onChange, suffix, placeholder }: {
  /** Injected by `Field`. It has to reach the input, not the wrapper — the
   *  suffix needs a positioned parent, and a `<div>` carrying the id would
   *  leave the control itself nameless. */
  id?: string;
  value: string;
  onChange: (v: string) => void;
  suffix: string;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} pr-24 tabular-nums`}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-secondary">
        {suffix}
      </span>
    </div>
  );
}

/** What the editor hands back — everything but the fields the hook owns. */
export type MedicationDraft = Omit<Medication, 'id' | 'createdAt' | 'kind'>;

interface Props {
  /** Absent when adding. */
  medication?: Medication;
  kind: Medication['kind'];
  onSave: (next: MedicationDraft) => void;
  onDelete?: () => void;
  onClose: () => void;
}

// Opened as a bottom sheet from the medications list — a modal detour, so it
// enters from the bottom behind a close X, unlike the Profile pages, which
// are a drill-down and slide in from the right behind a back chevron.
//
// Same shape as AttackDetail: own top bar (close · title · delete), one
// scrolling body, and a flex-pinned footer holding the primary action.
//
// **Two sections, and the split is the point.** The top is what the
// medication *is* — name, strength, and the quantity that makes one dose —
// copied off the prescription, or off the label when it's over the counter.
// All four are required: they're the fields every other screen renders, and a
// medication that can't say what one dose of it is can't be counted against
// anything. Everything below is optional, which is why it sits behind its own
// heading and why each field carries its own "More info": they're transcribed
// off a leaflet, and a leaflet doesn't explain itself.
export function MedicationEditor({ medication, kind, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(medication?.name ?? '');
  const [strength, setStrength] = useState(medication?.strength ?? '');
  const [quantity, setQuantity] = useState(medication?.quantity?.toString() ?? '');
  // Starts empty rather than defaulting to 'tablet', so "required" means a
  // choice was actually made — a pre-filled field is one nobody reads.
  const [unitLabel, setUnitLabel] = useState(medication?.unitLabel ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  // Optional, acute only.
  const [medClass, setMedClass] = useState<MedClass | undefined>(medication?.class);
  const [maxPerIntake, setMaxPerIntake] = useState(medication?.maxPerIntake?.toString() ?? '');
  const [maxPerDay, setMaxPerDay] = useState(medication?.maxPerDay?.toString() ?? '');
  const [minHoursBetween, setMinHoursBetween] = useState(medication?.minHoursBetween?.toString() ?? '');
  const [maxDaysPerMonth, setMaxDaysPerMonth] = useState(medication?.maxDaysPerMonth?.toString() ?? '');

  // Optional, preventive only.
  const [startedOn, setStartedOn] = useState(medication?.startedOn ?? '');

  const unit = unitLabel || DEFAULT_UNIT;
  const acute = kind === 'acute';

  const complete = !!name.trim() && !!strength.trim() && !!quantity && !!unitLabel;

  // `dose` stays the one string every other screen renders, so it's derived
  // here rather than stored twice and allowed to disagree. A quantity of one
  // is left out of it — "1 tablet · 50mg" says nothing "50mg" doesn't.
  function derivedDose(): string {
    const qty = Number(quantity);
    const count = qty && qty !== 1 ? `${quantity} ${plural(unit)}` : null;
    return [count, strength.trim()].filter(Boolean).join(' · ') || `${quantity || 1} ${unit}`;
  }

  // Every key is always present, explicitly undefined when the field is
  // empty: updateMedication merges with a spread, so a key left out would
  // keep the old value and a limit could never be cleared.
  function draft(): MedicationDraft {
    return {
      name: name.trim(),
      dose: derivedDose(),
      strength: strength.trim() || undefined,
      quantity: toNumber(quantity),
      unitLabel: unitLabel || undefined,
      class: acute ? medClass : undefined,
      maxPerIntake: acute ? toNumber(maxPerIntake) : undefined,
      maxPerDay: acute ? toNumber(maxPerDay) : undefined,
      minHoursBetween: acute ? toNumber(minHoursBetween) : undefined,
      maxDaysPerMonth: acute ? toNumber(maxDaysPerMonth) : undefined,
      startedOn: !acute ? (startedOn || undefined) : undefined,
    };
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Top app bar — close leading, delete trailing */}
      <div
        className="relative flex items-center border-b border-border-subtle px-3 py-3 sm:px-4"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="tap-44 rounded-full bg-bg-raised/60 p-2 text-text-secondary hover:bg-bg-raised hover:text-text-primary transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-base font-medium text-text-primary">
          {medication ? 'Edit medication' : 'Add medication'}
        </span>

        {onDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete medication"
            className="tap-44 ml-auto rounded-full bg-bg-raised/60 p-2 text-text-secondary hover:bg-severity-high/15 hover:text-severity-high transition-colors"
          >
            <BinIcon />
          </button>
        ) : (
          /* Keeps the title optically centred when adding, where there's
             nothing to delete. */
          <span className="ml-auto h-9 w-9" aria-hidden="true" />
        )}
      </div>

      {/* Body — the only scrolling region */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 space-y-6">
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-medium text-text-primary">Medication details</h2>
            <p className="text-xs text-text-secondary">
              As prescribed by your doctor, or off the label if you bought it over the counter — what one
              dose of it is.{' '}
              {acute
                ? 'This is what appears as a one-tap chip when you log medication.'
                : 'Preventives are kept out of attack logging, since a daily dose is not a treatment for the attack it happens to coincide with.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Medication name">
              <input
                type="text"
                placeholder="e.g. Aspirin"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Strength">
              <input
                type="text"
                placeholder="e.g. 50mg"
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Quantity">
              <select
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={inputClass}
              >
                <option value="" disabled>Choose</option>
                {QUANTITIES.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </Field>
            <Field label="Unit">
              <select
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
                className={inputClass}
              >
                <option value="" disabled>Choose</option>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <section className="space-y-4 border-t border-bg-border pt-6">
          <div className="space-y-1">
            <h2 className="text-lg font-medium text-text-primary">
              Additional information <span className="text-sm font-normal text-text-secondary">· optional</span>
            </h2>
            <p className="text-xs text-text-secondary">
              {acute
                ? "From your prescription or the leaflet — the app doesn't know them and never guesses. It counts your logged doses against whatever you enter and shows you where you are. It won't stop you logging a dose either way."
                : 'Only used to answer whether the preventive is working. Nothing here changes how anything is logged.'}
            </p>
          </div>

          {acute ? (
            <>
              <Field label="Type" infoKey="type" onInfo={setInfo}>
                <select
                  value={medClass ?? ''}
                  onChange={(e) => setMedClass((e.target.value || undefined) as MedClass | undefined)}
                  className={inputClass}
                >
                  <option value="">Not set</option>
                  {CLASSES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>

              <Field label="Max in one go" infoKey="maxPerIntake" onInfo={setInfo}>
                <NumberField
                  value={maxPerIntake}
                  onChange={setMaxPerIntake}
                  suffix={plural(unit)}
                  placeholder="e.g. 1"
                />
              </Field>

              {/* Kept, though it wasn't in the sketch: it's the figure behind
                  "3 of 6 in the last 24h" on Today and in the wizard, which is
                  the running total this whole feature was asked for. */}
              <Field label="Max in 24 hours" infoKey="maxPerDay" onInfo={setInfo}>
                <NumberField
                  value={maxPerDay}
                  onChange={setMaxPerDay}
                  suffix={plural(unit)}
                  placeholder="e.g. 6"
                />
              </Field>

              <Field label="Time between doses" infoKey="minHoursBetween" onInfo={setInfo}>
                <NumberField
                  value={minHoursBetween}
                  onChange={setMinHoursBetween}
                  suffix="hours"
                  placeholder="e.g. 6"
                />
              </Field>

              <Field label="Max days a month" infoKey="maxDaysPerMonth" onInfo={setInfo}>
                <NumberField
                  value={maxDaysPerMonth}
                  onChange={setMaxDaysPerMonth}
                  suffix="days"
                  // The guideline number for the chosen type, shown as a
                  // placeholder and never filled in: a figure the app invented
                  // must not end up stored as though it came off the label.
                  placeholder={mohSuggestion(medClass) ? `e.g. ${mohSuggestion(medClass)}` : 'e.g. 10'}
                />
              </Field>
            </>
          ) : (
            <Field label="Started" infoKey="started" onInfo={setInfo}>
              <input
                type="date"
                value={startedOn}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setStartedOn(e.target.value)}
                className={inputClass}
              />
            </Field>
          )}
        </section>
      </div>

      {/* Save — flex-pinned above the home indicator, so it stays put however
          long the body gets. */}
      <div
        className="border-t border-bg-border bg-bg-surface px-4 sm:px-6 py-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          disabled={!complete}
          onClick={() => onSave(draft())}
          // Disabled rather than hidden, and the line below says what is
          // missing — a control that only appears once its precondition is met
          // gives no hint it exists, the same call the wizard's "Finish now"
          // makes.
          className="btn-primary w-full rounded-xl py-3 text-sm font-medium transition-colors"
        >
          Save
        </button>
        {!complete && (
          <p className="mt-2 text-center text-xs text-text-secondary">
            Name, strength, quantity and unit are needed.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={info !== null}
        dismissOnly
        title={info ? INFO[info].title : ''}
        message={info ? INFO[info].message : ''}
        confirmLabel="Got it"
        onConfirm={() => setInfo(null)}
        onCancel={() => setInfo(null)}
      />

      <ConfirmDialog
        open={confirmDelete}
        danger
        title="Delete this medication?"
        message={
          medication
            ? `${medication.name} will no longer be suggested when you log. Attacks that already record it are not affected.`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={() => { setConfirmDelete(false); onDelete?.(); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
