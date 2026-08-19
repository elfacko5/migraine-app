import type { Attack, Medication } from '../types';
import {
  medicationDaysByMonth, medicationResponse,
  MOH_DAYS_TRIPTAN, MOH_DAYS_SIMPLE,
} from '../utils/stats';
import { MedIcon } from './drawnIcons';
import { mohDaysFor } from '../utils/medGuardrails';
import { InsightSection } from './InsightSection';

// Two questions a clinician asks about medication, and neither of them is
// "how many doses". How many *days a month* is it being taken — the unit
// every overuse threshold is stated in — and does it work.
interface Props {
  attacks: Attack[];
  /** The library, for each drug's class — which is the only thing that decides
   *  which of the two guideline numbers applies to it. */
  medications?: Medication[];
}

export function MedicationInsights({ attacks, medications = [] }: Props) {
  const days = medicationDaysByMonth(attacks);
  const response = medicationResponse(attacks);
  if (days.length === 0) return null;

  const byName = new Map(response.map((r) => [r.name, r]));

  return (
    <InsightSection
      title="Medication this month"
      // Reference points, not a verdict. The app counts days and says what the
      // guideline numbers are; deciding what they mean is a conversation with
      // a doctor, and the wording must not pre-empt it.
      note={
        <>
          Days you logged taking each medication this month. Guidelines put medication-overuse headache at
          around {MOH_DAYS_TRIPTAN} days a month for triptans and {MOH_DAYS_SIMPLE} for simple painkillers,
          sustained over three months — worth raising with your doctor rather than acting on alone.
          Each drug is measured against the number for its own type, or the limit you entered for it in
          My medications. Doses taken without logging an attack aren't counted.
        </>
      }
    >
      <div className="space-y-3">
        {days.map((med) => {
          const r = byName.get(med.name);
          // Marked against *this* drug's reference point: the limit off its
          // label if one was entered, else the ICHD number for its class, else
          // 10. It used to be 10 for everything, because nothing knew a drug's
          // class — so a simple analgesic was flagged five days early.
          const nearing = med.thisMonth >= mohDaysFor(med.name, medications);
          return (
            <div key={med.name} className="space-y-1">
              <div className="flex items-baseline gap-2">
                <MedIcon name={med.name} className="h-4 w-4 text-text-secondary" />
                <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                  {med.name}
                  {/* Only when they differ — with one dose a day, "11 days ·
                      11 doses" is noise. Two a day is a different exposure
                      from one and the day count alone can't show it. */}
                  {med.dosesThisMonth > med.thisMonth && (
                    <span className="text-xs text-text-secondary"> · {med.dosesThisMonth} doses</span>
                  )}
                </span>
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
                    // "doses", never "times": the number above counts days,
                    // and two figures on one row that mean different things
                    // have to say which is which.
                    : `Helped ${r.helped} of ${r.measured} ${r.measured === 1 ? 'dose' : 'doses'} · median change at 2h ${r.medianChange !== null && r.medianChange > 0 ? '+' : ''}${r.medianChange}`}
                  {r.measured > 0 && r.unmeasured > 0 && ` · ${r.unmeasured} more without a follow-up reading`}
                </p>
              )}
            </div>
          );
        })}
      </div>

    </InsightSection>
  );
}
