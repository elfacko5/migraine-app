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
}

// Warn at 70% of the lower overuse reference point, not at it. The number is
// only useful while there's still room to change course; at 10 of 10 it's a
// fact about the past.
const WARN_AT = Math.ceil(MOH_DAYS_TRIPTAN * 0.7);

export function TodaySummary({ attacks, ongoing }: Props) {
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
          <p className="mt-0.5 text-xs text-text-secondary">
            Guidelines put medication-overuse headache at around {MOH_DAYS_TRIPTAN} days a month for
            triptans, sustained over three months. Worth raising at your next appointment.
          </p>
        </div>
      ))}

      {lastDose?.medication && (
        <div className="flex items-center gap-2 rounded-xl bg-bg-surface px-4 py-3">
          <span aria-hidden="true">{medIcon(lastDose.medication.name, lastDose.medication.dose)}</span>
          <p className="text-sm text-text-primary">
            {lastDose.medication.name} at {formatTime(lastDose.time)}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-bg-surface px-4 py-3">
          <p className="text-[0.75rem] uppercase tracking-wider font-medium text-text-secondary">This month</p>
          <p className="mt-1 text-2xl font-bold leading-none text-text-primary">{migraineDays}</p>
          <p className="mt-0.5 text-[0.75rem] text-text-secondary">migraine days</p>
        </div>
        <div className="rounded-xl bg-bg-surface px-4 py-3">
          <p className="text-[0.75rem] uppercase tracking-wider font-medium text-text-secondary">Medication</p>
          <p className="mt-1 text-2xl font-bold leading-none text-text-primary">{totalMedDays}</p>
          <p className="mt-0.5 text-[0.75rem] text-text-secondary">
            {totalMedDays === 1 ? 'day' : 'days'} this month
          </p>
        </div>
      </div>
    </div>
  );
}
