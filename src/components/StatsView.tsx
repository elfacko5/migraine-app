import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { Attack, Medication } from '../types';
import { formatDateShort } from '../utils/format';
import {
  attackMaxSeverity, consecutiveMigraineDays, daysSinceLastMigraine,
  areaFrequency, avgTimeToPeak, avgAttackLength,
  triggerFrequency, symptomFrequency, reliefFrequency, type Freq,
} from '../utils/stats';
import { HeadHeatmap } from './HeadHeatmap';
import { MigraineDaysChart } from './MigraineDaysChart';
import { MedicationInsights } from './MedicationInsights';
import { PreventiveInsights } from './PreventiveInsights';
import { InsightSection } from './InsightSection';
import { PERIOD_MS, type Period } from '../utils/logFilters';


const PERIOD_SUB: Record<Period, string> = {
  all:  'all time',
  '7d': 'last 7 days',
  '30d':'last 30 days',
  '3m': 'last 3 months',
};

interface Props {
  attacks: Attack[];
  /** Passed straight through to MedicationInsights, for each drug's own
   *  overuse reference point. */
  medications?: Medication[];
  /** Owned by `App`, because the control that sets it is rendered in the top
   *  bar rather than on this page. Defaults there to 30 days, not 7: every
   *  clinical figure here is monthly — the overuse thresholds, the 15-day
   *  episodic/chronic line — and a 7-day window in a quiet week showed an
   *  empty page to someone with a perfectly normal number of attacks. */
  period: Period;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl bg-bg-raised/60 border border-bg-border/60 p-4">
      {/* 12px, below the 14px caption floor the rest of the app keeps. These
          are labels on a number that is itself 28px — the figure carries the
          card, the label only has to name it — and at 14px a two-word label
          wrapped to two lines and made every tile taller. */}
      <p className="text-[0.75rem] uppercase tracking-wider font-medium text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-bold text-text-primary leading-none">{value}</p>
      {sub && <p className="mt-0.5 text-[0.75rem] text-text-secondary">{sub}</p>}
    </div>
  );
}

// Ranked horizontal frequency bars (most-frequent first).
function FreqBars({ data, color }: { data: Freq[]; color: string }) {
  const max = data[0]?.count ?? 1;
  return (
    <div className="space-y-2.5">
      {data.slice(0, 8).map((f) => (
        <div key={f.name} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-primary truncate pr-2">{f.name}</span>
            <span className="text-text-secondary tabular-nums shrink-0">{f.count}×</span>
          </div>
          <div className="h-2 rounded-full bg-bg-border/40 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(f.count / max) * 100}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function FreqSection({ title, sub, data, color, note }: { title: string; sub: string; data: Freq[]; color: string; note?: string }) {
  if (data.length === 0) return null;
  return (
    <InsightSection title={`${title} · ${sub}`} note={note}>
      <FreqBars data={data} color={color} />
    </InsightSection>
  );
}

export function StatsView({ attacks, medications = [], period }: Props) {

  const filtered = useMemo(() => {
    if (period === 'all') return attacks;
    // the period filter is relative to now by definition; see the same call
    // in HistoryView.
    // eslint-disable-next-line react-hooks/purity
    const cutoff = Date.now() - PERIOD_MS[period];
    return attacks.filter((a) => new Date(a.snapshots[0].time).getTime() >= cutoff);
  }, [attacks, period]);

  const stats = useMemo(() => {
    const avgSeverity = filtered.length
      ? (filtered.reduce((s, a) => s + attackMaxSeverity(a), 0) / filtered.length).toFixed(1)
      : '—';

    const avgLength = avgAttackLength(filtered);

    const timeToPeak = avgTimeToPeak(filtered);

    const severityTrend = [...filtered].reverse().slice(0, 12).map((a) => ({
      // No weekday: a dozen of these sit along one axis and "Fri " on each
      // is three characters of noise per label.
      date: formatDateShort(a.snapshots[0].time),
      severity: attackMaxSeverity(a),
    }));

    const areas = areaFrequency(filtered);

    return {
      count: filtered.length,
      avgSeverity,
      inARow: consecutiveMigraineDays(attacks),
      daysSince: daysSinceLastMigraine(attacks),
      avgLength,
      timeToPeak,
      severityTrend,
      areas,
      triggers: triggerFrequency(filtered),
      symptoms: symptomFrequency(filtered),
      reliefs: reliefFrequency(filtered),
    };
  }, [attacks, filtered]);

  if (attacks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <p className="text-4xl">📊</p>
        <p className="text-text-secondary text-sm">Log your first attack to see stats.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* The period control is not here — it lives in the top bar, so it stays
          on screen while the page scrolls (2026-09-02). As a chip row at the
          top of the content it scrolled away, and half way down the page
          nothing said which period the figures answered. `period` is owned by
          `App` for the same reason. */}

      {/* The tiles answer the period the control sets, so they stay at the
          top, directly under it. */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-text-secondary text-sm">
          No attacks in this period.
        </div>
      ) : (
          <div className="grid grid-cols-2 gap-3">
            {/* No period sub-label: the selected pill above already says it,
                and repeating it on every card cost a line each. The cards
                below keep theirs, which say what the number *is*. */}
            <StatCard label="Attacks" value={stats.count} />
            {/* "Peak", not "max" — the Logs row already calls this figure the
                peak, and one concept wants one word. The averaging moved into
                the sub: "Avg peak severity" wrapped to two lines at 12px and
                took the whole row with it, and the unit needed saying anyway —
                this is the mean of each attack's own peak, not of every reading. */}
            <StatCard label="Peak severity" value={stats.avgSeverity} sub="avg per attack" />
            {/* Plain observations, not streaks — see the note on
                `consecutiveMigraineDays`. Neither is a run to protect or
                break; one says what is happening now, the other when it last
                happened. */}
            <StatCard label="Days in a row" value={stats.inARow} sub="with a migraine" />
            <StatCard label="Days since" value={stats.daysSince} sub="last attack" />
            {stats.timeToPeak !== null && (
              <StatCard label="Avg time to peak" value={`${stats.timeToPeak}h`} sub="from start" />
            )}
            {/* Length, not "time at severity >= 5" — that threshold was never
                justified and had to be decoded before the figure meant
                anything. Duration needs no explaining and is the one ICHD-3
                anchor this page was missing (4-72 hours untreated), which is
                why the Logs row already leads with it. */}
            {stats.avgLength !== null && (
              <StatCard label="Avg length" value={`${Math.floor(stats.avgLength / 60)}h ${stats.avgLength % 60}m`} sub="per attack" />
            )}
          </div>
      )}

      {/* These ignore the period filter — "days per month" and the overuse
          thresholds are monthly figures, and a rolling 7-day window can't
          express either. They also sit outside the empty-period branch above:
          picking "7 days" in a quiet week must not hide the month's
          medication count, which is the number someone would be checking.
          **The section that says so is the caption under the chart**, not a
          heading above it: a "By month" group heading was tried on
          2026-09-02 and removed the same day, because a heading at that level
          reads as owning everything below it — including the period-scoped
          blocks that follow, which is the opposite of what it claimed. */}
      <MigraineDaysChart attacks={attacks} />
      <MedicationInsights attacks={attacks} medications={medications} />
      <PreventiveInsights attacks={attacks} medications={medications} />

      {filtered.length > 0 && (
        <>
          {/* Severity trend */}
          {stats.severityTrend.length >= 2 && (
            <InsightSection title={`Severity trend · ${PERIOD_SUB[period]}`}>
              <div>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={stats.severityTrend} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                    <XAxis dataKey="date" tick={{ fill: '#a39d92', fontSize: '0.625rem' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={{ fill: '#a39d92', fontSize: '0.625rem' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#302d29', border: '1px solid #3a3733', borderRadius: 8, fontSize: '0.75rem' }}
                      labelStyle={{ color: '#a39d92' }}
                      itemStyle={{ color: '#cdc7bb' }}
                    />
                    <Line type="monotone" dataKey="severity" stroke="#9bb9a1" strokeWidth={2} dot={{ r: 3, fill: '#9bb9a1' }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </InsightSection>
          )}

          {/* Area frequency heatmap */}
          {stats.areas.length > 0 && (
            <InsightSection title="Pain area frequency">
              <HeadHeatmap data={stats.areas.map((a) => ({ area: a.area, value: a.count }))} label="attacks" />
            </InsightSection>
          )}

          {/* Trigger / symptom / relief / medication frequency */}
          {/* Named for what it is. Triggers are only ever recorded on attack
              days, so there's no count of days when the same thing happened
              and *no* attack followed — without that denominator the bars
              can't show association, only what was suspected, and a heading
              reading "Top triggers" invites the stronger claim. */}
          <FreqSection
            title="Triggers you noted"
            sub={PERIOD_SUB[period]}
            data={stats.triggers}
            color="#c39257"
            note="Recorded on attack days only — this is what you suspected at the time, not what's been shown to bring one on."
          />
          <FreqSection title="Top symptoms"       sub={PERIOD_SUB[period]} data={stats.symptoms}    color="#c68880" />
          <FreqSection title="Top reliefs"        sub={PERIOD_SUB[period]} data={stats.reliefs}     color="#7fa187" />
        </>
      )}
    </div>
  );
}
