import type { Attack, DeletedMedName, MedGuides, Medication } from '../types';
import {
  medicationDaysInWindow, medicationDaysByMonth, medicationResponse, shownMonthsStart,
  MOH_DAYS_TRIPTAN, MOH_DAYS_SIMPLE,
} from '../utils/stats';
import { MedIcon, TabletIcon } from './drawnIcons';
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
  /** Start of the selected period, or `null` for all time. Decides which
   *  drugs get a card — not what the line under the bars counts, which
   *  follows the months drawn. */
  since: number | null;
  /** How many calendar months of bars to draw — same value `MigraineDaysChart`
   *  receives, so the two sections always agree on how far back they look. */
  months: number;
  /** The monthly guides (a stored number per type, else the guideline). */
  guides?: MedGuides;
  /** Names deleted from the library: their days are shown, never marked as overuse. */
  deleted?: DeletedMedName[];
  /** Opens Monthly guides in a bottom sheet — the link under the last card. */
  onOpenGuides?: () => void;
}

export function MedicationInsights({
  attacks, medications = [], guides = {}, deleted = [], since, months, onOpenGuides,
}: Props) {
  // Clock read inside the util, not here: `medicationDaysByMonth` defaults
  // `now` itself, the same rule `medGuardrails.ts` and every other
  // clock-reading util in this app follows.
  const byMonth = medicationDaysByMonth(attacks, months);
  const byMonthName = new Map(byMonth.map((m) => [m.name, m]));
  // A drug gets a card when it was taken in the period *and* in the months
  // drawn. For 7d/30d/3m the months drawn always cover the period, so the
  // second test changes nothing; on All the bars stop at 12 months, and a
  // drug last taken before that would be a card of empty bars over
  // "0 days · 0 doses" (Sunny, 2026-11-25: All shows the last 12 months of
  // medication, said in the info text). Ordered by days in those months, the
  // figure the line leads with.
  const days = medicationDaysInWindow(attacks, since)
    .map((med) => {
      const monthData = byMonthName.get(med.name);
      return {
        name: med.name,
        monthData,
        shownDays: (monthData?.months ?? []).reduce((sum, m) => sum + m.days, 0),
        shownDoses: monthData?.doses ?? 0,
      };
    })
    .filter((med) => med.shownDoses > 0)
    .sort((a, b) => b.shownDays - a.shownDays || a.name.localeCompare(b.name));
  if (days.length === 0) return null;

  // The line under the bars answers the bars — measured from the 1st of the
  // first month drawn, not from the period's rolling start (2026-11-25). The
  // two used to differ (3m: bars from 1 Aug, line from ~27 Aug), so a line
  // sitting under the bars read as their total and didn't add up.
  const shownFrom = shownMonthsStart(months);
  const response = medicationResponse(attacks, shownFrom);
  // Named, not counted: the months drawn are calendar months with this one
  // included, so "the last 12 months" was wrong by up to a month, and with a
  // shorter diary All draws fewer than 12. The first month's name is exact
  // in both cases.
  const shownFromLabel = new Date(shownFrom).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const byResponseName = new Map(response.map((r) => [r.name, r]));

  return (
    <InsightSection
      title="Medication"
      icon={<TabletIcon />}
      iconTone="bg-chart-1/16 text-chart-1"
      // No section card — the v4 board sits this heading straight on the
      // page, each drug already its own card (`.mc` in the board, not
      // nested in a `.card`). A section fill around cards that are already
      // filled was just a border.
      bare
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
          alone. The line under each drug's bars counts across the same months the bars show.
          {since === null && <> On All, this goes back to {shownFromLabel} — medicines taken only before
          then aren't shown.</>} Doses taken without logging an attack aren't counted.
        </>
      }
    >
      <div className="space-y-3">
        {days.map(({ name, monthData, shownDays, shownDoses }) => {
          const r = byResponseName.get(name);
          const cls = typeOfName(name, medications);
          const classLabel = cls ? TYPE_OPTIONS.find((t) => t.value === cls)?.label : null;
          const style = (cls && CLASS_STYLE[cls]) || DEFAULT_STYLE;
          // Marked against the guide for *this* drug's type (a stored number,
          // else the ICHD guideline — "not sure"/untyped is measured under
          // "Any attack medicine" via `guideKeyOf`; only a gepant, or old
          // same-name entries that disagree on type, get no guide at all). It
          // used to be 10 for everything, because nothing knew a drug's
          // class — so a simple analgesic was flagged five days early.
          const limit = guideForName(name, medications, guides);
          const barMax = limit ?? BAR_MAX_FALLBACK;
          const deletedName = isDeletedName(name, medications, deleted);

          return (
            <div key={name} className="space-y-3.5 rounded-card bg-bg-surface p-card">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`flex size-compact shrink-0 items-center justify-center rounded-segment ${style.tile}`}
                >
                  <MedIcon name={name} className="h-[1.125rem] w-[1.125rem]" />
                </span>
                <span className="min-w-[7.5rem] flex-1">
                  <span className="block truncate text-base font-semibold text-text-strong">{name}</span>
                  {classLabel && <span className="block text-xs text-text-secondary">{classLabel}</span>}
                </span>
              </div>

              {/* The board's `.mr`: month and count on one line above a
                  full-width track, so every track starts at the same edge
                  however long the month label runs ("Nov so far"). The count
                  is the figure — strong — and "of 10" is muted context; no
                  "days" after it (Sunny, 2026-11-25), the section says what
                  is counted. */}
              <div className="space-y-2.5">
                {(monthData?.months ?? []).map(({ month, label, days: monthDays, complete }) => {
                  const pct = Math.min(100, (monthDays / barMax) * 100);
                  // Evaluated per month, not against the window total: every
                  // bar here is already a true calendar month, so the guide's
                  // own unit applies directly — no `monthScale` guard needed
                  // the way the old single-number summary required one.
                  const nearing = limit !== null && monthDays >= limit && !deletedName;
                  return (
                    <div key={month} className="space-y-1.5">
                      <div className="flex justify-between gap-2 text-sm text-text-primary">
                        <span>
                          {label}
                          {!complete && <span className="text-text-secondary"> so far</span>}
                        </span>
                        <span className="tabular-nums">
                          <span className={`font-semibold ${nearing ? 'text-severity-high' : 'text-text-strong'}`}>{monthDays}</span>
                          {limit !== null && <span className="text-text-secondary"> of {limit}</span>}
                        </span>
                      </div>
                      <span className="relative block h-2.5 overflow-hidden rounded-full bg-bg-raised">
                        <span
                          aria-hidden="true"
                          className={`absolute inset-y-0 left-0 rounded-full ${style.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Days, doses, "checked at 2h" and "helped" over the months
                  drawn above — days is the bars' own sum, so the line reads
                  as their total because it is. Doses beside it shows two in
                  one day, which a day count hides.

                  **"Helped" restored (June's call, 2026-11-24)** — the v4
                  board only shows "checked at 2h", but dropping whether a
                  dose worked lost real information the old card had. Kept to
                  a bare count next to "checked at 2h", not the three-clause
                  sentence `docs/decisions.md`'s open item parked: "doses",
                  never "times"; a reading being absent is passive, never
                  "didn't log it" — both carried over unchanged. */}
              <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-bg-border pt-3 text-xs text-text-primary">
                {/* Muted glyphs before doses and "checked at 2h", as the board's `.mstats`. */}
                <span>{shownDays} {shownDays === 1 ? 'day' : 'days'}</span>
                <span className="inline-flex items-center gap-1.5">
                  <MedIcon name={name} className="h-4 w-4 text-text-secondary" />
                  {shownDoses} {shownDoses === 1 ? 'dose' : 'doses'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
                    strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-text-secondary" aria-hidden="true">
                    <path d="M5 12l4 4 10-10" />
                  </svg>
                  {r?.measured ? r.measured : 'none'} checked at 2h
                </span>
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
        {/* The board's `.link` under the last card: every bar above is
            measured against these numbers, so where they're set is one tap
            away. Opens as a bottom sheet over Insights (Sunny, 2026-11-25),
            not a jump to the Settings tab. */}
        {onOpenGuides && (
          <button
            type="button"
            onClick={onOpenGuides}
            className="flex min-h-target items-center gap-1.5 text-sm font-medium text-accent-light transition-colors hover:text-accent"
          >
            Your monthly guides
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
              strokeLinejoin="round" className="h-4 w-4 text-text-secondary" aria-hidden="true">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        )}
      </div>
    </InsightSection>
  );
}
