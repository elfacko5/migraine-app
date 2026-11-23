import { useEffect, useRef, useState } from 'react';
import type { Attack, Medication } from '../types';
import { isoToLocalInput } from '../utils/format';
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

  // Case-insensitive throughout — "Sumatriptan" typed into the custom field
  // must find the chip already selected as "sumatriptan", not create a
  // second entry that silently doubles every dose at save time.
  const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const selectedFor = (name: string) => value.find((m) => sameName(m.name, name));

  function toggle(med: { name: string; dose: string }) {
    if (selectedFor(med.name)) onChange(value.filter((m) => !sameName(m.name, med.name)));
    else onChange([...value, { name: med.name, dose: med.dose, doses: [newDoseEntry()] }]);
  }

  function updateMed(name: string, patch: Partial<SelectedMedication>) {
    onChange(value.map((m) => (sameName(m.name, name) ? { ...m, ...patch } : m)));
  }

  // A unit-count label ("3 tablets") only ever described the one dose it was
  // derived from. Adding a second dose makes it describe both, which is
  // wrong the moment the two have different amounts — so it's cleared back
  // to blank rather than left stating a number that may no longer be true
  // of this dose. A typed strength ("50mg") is unaffected: that is a fact
  // about the drug, not about how many were taken. Same `keepText` test as
  // `setUnits` below — checking `LOOKS_LIKE_UNITS` alone would also match
  // "50mg" (digits then letters) and wipe a real strength.
  function addDoseTo(med: SelectedMedication): SelectedMedication {
    const text = med.dose.trim();
    const keepText = HAS_STRENGTH.test(text) || (text !== '' && !LOOKS_LIKE_UNITS.test(text));
    return { ...med, ...(keepText ? {} : { dose: '' }), doses: [...med.doses, newDoseEntry()] };
  }

  function addDose(name: string) {
    const med = selectedFor(name);
    if (med) onChange(value.map((m) => (sameName(m.name, name) ? addDoseTo(m) : m)));
  }

  // Back down to one dose, a label `addDoseTo` blanked for being ambiguous
  // is unambiguous again — restored from that one remaining dose's own
  // amount, the same rule `setUnits` uses when there's a single entry. Only
  // when `dose` is currently blank: a real strength was never blanked in
  // the first place, so there's nothing to restore for it.
  function removeDose(name: string, key: string) {
    const med = selectedFor(name);
    if (!med || med.doses.length <= 1) return;
    const remaining = med.doses.filter((d) => d.key !== key);
    const dose = !med.dose.trim() && remaining.length === 1
      ? unitsLabel(remaining[0].amount, findMedication(medications, name))
      : med.dose;
    updateMed(name, { dose, doses: remaining });
  }

  function updateDose(name: string, key: string, patch: Partial<DoseEntry>) {
    const med = selectedFor(name);
    if (med) updateMed(name, { doses: med.doses.map((d) => (d.key === key ? { ...d, ...patch } : d)) });
  }

  // Keeps `dose`'s free-text role intact — a strength like "50mg" is left
  // alone, since restating it as "2 tablets" would throw away the one fact
  // the field was holding. Same rule as MedicationInput's own setUnits.
  //
  // Both the dose-text rewrite and the amount change must land in one
  // `onChange` call: `updateMed`/`updateDose` each compute their next array
  // from this render's own `value`, so two separate calls in a row would
  // have the second overwrite the first rather than compose with it.
  //
  // The rewrite only happens with exactly one dose entry — `dose` is one
  // string shared by every dose of this medicine, so a unit-count label
  // derived from *this* dose's amount would misdescribe any other dose of
  // the same medicine that carries a different amount.
  function setUnits(name: string, doseKey: string, n: number) {
    const med = selectedFor(name);
    if (!med) return;
    const library = findMedication(medications, name);
    const text = med.dose.trim();
    const keepText = HAS_STRENGTH.test(text) || (text !== '' && !LOOKS_LIKE_UNITS.test(text));
    const rewriteDose = !keepText && med.doses.length === 1;
    onChange(value.map((m) => (!sameName(m.name, name) ? m : {
      ...m,
      ...(rewriteDose ? { dose: unitsLabel(n, library) } : {}),
      doses: m.doses.map((d) => (d.key === doseKey ? { ...d, amount: n } : d)),
    })));
  }

  // A typed name that matches a medicine already selected (a chip pick, or
  // an earlier custom add — any case) adds another dose to that one entry
  // instead of a second, duplicate entry for the same medicine: `value`
  // would otherwise hold it twice, and every dose would be saved twice.
  //
  // A dose/strength typed alongside that name is only adopted when there is
  // exactly one existing dose — `dose` is one string shared by every dose of
  // this medicine, so overwriting it once a second dose already exists would
  // silently restate that earlier dose's strength as whatever was just
  // typed for this one. With more than one existing dose, the typed text is
  // not applied (ambiguous: which dose would it even describe?), but nothing
  // already saved is corrupted — the same trade the ambiguity rule elsewhere
  // in this file makes. The adopted text still goes through `addDoseTo`'s
  // own keepText check, so a typed unit count ("2 tablets") is cleared the
  // same way it would be anywhere else, not adopted verbatim.
  function addCustom() {
    const name = customName.trim();
    if (!name) return;
    const dose = customDose.trim();
    const existing = selectedFor(name);
    if (existing) {
      const withDose = dose && existing.doses.length === 1 ? { ...existing, dose } : existing;
      onChange(value.map((m) => (m !== existing ? m : addDoseTo(withDose))));
    } else {
      const chip = recentMeds.find((m) => sameName(m.name, name));
      if (chip) onChange([...value, { name: chip.name, dose: dose || chip.dose, doses: [newDoseEntry()] }]);
      else onChange([...value, { name, dose, doses: [newDoseEntry()] }]);
    }
    setCustomName('');
    setCustomDose('');
    setCustomOpen(false);
  }

  // A custom-added medicine (typed into the name/dose fields below, never in
  // `recentMeds`) still needs its own expanded card — without this, picking
  // "+ Add a medication" would add it to `value` and then render nothing at
  // all, since the card used to live only inside the `recentMeds.map` loop.
  const customSelected = value.filter((m) => !recentMeds.some((r) => sameName(r.name, m.name)));

  // `recentMeds` can itself hold the same name twice under different
  // capitalisation (library vs. history). `selectedFor` is case-insensitive,
  // so without this, picking either chip would render *both* as the
  // selected card — two cards editing the one entry in `value`.
  const dedupedRecentMeds = recentMeds.filter(
    (m, i) => recentMeds.findIndex((r) => sameName(r.name, m.name)) === i,
  );

  return (
    <div className="space-y-3">
      {(recentMeds.length > 0 || customSelected.length > 0) && (
        <div className="space-y-2">
          <p id="my-meds-label" className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            My medications — pick any
          </p>
          <div className="flex flex-col gap-2.5" role="group" aria-labelledby="my-meds-label">
            {dedupedRecentMeds.map((med) => {
              const selected = selectedFor(med.name);
              const library = findMedication(medications, med.name);
              if (!selected) {
                return (
                  <button
                    key={med.name}
                    type="button"
                    onClick={() => toggle(med)}
                    aria-pressed={false}
                    className={`flex min-h-[3.625rem] w-full items-center gap-3 rounded-card px-4 py-2.5 text-left transition-colors ${chipClass(false)}`}
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
              className="tap-44-y btn-tertiary min-h-0 rounded-control py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              Add
            </button>
            {recentMeds.length > 0 && (
              <button
                type="button"
                onClick={() => { setCustomName(''); setCustomDose(''); setCustomOpen(false); }}
                className="tap-44-y btn-tertiary min-h-0 rounded-control py-1.5 text-sm font-medium transition-colors"
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
          className="tap-44-y btn-tertiary min-h-0 rounded-control py-2 text-sm font-medium transition-colors"
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
  const unit = library?.unitLabel?.trim() || DEFAULT_UNIT;
  return (
    <div className="overflow-hidden rounded-card bg-bg-surface ring-1 ring-inset ring-accent">
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
        <DoseLimitNote library={library} attacks={attacks} name={selected.name} doses={selected.doses} startMs={startMs} endMs={endMs} nowMs={nowMs} />
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

/**
 * The running-position note and limit warnings — same copy and rule as
 * `MedicationInput`'s. Never blocks a save; states the user's own number
 * and stops.
 *
 * **Per-intake is checked per dose entry, not against the sum.** Two
 * separate 1-tablet doses are two intakes, not one intake of two — summing
 * them before comparing to `maxPerIntake` would call a dose "too much in
 * one go" that was never taken in one go. The daily total and the 24h
 * count are legitimately a sum, since `maxPerDay` is about the whole day.
 *
 * **The minimum gap is checked two ways**: `checkDose`'s own `tooSoon`
 * against history, and — new here — between these dose entries themselves.
 * Two doses entered 30 minutes apart in this same step are exactly as
 * "too soon" as one against a logged dose; checking only against history
 * missed that entirely.
 */
function DoseLimitNote({ library, attacks, name, doses, startMs, endMs, nowMs }: {
  library: Medication | null;
  attacks: Attack[];
  name: string;
  doses: DoseEntry[];
  startMs: number;
  endMs: number | null;
  nowMs: number;
}) {
  const hasLimits = !!library && (!!library.maxPerIntake || !!library.maxPerDay || !!library.minHoursBetween);
  if (!hasLimits || !library) return null;

  const resolved = doses
    .map((d) => ({ ms: doseEntryMs(d, startMs, endMs, nowMs), amount: d.amount }))
    .sort((a, b) => a.ms - b.ms);
  const totalUnits = resolved.reduce((sum, d) => sum + d.amount, 0);
  const latestMs = resolved[resolved.length - 1].ms;
  // The daily total and the 24h count are about the aggregate, so a single
  // check at the latest time with the summed units is right for those.
  const check = checkDose(library, attacks, name, totalUnits, new Date(latestMs).toISOString());

  // Grouped by exact resolved time first: two entries deliberately left at
  // the same moment (both "When it started", or the same picked time) are
  // one intake, not two, and summing *those* against maxPerIntake is right
  // — it's only entries at genuinely different times that are separate
  // intakes and must be checked individually, never summed together.
  const intakeGroups = new Map<number, number>();
  for (const d of resolved) intakeGroups.set(d.ms, (intakeGroups.get(d.ms) ?? 0) + d.amount);
  const exceedsIntake = !!library.maxPerIntake
    && [...intakeGroups.values()].some((amount) => amount > library.maxPerIntake!);

  // The minimum gap is checked two ways, and *every* entry needs both:
  // each entry against already-logged history (checkDose's own tooSoon,
  // called per entry rather than once at the latest — a dose at 10:30 can
  // be too soon after a logged 10:00 dose even when a later entry at 16:00
  // isn't), and each entry against its immediate predecessor in this same
  // step. A zero gap between two entries is excluded — "Add another dose"
  // starts both at the same default time, and that's an unset time nobody
  // has differentiated yet, not a real zero-hour gap to warn about.
  let tooSoon = resolved.some(
    (d) => checkDose(library, attacks, name, d.amount, new Date(d.ms).toISOString()).tooSoon,
  );
  if (library.minHoursBetween && resolved.length > 1) {
    const minMs = library.minHoursBetween * 60 * 60 * 1000;
    for (let i = 1; i < resolved.length; i++) {
      const gap = resolved[i].ms - resolved[i - 1].ms;
      if (gap > 0 && gap < minMs) tooSoon = true;
    }
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-text-secondary">
        {library.maxPerDay
          ? `${check.unitsInWindow + totalUnits} of ${library.maxPerDay} in the last 24h`
          : `${check.unitsInWindow + totalUnits} in the last 24h`}
      </p>
      {exceedsIntake && library.maxPerIntake && (
        <p className="text-xs text-severity-mid">
          You entered a limit of {unitsLabel(library.maxPerIntake, library)} in one go.
        </p>
      )}
      {check.exceedsDaily && library.maxPerDay && (
        <p className="text-xs text-severity-mid">
          That would put you past the {unitsLabel(library.maxPerDay, library)} in 24 hours you entered.
        </p>
      )}
      {tooSoon && library.minHoursBetween && (
        <p className="text-xs text-severity-mid">
          You entered a {library.minHoursBetween}-hour gap between doses.
        </p>
      )}
      {(exceedsIntake || check.exceedsDaily || tooSoon) && (
        <p className="text-xs text-text-secondary">
          That's the limit you entered — worth checking it against your label or what your doctor told you.
        </p>
      )}
    </div>
  );
}
