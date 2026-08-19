import type { Attack } from '../types';
import { migraineDaysByMonth, CHRONIC_DAYS_THRESHOLD } from '../utils/stats';
import { InsightSection } from './InsightSection';

// Days per month, not attacks per month. Every clinical threshold, trial
// endpoint and treatment decision is stated in days — an attack running past
// midnight is two of them — and this is the number a doctor asks for first.
//
// It sits outside the period filter above it on purpose: "days per month" is
// only meaningful per calendar month, and a rolling 7-day window can't
// express it.
interface Props { attacks: Attack[] }

const BAR_MAX = 20;

export function MigraineDaysChart({ attacks }: Props) {
  const months = migraineDaysByMonth(attacks, 6);
  const anyData = months.some((m) => m.days > 0);
  if (!anyData) return null;

  return (
    <InsightSection
      title="Migraine days per month"
      note={
        <>
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
