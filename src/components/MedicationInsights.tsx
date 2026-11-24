import type { Attack, DeletedMedName, MedGuides, Medication } from '../types';
import {
  medicationDaysInWindow, medicationDaysByMonth, medicationResponse,
  MOH_DAYS_TRIPTAN, MOH_DAYS_SIMPLE,
} from '../utils/stats';
import { MedIcon } from './drawnIcons';
import { guideForName } from '../utils/medGuardrails';
import { isDeletedName, typeOfName } from '../utils/medResolve';
import { TYPE_OPTIONS } from '../utils/medClasses';
import { InsightSection } from './InsightSection';

// Two questions a clinician asks about medication, and neither of them is
// "how many doses". How many *days a month* is it being taken — the unit
// every overuse threshold is stated in — and does it work.
//
// Per-drug monthly bars (v4 sweep, 2026-11-24, June's call: rebuild to the
// board rather than keep the previous days+response summary). Each bar is a
// whole calendar month against that drug's own guideline — the same shape
// `MigraineDaysChart` already uses above this section, so "the period
// narrows which months are shown, never the counting" applies here too.
// `medicationDaysByMonth` already existed, built for the Today class bars
// (removed 2026-11-17) and never deleted — it is exactly this data.
//
// Class → chart colour: triptan/combination are confirmed against
// `docs/redesign-v4/screens/09-insights` (blue, tan — the only two classes
// drawn in any board). Painkiller and gepant have no board to check against;
// this extends the same 5-colour set for them rather than leaving them
// uncoloured. Worth a second look if a board ever draws one.
//
// Full class strings, not built from a colour name at runtime — Tailwind's
// scanner reads source text, not interpolated template literals, so
// `` `bg-${color}` `` would never generate a utility at all.
const CLASS_STYLE: Record<string, { tile: string; bar: string }> = {
  triptan: { tile: 'bg-chart-1/15 text-chart-1', bar: 'bg-chart-1' },
  combination: { tile: 'bg-chart-5/15 text-chart-5', bar: 'bg-chart-5' },
  simple: { tile: 'bg-chart-2/15 text-chart-2', bar: 'bg-chart-2' },
  gepant: { tile: 'bg-chart-4/15 text-chart-4', bar: 'bg-chart-4' },
};
const DEFAULT_STYLE = { tile: 'bg-bg-raised text-text-secondary', bar: 'bg-text-secondary' };

const BAR_MAX_FALLBACK = 20;

interface Props {
  attacks: Attack[];
  /** The library, for each drug's class — which is the only thing that decides
   *  which of the two guideline numbers applies to it. */
  medications?: Medication[];
  /** Start of the selected period, or `null` for all time. The "doses" /
   *  "checked at 2h" stats below each drug's bars are measured over this. */
  since: number | null;
  /** How many calendar months of bars to draw — same value `MigraineDaysChart`
   *  receives, so the two sections always agree on how far back they look. */
  months: number;
  /** How that period reads in a sentence — "the last 30 days". */
  windowLabel: string;
  /** The monthly guides (a stored number per type, else the guideline). */
  guides?: MedGuides;
  /** Names deleted from the library: their days are shown, never marked as overuse. */
  deleted?: DeletedMedName[];
}

export function MedicationInsights({
  attacks, medications = [], guides = {}, deleted = [], since, months, windowLabel,
}: Props) {
  const days = medicationDaysInWindow(attacks, since);
  if (days.length === 0) return null;

  const response = medicationResponse(attacks, since);
  // Clock read inside the util, not here: `medicationDaysByMonth` defaults
  // `now` itself, the same rule `medGuardrails.ts` and every other
  // clock-reading util in this app follows.
  const byMonth = medicationDaysByMonth(attacks, months);
  const byResponseName = new Map(response.map((r) => [r.name, r]));
  const byMonthName = new Map(byMonth.map((m) => [m.name, m]));

  return (
    <InsightSection
      title="Medication"
      // Reference points, not a verdict. The app counts days and says what the
      // guideline numbers are; deciding what they mean is a conversation with
      // a doctor, and the wording must not pre-empt it.
      //
      // Behind a "More info" icon, like Migraine days per month above
      // (2026-09-23, Sunny's call) — the same five-line-caption problem, on
      // the same page.
      info={
        <>
          Days you logged taking each medication, by month, against the guideline for its type —
          around {MOH_DAYS_TRIPTAN} days a month for triptans and combinations, {MOH_DAYS_SIMPLE} for simple
          painkillers, sustained over three months — worth raising with your doctor rather than acting on
          alone. "Doses" and "checked at 2h" below answer {windowLabel.toLowerCase()}, same as the rest of
          this page. Doses taken without logging an attack aren't counted.
        </>
      }
    >
      <div className="space-y-3">
        {days.map((med) => {
          const r = byResponseName.get(med.name);
          const monthData = byMonthName.get(med.name);
          const cls = typeOfName(med.name, medications);
          const classLabel = cls ? TYPE_OPTIONS.find((t) => t.value === cls)?.label : null;
          const style = (cls && CLASS_STYLE[cls]) || DEFAULT_STYLE;
          // Marked against the guide for *this* drug's type (a stored number,
          // else the ICHD guideline — "not sure"/untyped is measured under
          // "Any attack medicine" via `guideKeyOf`; only a gepant, or old
          // same-name entries that disagree on type, get no guide at all). It
          // used to be 10 for everything, because nothing knew a drug's
          // class — so a simple analgesic was flagged five days early.
          const limit = guideForName(med.name, medications, guides);
          const barMax = limit ?? BAR_MAX_FALLBACK;
          const deletedName = isDeletedName(med.name, medications, deleted);

          return (
            <div key={med.name} className="space-y-3.5 rounded-card bg-bg-raised p-card">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`flex size-compact shrink-0 items-center justify-center rounded-segment ${style.tile}`}
                >
                  <MedIcon name={med.name} className="h-[1.125rem] w-[1.125rem]" />
                </span>
                <span className="min-w-[7.5rem] flex-1">
                  <span className="block truncate text-base font-semibold text-text-primary">{med.name}</span>
                  {classLabel && <span className="block text-xs text-text-secondary">{classLabel}</span>}
                </span>
              </div>

              <div className="space-y-2">
                {(monthData?.months ?? []).map(({ month, label, days: monthDays, complete }) => {
                  const pct = Math.min(100, (monthDays / barMax) * 100);
                  // Evaluated per month, not against the window total: every
                  // bar here is already a true calendar month, so the guide's
                  // own unit applies directly — no `monthScale` guard needed
                  // the way the old single-number summary required one.
                  const nearing = limit !== null && monthDays >= limit && !deletedName;
                  return (
                    <div key={month} className="grid grid-cols-[2.25rem_1fr_3.25rem] items-center gap-2">
                      <span className="text-xs text-text-secondary">
                        {label}
                        {!complete && ' so far'}
                      </span>
                      <span className="relative block h-2.5 rounded-full bg-bg-raised">
                        <span
                          aria-hidden="true"
                          className={`absolute inset-y-0 left-0 rounded-full ${style.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span className={`text-right text-xs tabular-nums ${nearing ? 'text-severity-high' : 'text-text-primary'}`}>
                        {limit !== null ? `${monthDays} of ${limit}` : `${monthDays} ${monthDays === 1 ? 'day' : 'days'}`}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* "doses", "checked at 2h" and "helped" over the page's own
                  period, not the months above — the bars and this line can
                  span different ranges, same as `MigraineDaysChart` and the
                  rest of the page already do.

                  **"Helped" restored (June's call, 2026-11-24)** — the v4
                  board only shows "checked at 2h", but dropping whether a
                  dose worked lost real information the old card had. Kept to
                  a bare count next to "checked at 2h", not the three-clause
                  sentence `docs/decisions.md`'s open item parked: "doses",
                  never "times"; a reading being absent is passive, never
                  "didn't log it" — both carried over unchanged. */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-bg-border pt-3 text-xs text-text-secondary">
                <span>{med.doses} {med.doses === 1 ? 'dose' : 'doses'}</span>
                <span>{r?.measured ?? 0} checked at 2h</span>
                {r && r.measured > 0 && (
                  <span>{r.helped} helped</span>
                )}
                {r && r.unmeasured > 0 && (
                  <span>{r.unmeasured} {r.unmeasured === 1 ? 'dose' : 'doses'} had no reading to compare</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </InsightSection>
  );
}
