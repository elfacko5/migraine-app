import type { Attack, Medication } from '../types';
import { useNowTick } from '../hooks/useNowTick';
import { migraineDaysByMonth, medicationDaysByMonth } from '../utils/stats';
import { formatTime } from '../utils/format';
import { medIcon } from '../utils/medDisplay';
import {
  checkDose, doseUnits, findMedication, lastDoseSnapshot, mohDaysFor, unitsInWindow,
} from '../utils/medGuardrails';

// What belongs under the hero card on Today: figures that need no
// interpretation, and one warning that has to arrive before it's too late to
// act on. Anything that needs reading rather than glancing stays on Insights.
interface Props {
  attacks: Attack[];
  ongoing: Attack | null;
  /** The library — for each drug's overuse reference point and its own
   *  per-intake / per-day / minimum-gap limits. */
  medications?: Medication[];
  /** Attack mode strips this down to what's actionable — see below. */
  attackMode?: boolean;
}

// Warn at 70% of whichever overuse reference point applies to *that* drug, not
// at it. The number is only useful while there's still room to change course;
// at 10 of 10 it's a fact about the past.
//
// The threshold is now per medication rather than a module constant: it used
// to be 70% of 10 for everything, because nothing knew a drug's class, so a
// simple analgesic was warned about five days early.
const warnAt = (threshold: number) => Math.ceil(threshold * 0.7);

// **The two medication rows are one shape.** They carry the same kind of
// content — a drug, a figure about it, and a line of supporting detail — and
// were drawn two different ways: one had the form icon and an emphasised name,
// the other had neither, so two adjacent cards saying comparable things looked
// like unrelated components. The only difference that means anything is that
// one of them is a warning, so that is the only difference left: an amber ring
// and tint. Everything else — the icon column, the name's weight, the figure
// on the headline, the detail underneath — is shared.
function MedRow({ name, icon, figure, detail, warning = false }: {
  name: string;
  icon: string;
  figure: string;
  detail?: string | null;
  warning?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-2 rounded-xl px-4 py-3 ${
        warning ? 'border border-severity-mid/40 bg-severity-mid/10' : 'bg-bg-surface'
      }`}
    >
      <span aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm text-text-primary">
          <span className="font-medium">{name}</span> {figure}
        </p>
        {detail && <p className="mt-0.5 text-xs text-text-secondary">{detail}</p>}
      </div>
    </div>
  );
}

// In attack mode the page keeps only what changes what you do in the next
// hour, which the dossier's "fewer elements per screen" asks for and which
// nothing else in the app has yet acted on (§8.3, and CLAUDE.md has recorded
// it as the spec's one unimplemented half). Concretely:
//
//   - **The two month tiles go.** Migraine days and medication days this
//     month are figures you read and think about; mid-attack there is nothing
//     to do with either, and they're the largest, brightest text on the page.
//     They are still on Insights, and attack mode is one tap to leave.
//   - **The overuse warning stays, minus its explanation.** It's the one
//     figure here that bears on a decision being made right now — whether to
//     take another dose — so removing it would be removing the one thing
//     worth the screen. Its second paragraph, three lines about ICHD
//     thresholds sustained over three months, is exactly the reading this
//     mode exists to avoid; the count and the drug name carry the point.
//   - **The last dose stays as-is.** One line, and it's the question people
//     actually open the app mid-attack to answer.
export function TodaySummary({ attacks, ongoing, medications = [], attackMode = false }: Props) {
  const months = migraineDaysByMonth(attacks, 1);
  const migraineDays = months[months.length - 1]?.days ?? 0;

  const meds = medicationDaysByMonth(attacks);
  const totalMedDays = meds.reduce((n, m) => Math.max(n, m.thisMonth), 0);
  const nearing = meds
    .map((m) => ({ ...m, threshold: mohDaysFor(m.name, medications) }))
    .filter((m) => m.thisMonth >= warnAt(m.threshold));

  // Mid-attack, the question is "when did I last take something" — the one
  // thing here that changes what you do in the next hour. It now carries the
  // running 24-hour total beside it, which is the same question asked one step
  // further on: not just when, but how much is already in.
  const lastDose = ongoing ? lastDoseSnapshot(ongoing) : null;
  const lastName = lastDose?.medication?.name ?? '';
  const lastLibrary = findMedication(medications, lastName);
  // The 24-hour figure is a rolling window, so it goes stale on its own as
  // doses age out of it — the same reason every live duration in the app ticks
  // rather than trusting the last render. Cheap here: Today already re-renders
  // on this cadence for the hero card's elapsed time. Both helpers read the
  // clock themselves, which is also what keeps `Date.now()` out of this render.
  useNowTick(60_000);
  const takenIn24h = lastDose ? unitsInWindow(attacks, lastName) : 0;
  // Asked with zero further units, so this reports where the *last* dose left
  // things rather than pre-judging a dose nobody has said they're taking.
  const position = lastDose ? checkDose(lastLibrary, attacks, lastName, 0) : null;

  if (migraineDays === 0 && meds.length === 0 && !lastDose) return null;
  // Attack mode drops everything but these two, so with neither of them there
  // is nothing left to draw — and an empty wrapper would still cost the gap
  // above it.
  if (attackMode && nearing.length === 0 && !lastDose) return null;

  return (
    <div className="space-y-3">
      {nearing.map((m) => (
        <MedRow
          key={m.name}
          name={m.name}
          icon={medIcon(m.name, '')}
          figure={`on ${m.thisMonth} days this month`}
          warning
          /* States the number and the guideline, and stops. Deciding what it
             means is a conversation with a doctor — and when the user entered
             a limit of their own, that is the number quoted back, not a
             guideline they didn't ask about. */
          detail={!attackMode
            ? `${findMedication(medications, m.name)?.maxDaysPerMonth
                ? `You entered a limit of ${m.threshold} days a month for this one.`
                : `Guidelines put medication-overuse headache at around ${m.threshold} days a month for this type of medication, sustained over three months.`
              } Worth raising at your next appointment.`
            : null}
        />
      ))}

      {lastDose?.medication && (
        <MedRow
          name={lastDose.medication.name}
          icon={medIcon(lastDose.medication.name, lastDose.medication.dose)}
          // "Treo at 20:51" reads as a label with a timestamp — it could as
          // easily mean a reminder due then, or when it was logged. The verb
          // is what makes it a statement about a dose that was taken, and it
          // stays in the line however much else joins it.
          figure={[
            lastLibrary?.maxPerDay ? `${takenIn24h} of ${lastLibrary.maxPerDay} in the last 24h` : null,
            `${takenIn24h > doseUnits(lastDose.medication) ? 'last taken' : 'taken'} at ${formatTime(lastDose.time)}`,
            // Leading separator: the warning row's figure continues its name
            // as a sentence ("Treo on 8 days this month"), where this one is a
            // list of facts about it.
          ].filter(Boolean).map((part) => `· ${part}`).join(' ')}
          // Only when a minimum gap was entered and it hasn't elapsed. A
          // statement of the user's own number, never an instruction.
          detail={position?.tooSoon && position.nextAllowedAt
            ? `Next dose from ${formatTime(position.nextAllowedAt)}, by the gap you entered.`
            : null}
        />
      )}

      {!attackMode && (
      <div className="grid grid-cols-2 gap-3">
        {/* **Both tiles are label = the subject, value = the unit and the
            period.** The left one used to label the *period* ("This month")
            and put the subject in the value ("9 migraine days"), so two tiles
            side by side were built the opposite way round from each other and
            neither could be read against the other. Now it's Migraine · 9 days
            this month, Medication · 5 days this month.

            "Migraine" rather than "Migraine days": the word "days" already
            follows in the value, and the pair still reads as *migraine days* —
            which is the term that has to survive, since the app counts migraine
            days and has no way to log a plain headache day (see
            MigraineDaysChart in CLAUDE.md).

            Figure and unit stay on one line. Three lines to a tile made each
            one taller than its content needed and put the unit far enough from
            the number to read as a separate fact. `items-baseline` so the 24px
            figure and the 12px unit sit on the same line rather than the unit
            floating mid-height, and the unit takes `whitespace-nowrap` so it
            wraps as a whole phrase if a larger text scale runs it out of
            room. */}
        <div className="rounded-xl bg-bg-surface px-4 py-3">
          <p className="text-[0.75rem] uppercase tracking-wider font-medium text-text-secondary">Migraine</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-text-primary">
            <span className="text-2xl font-bold leading-none">{migraineDays}</span>
            <span className="text-[0.75rem] whitespace-nowrap text-text-secondary">
              {migraineDays === 1 ? 'day' : 'days'} this month
            </span>
          </p>
        </div>
        <div className="rounded-xl bg-bg-surface px-4 py-3">
          <p className="text-[0.75rem] uppercase tracking-wider font-medium text-text-secondary">Medication</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-text-primary">
            <span className="text-2xl font-bold leading-none">{totalMedDays}</span>
            <span className="text-[0.75rem] whitespace-nowrap text-text-secondary">
              {totalMedDays === 1 ? 'day' : 'days'} this month
            </span>
          </p>
        </div>
      </div>
      )}
    </div>
  );
}
