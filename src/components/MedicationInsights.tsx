import type { Attack } from '../types';
import {
  medicationDaysByMonth, medicationResponse,
  MOH_DAYS_TRIPTAN, MOH_DAYS_SIMPLE,
} from '../utils/stats';
import { medIcon } from '../utils/medDisplay';

// Two questions a clinician asks about medication, and neither of them is
// "how many doses". How many *days a month* is it being taken — the unit
// every overuse threshold is stated in — and does it work.
interface Props { attacks: Attack[] }

export function MedicationInsights({ attacks }: Props) {
  const days = medicationDaysByMonth(attacks);
  const response = medicationResponse(attacks);
  if (days.length === 0) return null;

  const byName = new Map(response.map((r) => [r.name, r]));

  return (
    <section className="space-y-2">
      <h3 className="text-xs uppercase tracking-wider font-medium text-text-secondary">Medication this month</h3>

      <div className="space-y-3 rounded-xl bg-bg-raised px-3 py-3">
        {days.map((med) => {
          const r = byName.get(med.name);
          // Marked against the lower of the two guideline numbers, because
          // the app doesn't yet know which class a medication belongs to.
          const nearing = med.thisMonth >= MOH_DAYS_TRIPTAN;
          return (
            <div key={med.name} className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span aria-hidden="true">{medIcon(med.name, '')}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{med.name}</span>
                <span className={`text-sm tabular-nums ${nearing ? 'text-severity-high' : 'text-text-primary'}`}>
                  {med.thisMonth}
                </span>
                <span className="text-xs text-text-secondary">
                  {med.thisMonth === 1 ? 'day' : 'days'}
                </span>
              </div>

              {r && (
                <p className="text-xs text-text-secondary">
                  {r.measured === 0
                    ? `No follow-up reading within 4 hours of ${r.unmeasured === 1 ? 'the dose' : 'any dose'} yet`
                    : `Helped ${r.helped} of ${r.measured} ${r.measured === 1 ? 'time' : 'times'} · median change at 2h ${r.medianChange !== null && r.medianChange > 0 ? '+' : ''}${r.medianChange}`}
                  {r.measured > 0 && r.unmeasured > 0 && ` · ${r.unmeasured} without a follow-up reading`}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Reference points, not a verdict. The app counts days and says what
          the guideline numbers are; deciding what they mean is a
          conversation with a doctor, and the wording must not pre-empt it. */}
      <p className="text-xs text-text-secondary">
        Days you logged taking each medication this month. Guidelines put medication-overuse headache at
        around {MOH_DAYS_TRIPTAN} days a month for triptans and {MOH_DAYS_SIMPLE} for simple painkillers,
        sustained over three months — worth raising with your doctor rather than acting on alone.
        Doses taken without logging an attack aren't counted.
      </p>
    </section>
  );
}
