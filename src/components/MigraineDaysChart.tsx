import type { Attack } from '../types';
import { migraineDaysByMonth, lastSevenDays, CHRONIC_DAYS_THRESHOLD } from '../utils/stats';
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
// **Under a 7-day period it draws the week instead** (Sunny, 2026-09-02).
// Whole-month bars against a window that short were answering a question
// nobody had asked — and the section is titled for whichever it is drawing,
// since "per month" on a week strip would be a plain lie.
interface Props {
  attacks: Attack[];
  /** How many calendar months to show, counting back from this one. */
  months: number;
  /** `week` draws the last seven days instead. */
  mode: 'week' | 'months';
}

const BAR_MAX = 20;

export function MigraineDaysChart({ attacks, months: monthCount, mode }: Props) {
  if (mode === 'week') return <MigraineWeek attacks={attacks} />;
  return <MigraineMonths attacks={attacks} monthCount={monthCount} />;
}

function MigraineMonths({ attacks, monthCount }: { attacks: Attack[]; monthCount: number }) {
  const months = migraineDaysByMonth(attacks, monthCount);
  const anyData = months.some((m) => m.days > 0);
  // Named rather than marked: the reader should not have to decode which bar
  // is the partial one. Empty when the range is all complete months.
  const inProgress = months.find((m) => !m.complete)?.label ?? null;
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
          that weren't logged aren't included.
          {inProgress && ` ${inProgress} is still counting, so its bar will grow.`}
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
              {/* No `+` on the month in progress. It meant "still counting"
                  and was read as "1 or more" — which is true, and still the
                  wrong thing to make someone work out from a glyph (Sunny,
                  2026-09-02). The caption names the month instead. */}
              <span className="text-right text-xs tabular-nums text-text-primary">{m.days}</span>
            </div>
          );
        })}
      </div>

    </InsightSection>
  );
}

// The last seven days as a strip, one cell each, filled on a day with an
// attack on it. A bar chart cannot express this: a day either had one or it
// didn't, so every bar would be full or empty and the length would carry no
// information. The 15-day line goes with it for the same reason — a threshold
// stated per month says nothing about a week.
function MigraineWeek({ attacks }: { attacks: Attack[] }) {
  // The clock is read inside the util, not here — a component must never
  // derive a value from `Date` during render. Each cell carries its own date
  // as well as the weekday letter: two Tuesdays never appear in a seven-day
  // strip, but the date is what makes it a record rather than a generic week.
  const days = lastSevenDays(attacks);
  const count = days.filter((d) => d.hit).length;

  return (
    <InsightSection
      title="Migraine days this week"
      note={
        <>
          The last seven days — a dot marks a day with a logged attack on it, and an attack running past
          midnight marks both. Guidelines count migraine days per month, so there is no threshold to
          read a week against; pick 30 days or longer for that.
        </>
      }
    >
      {/* **No cells and no fills.** Drawn as boxes it borrowed the segmented
          control's shape and read as seven things you could tap, which none of
          them are (Sunny, 2026-09-02). A dot under the date is an annotation
          rather than a state, which is what this is. **Today is not marked at
          all** — it was a ring, which is the same borrowed vocabulary one step
          quieter, and the strip is labelled "the last seven days" already.

          The dot's slot is always rendered, at `opacity-0` when there was no
          attack, so a row of dates doesn't shift as the marks come and go —
          the rule `ChipCheck` follows for the same reason. */}
      <div className="space-y-2">
        <div className="flex gap-1.5">
          {days.map((d) => (
            <div key={d.key} className="flex-1 space-y-1 text-center">
              <span className="block text-[0.6875rem] uppercase text-text-secondary">{d.initial}</span>
              <span className={`block text-xs tabular-nums ${d.hit ? 'text-text-primary' : 'text-text-secondary'}`}>
                {d.date}
              </span>
              <span
                aria-hidden="true"
                className={`mx-auto block h-1.5 w-1.5 rounded-full bg-accent ${d.hit ? '' : 'opacity-0'}`}
              />
              {d.hit && <span className="sr-only">migraine day</span>}
            </div>
          ))}
        </div>
        <p className="text-xs text-text-secondary">
          {count === 0 ? 'No migraine days' : `${count} of the last 7 days`}
        </p>
      </div>
    </InsightSection>
  );
}
