import { useEffect, useRef, useState } from 'react';
import type { Attack, Medication } from '../types';
import { formatTime, isoToLocalInput } from '../utils/format';
import { chipClass } from '../utils/chipStyles';
import { RadioDot } from './RadioDot';
import { ChipCheck } from './ChipCheck';
import { DateTimeField, type DateTimeFieldHandle } from './DateTimeField';
import { DOSE_LABELS, doseOptions, effectiveDoseMode, type DoseMode } from '../utils/doseTime';
import { doseEntryMs, newDoseEntry, type DoseEntry, type SelectedMedication } from '../utils/doseEntries';
import { ClassBadge } from './ClassBadge';
import { classLetter } from '../utils/medClasses';
import {
  checkDose, findMedication, DEFAULT_UNIT, unitsLabel,
} from '../utils/medGuardrails';

export type { DoseEntry, SelectedMedication } from '../utils/doseEntries';

interface Props {
  value: SelectedMedication[];
  onChange: (next: SelectedMedication[]) => void;
  recentMeds?: Array<{ name: string; dose: string }>;
  medications?: Medication[];
  attacks?: Attack[];
  /** The attack's own window — bounds the dose-time presets, same as
   *  `MedicationInput`'s `doseTiming`. */
  startMs: number;
  endMs: number | null;
  nowMs: number;
}

const LOOKS_LIKE_UNITS = /^\d{1,2}\s*[a-z]+s?$/i;
const HAS_STRENGTH = /\d\s*(mg|mcg|µg|g|ml)\b/i;

/**
 * Pick-any medication entry: any number of medicines, and any number of
 * doses of one medicine, matching the v4 boards (Live23Med/MrgPastMed/
 * UpdMed). Replaces the single-radio `MedicationInput` for the rebuilt
 * logging flows — see `docs/redesign-v4-diff.md` and `doseEntries.ts`.
 */
export function MedicationEntry({
  value, onChange, recentMeds = [], medications = [], attacks = [], startMs, endMs, nowMs,
}: Props) {
  const [customOpen, setCustomOpen] = useState(() => recentMeds.length === 0);
  const [customName, setCustomName] = useState('');
  const [customDose, setCustomDose] = useState('');
  const options = doseOptions(startMs, endMs, nowMs);

  const selectedFor = (name: string) => value.find((m) => m.name === name);

  function toggle(med: { name: string; dose: string }) {
    if (selectedFor(med.name)) onChange(value.filter((m) => m.name !== med.name));
    else onChange([...value, { name: med.name, dose: med.dose, doses: [newDoseEntry()] }]);
  }

  function updateMed(name: string, patch: Partial<SelectedMedication>) {
    onChange(value.map((m) => (m.name === name ? { ...m, ...patch } : m)));
  }

  function addDose(name: string) {
    const med = selectedFor(name);
    if (med) updateMed(name, { doses: [...med.doses, newDoseEntry()] });
  }

  function removeDose(name: string, key: string) {
    const med = selectedFor(name);
    if (med && med.doses.length > 1) updateMed(name, { doses: med.doses.filter((d) => d.key !== key) });
  }

  function updateDose(name: string, key: string, patch: Partial<DoseEntry>) {
    const med = selectedFor(name);
    if (med) updateMed(name, { doses: med.doses.map((d) => (d.key === key ? { ...d, ...patch } : d)) });
  }

  // Keeps `dose`'s free-text role intact — a strength like "50mg" is left
  // alone, since restating it as "2 tablets" would throw away the one fact
  // the field was holding. Same rule as MedicationInput's own setUnits.
  function setUnits(name: string, doseKey: string, n: number) {
    const med = selectedFor(name);
    if (!med) return;
    const library = findMedication(medications, name);
    const text = med.dose.trim();
    const keepText = HAS_STRENGTH.test(text) || (text !== '' && !LOOKS_LIKE_UNITS.test(text));
    if (!keepText) updateMed(name, { dose: unitsLabel(n, library) });
    updateDose(name, doseKey, { amount: n });
  }

  function addCustom() {
    const name = customName.trim();
    if (!name) return;
    onChange([...value, { name, dose: customDose.trim(), doses: [newDoseEntry()] }]);
    setCustomName('');
    setCustomDose('');
    setCustomOpen(false);
  }

  // A custom-added medicine (typed into the name/dose fields below, never in
  // `recentMeds`) still needs its own expanded card — without this, picking
  // "+ Add a medication" would add it to `value` and then render nothing at
  // all, since the card used to live only inside the `recentMeds.map` loop.
  const customSelected = value.filter((m) => !recentMeds.some((r) => r.name === m.name));

  return (
    <div className="space-y-3">
      {(recentMeds.length > 0 || customSelected.length > 0) && (
        <div className="space-y-2">
          <p id="my-meds-label" className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            My medications — pick any
          </p>
          <div className="flex flex-col gap-2.5" role="group" aria-labelledby="my-meds-label">
            {recentMeds.map((med) => {
              const selected = selectedFor(med.name);
              const library = findMedication(medications, med.name);
              if (!selected) {
                return (
                  <button
                    key={med.name}
                    type="button"
                    onClick={() => toggle(med)}
                    aria-pressed={false}
                    className={`flex min-h-[3.625rem] w-full items-center gap-3 rounded-group px-4 py-2.5 text-left transition-colors ${chipClass(false)}`}
                  >
                    <ClassBadge small>{classLetter(library?.class) ?? '–'}</ClassBadge>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-medium text-text-primary">{med.name}</span>
                      {med.dose && <span className="block text-sm text-text-secondary">{med.dose}</span>}
                    </span>
                  </button>
                );
              }
              return (
                <MedicineCard
                  key={med.name}
                  selected={selected}
                  library={library}
                  attacks={attacks}
                  options={options}
                  startMs={startMs}
                  endMs={endMs}
                  nowMs={nowMs}
                  onDeselect={() => toggle(med)}
                  onAddDose={() => addDose(selected.name)}
                  onUnits={(key, n) => setUnits(selected.name, key, n)}
                  onMode={(key, m, prevMode, time) => updateDose(selected.name, key, {
                    mode: m,
                    time: m === 'manual' && prevMode !== 'manual' ? isoToLocalInput(new Date(startMs).toISOString()) : time,
                  })}
                  onTime={(key, t) => updateDose(selected.name, key, { time: t })}
                  onRemoveDose={(key) => removeDose(selected.name, key)}
                />
              );
            })}
            {customSelected.map((selected) => {
              const library = findMedication(medications, selected.name);
              return (
                <MedicineCard
                  key={selected.name}
                  selected={selected}
                  library={library}
                  attacks={attacks}
                  options={options}
                  startMs={startMs}
                  endMs={endMs}
                  nowMs={nowMs}
                  onDeselect={() => onChange(value.filter((m) => m.name !== selected.name))}
                  onAddDose={() => addDose(selected.name)}
                  onUnits={(key, n) => setUnits(selected.name, key, n)}
                  onMode={(key, m, prevMode, time) => updateDose(selected.name, key, {
                    mode: m,
                    time: m === 'manual' && prevMode !== 'manual' ? isoToLocalInput(new Date(startMs).toISOString()) : time,
                  })}
                  onTime={(key, t) => updateDose(selected.name, key, { time: t })}
                  onRemoveDose={(key) => removeDose(selected.name, key)}
                />
              );
            })}
          </div>
        </div>
      )}

      {customOpen ? (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              aria-label="Medication name"
              placeholder="Medication name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="flex-1 min-w-0 rounded-field bg-bg-raised border border-border-control px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <input
              type="text"
              aria-label="Dose or strength"
              placeholder="Dose / strength"
              value={customDose}
              onChange={(e) => setCustomDose(e.target.value)}
              className="w-32 rounded-field bg-bg-raised border border-border-control px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addCustom}
              disabled={!customName.trim()}
              className="tap-44-y btn-tertiary min-h-0 rounded-control-sm py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              Add
            </button>
            {recentMeds.length > 0 && (
              <button
                type="button"
                onClick={() => { setCustomName(''); setCustomDose(''); setCustomOpen(false); }}
                className="tap-44-y btn-tertiary min-h-0 rounded-control-sm py-1.5 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCustomOpen(true)}
          className="tap-44-y btn-tertiary min-h-0 rounded-control-sm py-2 text-sm font-medium transition-colors"
        >
          + Add a medication
        </button>
      )}
    </div>
  );
}

/**
 * One selected medicine's expanded card: header with its name/dose and a
 * deselect action, then one `DoseRow` per dose entry, the limit note, and
 * "+ Add another dose". Shared by a `recentMeds` pick and a custom-typed
 * medicine alike — the two differ only in how they got into `value` and how
 * removal is wired, never in what the card itself looks like.
 */
function MedicineCard({ selected, library, attacks, options, startMs, endMs, nowMs, onDeselect, onAddDose, onUnits, onMode, onTime, onRemoveDose }: {
  selected: SelectedMedication;
  library: Medication | null;
  attacks: Attack[];
  options: DoseMode[];
  startMs: number;
  endMs: number | null;
  nowMs: number;
  onDeselect: () => void;
  onAddDose: () => void;
  onUnits: (key: string, n: number) => void;
  onMode: (key: string, mode: DoseMode, prevMode: DoseMode, time: string) => void;
  onTime: (key: string, t: string) => void;
  onRemoveDose: (key: string) => void;
}) {
  const totalUnits = selected.doses.reduce((sum, d) => sum + d.amount, 0);
  const latestMs = Math.max(...selected.doses.map((d) => doseEntryMs(d, startMs, endMs, nowMs)));
  const unit = library?.unitLabel?.trim() || DEFAULT_UNIT;
  return (
    <div className="overflow-hidden rounded-group bg-bg-surface ring-1 ring-inset ring-accent">
      <button type="button" onClick={onDeselect} aria-pressed className="flex min-h-[3.625rem] w-full items-center gap-3 px-4 py-2.5 text-left">
        <ClassBadge small>{classLetter(library?.class) ?? '–'}</ClassBadge>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-medium text-text-primary">{selected.name}</span>
          {selected.dose && <span className="block text-sm text-text-secondary">{selected.dose}</span>}
        </span>
        <ChipCheck selected />
      </button>
      <div className="space-y-3 border-t border-bg-border px-4 py-3">
        {selected.doses.map((d, i) => (
          <DoseRow
            key={d.key}
            entry={d}
            removable={i > 0}
            unit={unit}
            options={options}
            startMs={startMs}
            endMs={endMs}
            nowMs={nowMs}
            onUnits={(n) => onUnits(d.key, n)}
            onMode={(m) => onMode(d.key, m, d.mode, d.time)}
            onTime={(t) => onTime(d.key, t)}
            onRemove={() => onRemoveDose(d.key)}
          />
        ))}
        <DoseLimitNote library={library} attacks={attacks} name={selected.name} totalUnits={totalUnits} atIso={new Date(latestMs).toISOString()} />
        <button type="button" onClick={onAddDose} className="tap-44-y min-h-0 py-1.5 text-sm font-medium text-accent-light transition-colors hover:text-accent">
          + Add another dose
        </button>
      </div>
    </div>
  );
}

/** One dose's quantity + time, inside a selected medicine's card. */
function DoseRow({ entry, removable, unit, options, startMs, endMs, nowMs, onUnits, onMode, onTime, onRemove }: {
  entry: DoseEntry;
  removable: boolean;
  unit: string;
  options: DoseMode[];
  startMs: number;
  endMs: number | null;
  nowMs: number;
  onUnits: (n: number) => void;
  onMode: (m: DoseMode) => void;
  onTime: (t: string) => void;
  onRemove: () => void;
}) {
  const mode = effectiveDoseMode(entry.mode, options);
  const openRef = useRef<DateTimeFieldHandle>(null);

  useEffect(() => {
    if (entry.mode === 'manual') openRef.current?.open();
  }, [entry.mode]);

  return (
    <div className="space-y-2.5 rounded-control bg-bg-raised p-3">
      <div className="flex items-center gap-3">
        <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-text-secondary">How much</span>
        <button
          type="button"
          onClick={() => onUnits(Math.max(1, entry.amount - 1))}
          aria-label="One fewer"
          className="tap-44 flex size-compact items-center justify-center rounded-full bg-bg-base text-lg text-text-primary ring-1 ring-inset ring-border-control"
        >
          −
        </button>
        <span className="min-w-[4.5rem] text-center text-base font-semibold tabular-nums text-text-primary">
          {entry.amount} {entry.amount === 1 ? unit : `${unit}s`}
        </span>
        <button
          type="button"
          onClick={() => onUnits(entry.amount + 1)}
          aria-label="One more"
          className="tap-44 flex size-compact items-center justify-center rounded-full bg-bg-base text-lg text-text-primary ring-1 ring-inset ring-border-control"
        >
          +
        </button>
      </div>
      <div className="space-y-1.5">
        <p id={`dose-time-${entry.key}`} className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          When did you take it?
        </p>
        <div role="radiogroup" aria-labelledby={`dose-time-${entry.key}`} className="flex flex-wrap gap-2">
          {options.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => onMode(m)}
              className={`tap-44-y inline-flex items-center gap-1.5 rounded-chip px-3 py-1.5 text-sm font-medium transition-colors ${chipClass(mode === m)}`}
            >
              <RadioDot selected={mode === m} />
              {DOSE_LABELS[m]}
            </button>
          ))}
        </div>
        {mode === 'manual' && (
          <DateTimeField
            label="Dose time"
            value={entry.time}
            min={isoToLocalInput(new Date(startMs).toISOString())}
            max={isoToLocalInput(new Date(endMs ?? nowMs).toISOString())}
            onChange={onTime}
            surface="raised"
            openRef={openRef}
          />
        )}
      </div>
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          className="tap-44-y min-h-0 py-1 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          Remove this dose
        </button>
      )}
    </div>
  );
}

/** The running-position note and limit warnings — same copy and rule as
 *  `MedicationInput`'s, checked against the sum of every dose entry for this
 *  medicine rather than one. Never blocks a save; states the user's own
 *  number and stops. */
function DoseLimitNote({ library, attacks, name, totalUnits, atIso }: {
  library: Medication | null;
  attacks: Attack[];
  name: string;
  totalUnits: number;
  atIso: string;
}) {
  const hasLimits = !!library && (!!library.maxPerIntake || !!library.maxPerDay || !!library.minHoursBetween);
  if (!hasLimits || !library) return null;
  const check = checkDose(library, attacks, name, totalUnits, atIso);
  return (
    <div className="space-y-1">
      <p className="text-xs text-text-secondary">
        {library.maxPerDay
          ? `${check.unitsInWindow + totalUnits} of ${library.maxPerDay} in the last 24h`
          : `${check.unitsInWindow + totalUnits} in the last 24h`}
      </p>
      {check.exceedsIntake && library.maxPerIntake && (
        <p className="text-xs text-severity-mid">
          You entered a limit of {unitsLabel(library.maxPerIntake, library)} in one go.
        </p>
      )}
      {check.exceedsDaily && library.maxPerDay && (
        <p className="text-xs text-severity-mid">
          That would put you past the {unitsLabel(library.maxPerDay, library)} in 24 hours you entered.
        </p>
      )}
      {check.tooSoon && check.nextAllowedAt && library.minHoursBetween && (
        <p className="text-xs text-severity-mid">
          You entered a {library.minHoursBetween}-hour gap between doses — the next one falls at{' '}
          {formatTime(check.nextAllowedAt)}.
        </p>
      )}
      {(check.exceedsIntake || check.exceedsDaily || check.tooSoon) && (
        <p className="text-xs text-text-secondary">
          That's the limit you entered — worth checking it against your label or what your doctor told you.
        </p>
      )}
    </div>
  );
}
