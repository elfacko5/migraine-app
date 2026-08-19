import { useState } from 'react';
import type { Attack, Medication } from '../types';
import { formatTime } from '../utils/format';
import { CHIP_ON, CHIP_OFF } from '../utils/chipStyles';
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
}

/** Units offered, not doses — the quick-pick was already 1/2/3. */
const QTY_OPTIONS = [1, 2, 3];

/** Does this free-text dose look like a unit count we can safely restate? */
const LOOKS_LIKE_UNITS = /^\d{1,2}\s*[a-z]+s?$/i;
const HAS_STRENGTH = /\d\s*(mg|mcg|µg|g|ml)\b/i;

export function MedicationInput({
  value, onChange, recentMeds = [], medications = [], attacks = [], atIso,
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
          <p className="text-xs uppercase tracking-wider font-medium text-text-secondary">My medications</p>
          <div className="flex flex-wrap gap-2">
            {recentMeds.map((med) => (
              <button
                key={med.name}
                type="button"
                onClick={() => pick(med)}
                aria-pressed={selected?.name === med.name}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  selected?.name === med.name ? CHIP_ON : CHIP_OFF
                }`}
              >
                <MedIcon name={med.name} dose={med.dose} className="h-4 w-4" />
                {med.name}{med.dose ? ` · ${med.dose}` : ''}
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
              className="flex-1 min-w-0 rounded-lg bg-bg-raised border border-bg-border px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <input
              type="text"
              aria-label="Dose or strength"
              placeholder="Dose / strength"
              value={value.dose}
              onChange={(e) => onChange({ ...value, dose: e.target.value })}
              className="w-32 rounded-lg bg-bg-raised border border-bg-border px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Collapsing clears what was typed: a value left behind a closed
              panel would be saved without being visible anywhere. */}
          {recentMeds.length > 0 && (
            <button
              type="button"
              onClick={() => { onChange({ name: '', dose: '' }); setCustomOpen(false); }}
              className="btn-tertiary rounded-lg py-1.5 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { onChange({ name: '', dose: '' }); setCustomOpen(true); }}
          className="btn-tertiary rounded-lg py-2 text-sm font-medium transition-colors"
        >
          + Add a different medication
        </button>
      )}

      {/* Quantity and the running position, for whichever drug is selected —
          outside the collapsible panel, since picking a chip collapses it and
          the number of units is a question either way. */}
      {value.name && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary shrink-0">Qty:</span>
            {QTY_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={units === n}
                onClick={() => setUnits(n)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  units === n ? CHIP_ON : CHIP_OFF
                }`}
              >
                {n} {n === 1 ? unit : `${unit}s`}
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
    </div>
  );
}
