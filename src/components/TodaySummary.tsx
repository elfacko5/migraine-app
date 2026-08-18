import type { Attack } from '../types';
import {
  migraineDaysByMonth, medicationDaysByMonth,
  MOH_DAYS_TRIPTAN,
} from '../utils/stats';
import { formatTime } from '../utils/format';
import { medIcon } from '../utils/medDisplay';

// What belongs under the hero card on Today: figures that need no
// interpretation, and one warning that has to arrive before it's too late to
// act on. Anything that needs reading rather than glancing stays on Insights.
interface Props {
  attacks: Attack[];
  ongoing: Attack | null;
  /** Attack mode strips this down to what's actionable — see below. */
  attackMode?: boolean;
}

// Warn at 70% of the lower overuse reference point, not at it. The number is
// only useful while there's still room to change course; at 10 of 10 it's a
// fact about the past.
const WARN_AT = Math.ceil(MOH_DAYS_TRIPTAN * 0.7);

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
export function TodaySummary({ attacks, ongoing, attackMode = false }: Props) {
  const months = migraineDaysByMonth(attacks, 1);
  const migraineDays = months[months.length - 1]?.days ?? 0;

  const meds = medicationDaysByMonth(attacks);
  const totalMedDays = meds.reduce((n, m) => Math.max(n, m.thisMonth), 0);
  const nearing = meds.filter((m) => m.thisMonth >= WARN_AT);

  // Mid-attack, the question is "when did I last take something" — the one
  // thing here that changes what you do in the next hour.
  const lastDose = ongoing
    ? [...ongoing.snapshots].reverse().find((s) => s.medication?.name)
    : null;

  if (migraineDays === 0 && meds.length === 0 && !lastDose) return null;
  // Attack mode drops everything but these two, so with neither of them there
  // is nothing left to draw — and an empty wrapper would still cost the gap
  // above it.
  if (attackMode && nearing.length === 0 && !lastDose) return null;

  return (
    <div className="space-y-3">
      {nearing.map((m) => (
        <div
          key={m.name}
          className="rounded-xl border border-severity-mid/40 bg-severity-mid/10 px-4 py-3"
        >
          <p className="text-sm text-text-primary">
            <span className="font-medium">{m.name}</span> on {m.thisMonth} days this month
          </p>
          {/* States the number and the guideline, and stops. Deciding what it
              means is a conversation with a doctor. */}
          {!attackMode && (
            <p className="mt-0.5 text-xs text-text-secondary">
              Guidelines put medication-overuse headache at around {MOH_DAYS_TRIPTAN} days a month for
              triptans, sustained over three months. Worth raising at your next appointment.
            </p>
          )}
        </div>
      ))}

      {lastDose?.medication && (
        <div className="flex items-center gap-2 rounded-xl bg-bg-surface px-4 py-3">
          <span aria-hidden="true">{medIcon(lastDose.medication.name, lastDose.medication.dose)}</span>
          {/* "Treo at 20:51" reads as a label with a timestamp — it could as
              easily mean a reminder due then, or when it was logged. The verb
              is what makes it a statement about a dose that was taken. */}
          <p className="text-sm text-text-primary">
            {lastDose.medication.name} taken at {formatTime(lastDose.time)}
          </p>
        </div>
      )}

      {!attackMode && (
      <div className="grid grid-cols-2 gap-3">
        {/* Figure and unit on one line. Three lines to a tile made each one
            taller than its content needed and put the unit far enough from
            the number to read as a separate fact; "8 migraine days" is the
            sentence anyone says out loud. `items-baseline` so the 24px figure
            and the 12px unit sit on the same line rather than the unit
            floating mid-height, and the unit takes `whitespace-nowrap` so it
            wraps as a whole phrase if a larger text scale runs it out of
            room. */}
        <div className="rounded-xl bg-bg-surface px-4 py-3">
          <p className="text-[0.75rem] uppercase tracking-wider font-medium text-text-secondary">This month</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-text-primary">
            <span className="text-2xl font-bold leading-none">{migraineDays}</span>
            <span className="text-[0.75rem] whitespace-nowrap text-text-secondary">migraine days</span>
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
