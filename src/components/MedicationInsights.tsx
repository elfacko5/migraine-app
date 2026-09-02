import type { Attack, Medication } from '../types';
import {
  medicationDaysInWindow, medicationResponse,
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
  /** Start of the selected period, or `null` for all time. Both figures below
   *  are measured over it, on the dose's own time. */
  since: number | null;
  /** How that period reads in a sentence — "the last 30 days". */
  windowLabel: string;
  /** Whether the window is close enough to a calendar month for the overuse
   *  thresholds to mean anything against it. See the note on `nearing`. */
  monthScale: boolean;
}

export function MedicationInsights({
  attacks, medications = [], since, windowLabel, monthScale,
}: Props) {
  const days = medicationDaysInWindow(attacks, since);
  const response = medicationResponse(attacks, since);
  if (days.length === 0) return null;

  const byName = new Map(response.map((r) => [r.name, r]));

  return (
    <InsightSection
      title="Medication"
      // Reference points, not a verdict. The app counts days and says what the
      // guideline numbers are; deciding what they mean is a conversation with
      // a doctor, and the wording must not pre-empt it.
      note={
        <>
          Days you logged taking each medication — {windowLabel}. Guidelines put medication-overuse
          headache at around {MOH_DAYS_TRIPTAN} days a month for triptans and {MOH_DAYS_SIMPLE} for
          simple painkillers, sustained over three months — worth raising with your doctor rather than
          acting on alone.
          {/* The window has to be a month for a monthly threshold to apply. Say
              so rather than marking against it anyway, and say where to look:
              a caption that withholds a figure without explaining reads as the
              app having lost it. */}
          {monthScale
            ? ' Each drug is measured against the number for its own type, or the limit you entered for it in My medications.'
            : ' Those numbers are per month, and this period is longer than one — so nothing here is marked against them. Pick 30 days for that.'}
          {' '}Doses taken without logging an attack aren't counted.
        </>
      }
    >
      {/* A hairline between drugs rather than a gap: with two or more the rows
          ran together, since each is itself two lines. Drawn per row rather
          than with `divide-y`, which resolved to nothing here — measured, not
          assumed. Nothing is drawn above the first, so a single medication
          gets no rule at all. `bg-border` is the divider token: a hairline
          between things you read, not the outline of something you press. */}
      <div>
        {days.map((med, i) => {
          const r = byName.get(med.name);
          // Marked against *this* drug's reference point: the limit off its
          // label if one was entered, else the ICHD number for its class, else
          // 10. It used to be 10 for everything, because nothing knew a drug's
          // class — so a simple analgesic was flagged five days early.
          // **Only when the window is month-scale.** The thresholds are stated
          // per month; over 3 months or all time a count will sail past 10
          // without meaning anything, and an amber figure that says "overuse"
          // when it doesn't is the one direction this page must not fail in.
          // Under a month it can only ever under-warn, which is safe.
          const nearing = monthScale && med.days >= mohDaysFor(med.name, medications);
          return (
            <div
              key={med.name}
              className={`space-y-2 ${i > 0 ? 'mt-3 border-t border-bg-border pt-3' : ''}`}
            >
              {/* `items-center`, not `items-baseline`. The mark is an 18px
                  drawn icon with no text baseline of its own, so aligning the
                  row on one sat it low against the name beside it. */}
              <div className="flex items-center gap-2">
                <MedIcon name={med.name} className="h-[1.125rem] w-[1.125rem] text-text-secondary" />
                <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                  {med.name}
                  {/* Only when they differ — with one dose a day, "11 days ·
                      11 doses" is noise. Two a day is a different exposure
                      from one and the day count alone can't show it. */}
                  {med.doses > med.days && (
                    <span className="text-xs text-text-secondary"> · {med.doses} doses</span>
                  )}
                </span>
                <span className={`text-sm tabular-nums ${nearing ? 'text-severity-high' : 'text-text-primary'}`}>
                  {med.days}
                </span>
                <span className="text-xs text-text-secondary">
                  {med.days === 1 ? 'day' : 'days'}
                </span>
              </div>

              {/* **Shortened for the demo on 2026-09-02, and not settled.**
                  The long form — three full sentences — was clear but ran to
                  five lines a drug, which Sunny judged too heavy on the card.
                  This is the middle draft: still names what is lower and what
                  the missing readings cost, but back to dot-separated clauses.
                  **Marked for discussion**, see the open item in
                  `docs/decisions.md`; the trade is legibility against length
                  and it has not been decided, only parked.

                  "doses", never "times" — the figure above counts days, and
                  two numbers on one card that mean different things have to
                  say which is which. */}
              {r && (
                <p className="text-xs text-text-secondary">
                  {[
                    r.measured > 0 &&
                      `Helped after ${r.helped} of ${r.measured} ${r.measured === 1 ? 'dose' : 'doses'}`,
                    r.measured > 0 && r.medianChange !== null && (
                      r.medianChange === 0
                        ? 'typically the same two hours on'
                        : `typically ${Math.abs(r.medianChange)} ${Math.abs(r.medianChange) === 1 ? 'point' : 'points'} ${r.medianChange < 0 ? 'lower' : 'higher'} two hours on`
                    ),
                    // Passive, never "you didn't log it": a reading is absent,
                    // which is not the same as someone having failed (§9).
                    r.unmeasured > 0 &&
                      `${r.unmeasured} ${r.unmeasured === 1 ? 'dose' : 'doses'} had no reading to compare`,
                  ].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          );
        })}
      </div>

    </InsightSection>
  );
}
