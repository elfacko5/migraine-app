import type { Attack } from '../types';
import { migraineDaysByMonth, CHRONIC_DAYS_THRESHOLD } from '../utils/stats';
import { InsightSection } from './InsightSection';

// Days per month, not attacks per month. Every clinical threshold, trial
// endpoint and treatment decision is stated in days — an attack running past
// midnight is two of them — and this is the number a doctor asks for first.
//
// **The period control chooses how many months are shown, not how the bars are
// counted** (2026-09-02, on Sunny's instruction — a page where half the figures
// ignore the control above them is confusing whatever each figure is doing on
// its own). Each bar stays a whole calendar month, because that is the only
// window the 15-day line means anything against; the period narrows the range.
// So "7 days" shows the month or two the last week falls in, with those months
// counted in full — which the caption has to keep saying, or a bar would read
// as a count of the selected window.
interface Props {
  attacks: Attack[];
  /** How many calendar months to show, counting back from this one. */
  months: number;
}

const BAR_MAX = 20;

export function MigraineDaysChart({ attacks, months: monthCount }: Props) {
  const months = migraineDaysByMonth(attacks, monthCount);
  const anyData = months.some((m) => m.days > 0);
  if (!anyData) return null;

  return (
    <InsightSection
      title="Migraine days per month"
      note={
        <>
          {/* The scope leads the caption, because this is the section the
              period pills visibly don't reach and the one whose figure was
              read as contradicting the attack count above it — 7 attacks
              against 11 days. It sits here rather than under the group
              heading so the chart isn't pushed down the screen by three
              stacked lines of text before it. */}
          <span className="mb-2 block">
            Whole calendar months. The period above chooses which months are shown; each bar still
            counts its whole month.
          </span>
          Days with a logged attack — an attack running past midnight counts as two. The line marks 15 days,
          where guidelines separate episodic from chronic migraine. This counts migraine days only; headaches
          that weren't logged aren't included. The current month is still counting.
        </>
      }
    >
      <div className="space-y-1.5">
        {months.map((m) => {
          const pct = Math.min(100, (m.days / BAR_MAX) * 100);
          const chronic = m.days >= CHRONIC_DAYS_THRESHOLD;
          return (
            <div key={m.month} className="grid grid-cols-[2.25rem_1fr_1.75rem] items-center gap-2">
              <span className="text-xs text-text-secondary">{m.label}</span>
              <span className="relative block h-2.5 rounded-full bg-bg-border/60">
                <span
                  className={`absolute inset-y-0 left-0 rounded-full ${chronic ? 'bg-severity-high' : 'bg-accent'}`}
                  style={{ width: `${pct}%` }}
                />
                {/* The 15-day line, drawn on every bar so a month can be read
                    against it without doing the arithmetic. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-y-[-2px] w-px bg-text-secondary/50"
                  style={{ left: `${(CHRONIC_DAYS_THRESHOLD / BAR_MAX) * 100}%` }}
                />
              </span>
              <span className="text-right text-xs tabular-nums text-text-primary">
                {m.days}
                {!m.complete && <span className="text-text-secondary">+</span>}
              </span>
            </div>
          );
        })}
      </div>

    </InsightSection>
  );
}
