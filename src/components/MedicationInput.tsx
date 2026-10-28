import { useEffect, useRef, useState } from 'react';
import type { Attack, Medication } from '../types';
import { formatTime, isoToLocalInput } from '../utils/format';
import { CHIP_ON, CHIP_OFF} from '../utils/chipStyles';
import { RadioDot } from './RadioDot';
import { DateTimeField, type DateTimeFieldHandle } from './DateTimeField';
import { DOSE_LABELS, doseOptions, effectiveDoseMode, type DoseMode } from '../utils/doseTime';
import { MedIcon } from './drawnIcons';
import {
  checkDose, doseUnits, findMedication, DEFAULT_UNIT, unitsLabel,
} from '../utils/medGuardrails';

interface Value { name: string; dose: string; amount?: number }

interface Props {
  value: Value;
  onChange: (next: Value) => void;
  recentMeds?: Array<{ name: string; dose: string }>;
  /** The library, for whichever limits this drug has. */
  medications?: Medication[];
  /** Every attack — the only record of medication there is. */
  attacks?: Attack[];
  /** When this dose is being recorded, which is the wizard's own time picker
   *  and not necessarily now: a backfilled reading counts in *its* 24 hours. */
  atIso?: string;
  /** The dose-time card — the new-attack wizard only. `QuickUpdateForm` has
   *  its own update-time step, and a dose there is taken at that time. */
  doseTiming?: DoseTiming;
}

export interface DoseTiming {
  mode: DoseMode;
  /** Local-input form, for "Pick a time". */
  time: string;
  onMode: (m: DoseMode) => void;
  onTime: (t: string) => void;
  /** The attack's own resolved start, and its end (null while ongoing) —
   *  the window a dose has to fall in. */
  startMs: number;
  endMs: number | null;
  /** When the sheet opened, so the presets aren't measured against a clock
   *  read during render. */
  nowMs: number;
}

/** Units offered, not doses — the quick-pick was already 1/2/3. */
const QTY_OPTIONS = [1, 2, 3];

/** Does this free-text dose look like a unit count we can safely restate? */
const LOOKS_LIKE_UNITS = /^\d{1,2}\s*[a-z]+s?$/i;
const HAS_STRENGTH = /\d\s*(mg|mcg|µg|g|ml)\b/i;

export function MedicationInput({
  value, onChange, recentMeds = [], medications = [], attacks = [], atIso, doseTiming,
}: Props) {
  const selected = recentMeds.find((m) => m.name === value.name);
  const library = findMedication(medications, value.name);
  const unit = library?.unitLabel?.trim() || DEFAULT_UNIT;

  // The dose about to be recorded, and where it sits against this drug's own
  // limits. Only shown when the user has entered limits for it — a medication
  // with none behaves exactly as it did before any of this existed.
  const units = doseUnits(value);
  const hasLimits =
    !!library && (!!library.maxPerIntake || !!library.maxPerDay || !!library.minHoursBetween);
  // `atIso` is optional all the way down — checkDose reads the clock itself
  // when the caller has no reading time of its own.
  const check = hasLimits ? checkDose(library, attacks, value.name, units, atIso) : null;

  // Sets the number of units. `dose` keeps its own meaning: a strength like
  // "50mg" is left alone, since restating it as "2 tablets" would throw away
  // the one fact the field was holding.
  function setUnits(n: number) {
    const text = value.dose.trim();
    const keepText = HAS_STRENGTH.test(text) || (text !== '' && !LOOKS_LIKE_UNITS.test(text));
    onChange({
      ...value,
      amount: n,
      dose: keepText ? value.dose : unitsLabel(n, library),
    });
  }

  // Typing is the exception now that the library exists, so the free-text
  // fields start collapsed behind a ghost button. Two cases open them at
  // mount instead: nothing to pick from (a first log, where a ghost button
  // would be the only control on the step and hide the only way forward),
  // and a value that came from elsewhere — a voice draft naming a drug
  // that isn't in the list — which must stay visible and correctable.
  const [customOpen, setCustomOpen] = useState(
    () => recentMeds.length === 0 || (!!value.name && !recentMeds.some((m) => m.name === value.name))
  );

  function pick(med: Value) {
    // Tapping the selected chip again clears it — with the inputs collapsed
    // it would otherwise be the one choice on this step that can't be undone.
    if (selected?.name === med.name) onChange({ name: '', dose: '' });
    else onChange({ name: med.name, dose: med.dose });
    setCustomOpen(false);
  }

  return (
    <div className="space-y-3">
      {recentMeds.length > 0 && (
        <div className="space-y-1.5">
          <p id="my-meds-label" className="text-xs uppercase tracking-wider font-medium text-text-secondary">My medications</p>
          {/* **One medication per reading, so a radio group** (2026-10-28).
              It was `aria-pressed` with `ChipCheck` — the multi-select
              pattern symptoms and reliefs use — for a choice that is in fact
              single (`selected?.name === med.name`). Tapping the selected chip
              still clears it, which a native radio can't do; that is the one
              way back to "nothing taken" with the inputs collapsed. */}
          <div role="radiogroup" aria-labelledby="my-meds-label" className="flex flex-wrap gap-2">
            {recentMeds.map((med) => (
              <button
                key={med.name}
                type="button"
                role="radio"
                onClick={() => pick(med)}
                aria-checked={selected?.name === med.name}
                className={`flex items-center gap-1.5 rounded-chip px-3 py-2 text-sm font-medium transition-colors ${
                  selected?.name === med.name ? CHIP_ON : CHIP_OFF
                }`}
              >
                <MedIcon name={med.name} dose={med.dose} className="h-4 w-4" />
                {med.name}{med.dose ? ` · ${med.dose}` : ''}
                <RadioDot selected={selected?.name === med.name} />
              </button>
            ))}
          </div>
        </div>
      )}

      {customOpen ? (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              // Placeholders are not accessible names — they vanish the moment
              // you type. Every free-text field here carries its own.
              aria-label="Medication name"
              placeholder="Medication name"
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              className="flex-1 min-w-0 rounded-field bg-bg-raised border border-border-control px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <input
              type="text"
              aria-label="Dose or strength"
              placeholder="Dose / strength"
              value={value.dose}
              onChange={(e) => onChange({ ...value, dose: e.target.value })}
              className="w-32 rounded-field bg-bg-raised border border-border-control px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Collapsing clears what was typed: a value left behind a closed
              panel would be saved without being visible anywhere. */}
          {recentMeds.length > 0 && (
            <button
              type="button"
              onClick={() => { onChange({ name: '', dose: '' }); setCustomOpen(false); }}
              className="btn-tertiary rounded-control-sm py-1.5 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { onChange({ name: '', dose: '' }); setCustomOpen(true); }}
          className="btn-tertiary rounded-control-sm py-2 text-sm font-medium transition-colors"
        >
          + Add a different medication
        </button>
      )}

      {/* Quantity and the running position, for whichever drug is selected —
          outside the collapsible panel, since picking a chip collapses it and
          the number of units is a question either way. */}
      {value.name && (
        <div className="space-y-2">
          <div role="radiogroup" aria-label="Quantity" className="flex items-center gap-2">
            <span className="text-xs text-text-secondary shrink-0" aria-hidden="true">Qty:</span>
            {QTY_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={units === n}
                onClick={() => setUnits(n)}
                className={`inline-flex items-center gap-1 rounded-segment px-2.5 py-1 text-xs font-medium transition-colors ${
                  units === n ? CHIP_ON : CHIP_OFF
                }`}
              >
                {n} {n === 1 ? unit : `${unit}s`}
                <RadioDot selected={units === n} />
              </button>
            ))}
          </div>

          {/* Only when limits were entered for this drug. The wording states
              the count and the user's own number and stops there — it is
              never an instruction, and it never blocks the save: if four
              tablets were taken, the diary has to be able to say four. */}
          {check && (
            <div className="space-y-1">
              <p className="text-xs text-text-secondary">
                {library?.maxPerDay
                  ? `${check.unitsInWindow + units} of ${library.maxPerDay} in the last 24h`
                  : `${check.unitsInWindow + units} in the last 24h`}
              </p>
              {check.exceedsIntake && library?.maxPerIntake && (
                <p className="text-xs text-severity-mid">
                  You entered a limit of {unitsLabel(library.maxPerIntake, library)} in one go.
                </p>
              )}
              {check.exceedsDaily && library?.maxPerDay && (
                <p className="text-xs text-severity-mid">
                  That would put you past the {unitsLabel(library.maxPerDay, library)} in 24 hours you entered.
                </p>
              )}
              {check.tooSoon && check.nextAllowedAt && library?.minHoursBetween && (
                <p className="text-xs text-severity-mid">
                  You entered a {library.minHoursBetween}-hour gap between doses — the next one falls at{' '}
                  {formatTime(check.nextAllowedAt)}.
                </p>
              )}
              {/* **Points at the number, not at the dose.** A breach is far
                  more often a limit typed wrong than a limit crossed, and the
                  figure is only ever the user's own — so the useful thing to
                  say is "check what you entered", which is about data entry.
                  Anything about spacing or skipping the dose would be dosing
                  advice, which this app does not give: it counts, states your
                  own reference points, and stops. Same register as the overuse
                  warning's "worth raising at your next appointment".
                  
                  Once per block, not under each note — all three can fire at
                  the same time, and three copies of it would be nagging. */}
              {(check.exceedsIntake || check.exceedsDaily || check.tooSoon) && (
                <p className="text-xs text-text-secondary">
                  That's the limit you entered — worth checking it against your label or what your doctor
                  told you.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {value.name && doseTiming && <DoseTimeCard timing={doseTiming} />}
    </div>
  );
}

/**
 * "When did you take it?" — Flow 1's dose-time card (2026-10-28). Shown once a
 * medication is picked. Anything but the attack's own start becomes a separate
 * reading at that time (see `utils/doseTime.ts`), which is what moves the
 * two-hour check-in: `medCheckInDelay` measures from the latest dose reading.
 *
 * Presets outside the attack are left out rather than disabled: a dose can't
 * precede the attack it treats, and a greyed "1h ago" on an attack that began
 * 20 minutes ago would only invite the question of why.
 */
function DoseTimeCard({ timing }: { timing: DoseTiming }) {
  const { startMs, endMs, nowMs } = timing;
  const options = doseOptions(startMs, endMs, nowMs);
  const mode = effectiveDoseMode(timing.mode, options);
  const openRef = useRef<DateTimeFieldHandle>(null);

  // Same as the wizard's own "Pick a time": open the picker on the tap that
  // revealed it.
  useEffect(() => {
    if (timing.mode === 'manual') openRef.current?.open();
  }, [timing.mode]);

  return (
    <div className="rounded-inset border border-bg-border bg-bg-raised p-4 space-y-3">
      <p id="dose-time-label" className="text-sm font-medium text-text-primary">When did you take it?</p>
      <div role="radiogroup" aria-labelledby="dose-time-label" className="flex flex-wrap gap-2">
        {options.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => timing.onMode(m)}
            className={`inline-flex items-center gap-1.5 rounded-chip px-3 py-2 text-sm font-medium transition-colors ${
              mode === m ? CHIP_ON : CHIP_OFF
            }`}
          >
            <RadioDot selected={mode === m} />
            {DOSE_LABELS[m]}
          </button>
        ))}
      </div>
      {mode === 'manual' && (
        <DateTimeField
          label="Dose time"
          value={timing.time}
          min={isoToLocalInput(new Date(startMs).toISOString())}
          max={isoToLocalInput(new Date(endMs ?? nowMs).toISOString())}
          onChange={timing.onTime}
          surface="raised"
          openRef={openRef}
        />
      )}
      {/* A fact about what the app will do, not about the dose. Only while
          the attack is ongoing — a past one has no check-in to move. */}
      {endMs === null && (
        <p className="text-xs text-text-secondary">With reminders on, the check-in is timed from this.</p>
      )}
    </div>
  );
}
