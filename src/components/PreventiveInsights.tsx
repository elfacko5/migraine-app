import type { Attack, Medication } from '../types';
import { preventiveEffect, PREVENTIVE_RESPONSE_PCT } from '../utils/stats';
import { MedIcon } from './drawnIcons';
import { InsightSection } from './InsightSection';

// The one question a preventive is judged on: are there fewer migraine days a
// month since it started. It is the primary endpoint of every preventive
// trial, and the reason `Medication.startedOn` is captured at all.
//
// It states both averages, both window lengths and the guideline figure, and
// concludes nothing — the same register as the overuse caption. A preventive
// is stopped or changed on the strength of this number, which is exactly why
// the app must not be the thing that decides.
interface Props {
  attacks: Attack[];
  medications?: Medication[];
}

/**
 * `startedOn` is a *local* YYYY-MM-DD, so it is rebuilt from its parts rather
 * than handed to `formatDateShort`: `new Date('2026-08-19')` is parsed as UTC
 * midnight and renders as the day before anywhere west of Greenwich.
 */
function formatStarted(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** One decimal, but never "3.0" where "3" is the honest thing to read. */
function days(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

export function PreventiveInsights({ attacks, medications = [] }: Props) {
  const effects = preventiveEffect(attacks, medications);
  if (effects.length === 0) return null;

  return (
    <InsightSection
      title="Preventives"
      note={
        <>
          Migraine days a month before each preventive started, against the months since. Trials count a
          preventive as working at around a {PREVENTIVE_RESPONSE_PCT}% reduction in monthly migraine days —
          worth raising with your doctor rather than acting on alone. The month it started is left out of
          both figures, since it is part on and part off, and so is the month in progress.
        </>
      }
    >
      <div className="space-y-4">
        {effects.map((e) => (
          <div key={e.name} className="space-y-1">
            <div className="flex items-baseline gap-2">
              <MedIcon name={e.name} className="h-4 w-4 text-text-secondary" />
              <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{e.name}</span>
              <span className="text-xs text-text-secondary">
                started {formatStarted(e.startedOn)}
              </span>
            </div>

            {e.status === 'too-soon' && (
              <p className="text-xs text-text-secondary">
                No complete month has passed since it started, so there is nothing to compare yet.
              </p>
            )}

            {e.status === 'no-baseline' && (
              <p className="text-xs text-text-secondary">
                Your diary doesn't reach back before this started, so there's no before figure to compare
                against.
              </p>
            )}

            {e.status === 'ready' && (
              <>
                <div className="flex items-baseline gap-4">
                  <div>
                    <div className="text-xl font-bold text-text-primary">{days(e.beforeAvg)}</div>
                    <div className="text-xs text-text-secondary">
                      before · {e.beforeMonths} {e.beforeMonths === 1 ? 'month' : 'months'}
                    </div>
                  </div>
                  <div aria-hidden className="text-text-secondary">→</div>
                  <div>
                    <div className="text-xl font-bold text-text-primary">{days(e.afterAvg)}</div>
                    <div className="text-xs text-text-secondary">
                      since · {e.afterMonths} {e.afterMonths === 1 ? 'month' : 'months'}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-text-secondary">
                  Migraine days a month
                  {e.changePct !== null && (
                    <>
                      {' · '}
                      {e.changePct < 0
                        ? `${Math.round(-e.changePct)}% fewer`
                        : e.changePct > 0
                          ? `${Math.round(e.changePct)}% more`
                          : 'unchanged'}
                    </>
                  )}
                </p>
                {/* One month against one is a much weaker reading than three
                    against three, and the percentage alone cannot say so. */}
                {(e.beforeMonths < 3 || e.afterMonths < 3) && (
                  <p className="text-xs text-text-secondary">
                    Based on a short run of months so far — it will settle as more are recorded.
                  </p>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </InsightSection>
  );
}
