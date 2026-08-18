import { useState } from 'react';
import type { MedClass, Medication } from '../types';
import { chipClass } from '../utils/chipStyles';
import { DEFAULT_UNIT } from '../utils/medGuardrails';
import { MOH_DAYS_SIMPLE, MOH_DAYS_TRIPTAN } from '../utils/stats';
import { ConfirmDialog } from './ConfirmDialog';
import { BinIcon } from './icons';

const QTY_OPTIONS = ['1 tablet', '2 tablets', '3 tablets'];

// The four ICHD-3 classes, and the only thing the class decides: which
// medication-overuse reference point applies. The number is *suggested* as a
// placeholder on the days-a-month field and never filled in — the app repeats
// back what the label says, and a guideline figure silently entered as if it
// were the prescription would be exactly the inference this feature refuses
// to make.
const CLASSES: { value: MedClass; label: string }[] = [
  { value: 'triptan', label: 'Triptan' },
  { value: 'combination', label: 'Combination' },
  { value: 'simple', label: 'Simple painkiller' },
  { value: 'other', label: 'Other' },
];

const mohSuggestion = (cls: MedClass | undefined) =>
  cls === 'simple' ? MOH_DAYS_SIMPLE : cls ? MOH_DAYS_TRIPTAN : null;

/** Empty means "no limit set", which is different from zero. */
function toNumber(text: string): number | undefined {
  const n = Number(text.trim());
  return text.trim() !== '' && Number.isFinite(n) && n > 0 ? n : undefined;
}

/** A limits field: a short numeric input with its unit spelled out beside it. */
function LimitField({ label, suffix, value, onChange, placeholder }: {
  label: string;
  suffix: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex items-center gap-3">
      <span className="min-w-0 flex-1 text-sm text-text-primary">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-20 rounded-lg bg-bg-raised border border-bg-border px-3 py-2 text-sm tabular-nums text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <span className="w-16 shrink-0 text-xs text-text-secondary">{suffix}</span>
    </label>
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
// scrolling body, and a flex-pinned footer holding the primary action. The
// delete is trailing in the app bar rather than under Save for the reason
// recorded there — the footer is for what you came to do, and a destructive
// action beside the primary one is a mis-tap waiting to happen. Pinning Save
// also means it doesn't drift down the page as the body grows.
//
// Name + dose pair and the quantity quick-pick mirror MedicationInput, so a
// medication is entered the same way here as it is mid-attack.
export function MedicationEditor({ medication, kind, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(medication?.name ?? '');
  const [dose, setDose] = useState(medication?.dose ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Limits, acute only. Held as strings so an emptied field means "no limit"
  // rather than 0 — a zero limit would read as "never take this".
  const [medClass, setMedClass] = useState<MedClass | undefined>(medication?.class);
  const [unitLabel, setUnitLabel] = useState(medication?.unitLabel ?? '');
  const [maxPerIntake, setMaxPerIntake] = useState(medication?.maxPerIntake?.toString() ?? '');
  const [maxPerDay, setMaxPerDay] = useState(medication?.maxPerDay?.toString() ?? '');
  const [minHoursBetween, setMinHoursBetween] = useState(medication?.minHoursBetween?.toString() ?? '');
  const [maxDaysPerMonth, setMaxDaysPerMonth] = useState(medication?.maxDaysPerMonth?.toString() ?? '');

  // Preventive only.
  const [startedOn, setStartedOn] = useState(medication?.startedOn ?? '');

  const unit = unitLabel.trim() || DEFAULT_UNIT;

  // Every key is always present, explicitly undefined when the field is
  // empty: updateMedication merges with a spread, so a key left out would
  // keep the old value and a limit could never be cleared.
  function draft() {
    const acute = kind === 'acute';
    return {
      name: name.trim(),
      dose: dose.trim(),
      class: acute ? medClass : undefined,
      unitLabel: acute ? (unitLabel.trim() || undefined) : undefined,
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
          className="rounded-full bg-bg-raised/60 p-2 text-text-secondary hover:bg-bg-raised hover:text-text-primary transition-colors"
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
            className="ml-auto rounded-full bg-bg-raised/60 p-2 text-text-secondary hover:bg-severity-high/15 hover:text-severity-high transition-colors"
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
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
      <p className="text-xs text-text-secondary">
        {kind === 'acute'
          ? 'Taken to treat an attack. Appears as a one-tap chip when you log medication.'
          : 'Taken daily, whether or not you have an attack. Kept out of attack logging.'}
      </p>

      <div className="space-y-2.5">
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Medication name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 min-w-0 rounded-lg bg-bg-raised border border-bg-border px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <input
            type="text"
            placeholder="Dose / strength"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            className="w-32 rounded-lg bg-bg-raised border border-bg-border px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary shrink-0">Qty:</span>
          {QTY_OPTIONS.map((qty) => (
            <button
              key={qty}
              type="button"
              onClick={() => setDose(qty)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                dose === qty
                  ? 'bg-accent/20 text-accent-light ring-1 ring-inset ring-accent/40'
                  : 'bg-bg-raised text-text-secondary ring-1 ring-inset ring-bg-border hover:text-text-primary'
              }`}
            >
              {qty}
            </button>
          ))}
        </div>
      </div>

      {kind === 'acute' ? (
        /* **Limits — the user's own numbers, off the prescription.** All
           optional: the editor has to stay usable with none of them set, and
           a medication with no limits behaves exactly as it did before any of
           this existed. The app only ever counts against them and repeats the
           figure back; it never blocks a dose and never phrases a warning as
           an instruction. */
        <section className="space-y-3 border-t border-bg-border pt-5">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wider font-medium text-text-secondary label-caps">Limits</p>
            <p className="text-xs text-text-secondary">
              From your prescription or the leaflet — the app doesn't know them and never guesses. It counts
              your logged doses against whatever you enter and shows you where you are. It won't stop you
              logging a dose either way.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-text-secondary">Type</p>
            <div className="flex flex-wrap gap-2">
              {CLASSES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={medClass === c.value}
                  /* Tapping the chosen type again clears it — with no other
                     way to unset it, a mis-tap would otherwise be permanent. */
                  onClick={() => setMedClass((cur) => (cur === c.value ? undefined : c.value))}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${chipClass(medClass === c.value)}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-text-secondary">
              Only decides which overuse guideline this is measured against — around {MOH_DAYS_TRIPTAN} days a
              month for triptans and combinations, {MOH_DAYS_SIMPLE} for simple painkillers.
            </p>
          </div>

          <div className="space-y-2.5">
            <label className="flex items-center gap-3">
              <span className="min-w-0 flex-1 text-sm text-text-primary">Unit</span>
              <input
                type="text"
                placeholder={DEFAULT_UNIT}
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
                className="w-20 rounded-lg bg-bg-raised border border-bg-border px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <span className="w-16 shrink-0 text-xs text-text-secondary">spray, capsule…</span>
            </label>

            <LimitField
              label="Most in one go"
              suffix={`${unit}s`}
              value={maxPerIntake}
              onChange={setMaxPerIntake}
            />
            {/* Rolling, not per calendar day — the wording matters, because a
                calendar day quietly allows a late-night dose plus an
                early-morning one to count as two days' worth. */}
            <LimitField
              label="Most in 24 hours"
              suffix={`${unit}s`}
              value={maxPerDay}
              onChange={setMaxPerDay}
            />
            <LimitField
              label="Leave between doses"
              suffix="hours"
              value={minHoursBetween}
              onChange={setMinHoursBetween}
            />
            <LimitField
              label="Most days a month"
              suffix="days"
              value={maxDaysPerMonth}
              onChange={setMaxDaysPerMonth}
              placeholder={mohSuggestion(medClass)?.toString()}
            />
          </div>
        </section>
      ) : (
        /* A preventive's start date is what makes "did it work" answerable at
           all: migraine days a month before it against after, which is the
           ≥50% reduction every trial and every review appointment uses.
           Optional, and nothing else depends on it. */
        <section className="space-y-2 border-t border-bg-border pt-5">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wider font-medium text-text-secondary label-caps">Started</p>
            <p className="text-xs text-text-secondary">
              When you began taking it. Lets your migraine days a month before that date be compared with
              after — the usual way a preventive's effect is judged.
            </p>
          </div>
          <input
            type="date"
            value={startedOn}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setStartedOn(e.target.value)}
            className="w-full rounded-lg bg-bg-raised border border-bg-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </section>
      )}

      </div>

      {/* Save — flex-pinned above the home indicator, so it stays put however
          long the body gets. */}
      <div
        className="border-t border-bg-border bg-bg-surface px-4 sm:px-6 py-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => onSave(draft())}
          className="btn-primary w-full rounded-xl py-3 text-sm font-medium transition-colors disabled:opacity-40"
        >
          Save
        </button>
      </div>

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
