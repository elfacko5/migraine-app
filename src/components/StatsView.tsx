import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { Attack, Medication } from '../types';
import { formatDateShort } from '../utils/format';
import {
  attackMaxSeverity, consecutiveMigraineDays, daysSinceLastMigraine,
  areaFrequency, avgTimeToPeak, minutesAboveSeverity,
  triggerFrequency, symptomFrequency, reliefFrequency, type Freq,
} from '../utils/stats';
import { HeadHeatmap } from './HeadHeatmap';
import { MigraineDaysChart } from './MigraineDaysChart';
import { MedicationInsights } from './MedicationInsights';
import { PreventiveInsights } from './PreventiveInsights';
import { InsightSection } from './InsightSection';
import { chipClass} from '../utils/chipStyles';
import { ChipCheck } from './ChipCheck';

type Period = 'all' | '7d' | '30d' | '3m';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d',  label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '3m',  label: '3 months' },
  { value: 'all', label: 'All' },
];

const PERIOD_MS: Record<Exclude<Period, 'all'>, number> = {
  '7d':  7  * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '3m':  90 * 24 * 60 * 60 * 1000,
};

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

export function StatsView({ attacks, medications = [] }: Props) {
  // 30 days, not 7. Every clinical figure on this page is monthly — the
  // overuse thresholds, the 15-day episodic/chronic line — and a 7-day window
  // in a quiet week shows an empty page to someone with a perfectly normal
  // number of attacks. The Logs list still opens on 7 days: "what happened
  // recently" is a different question from "what does my month look like".
  const [period, setPeriod] = useState<Period>('30d');

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

    const avgAbove5 = filtered.length
      ? Math.round(filtered.reduce((s, a) => s + minutesAboveSeverity(a, 5), 0) / filtered.length)
      : null;

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
      avgAbove5,
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
      {/* Period filter chips */}
      <div className="flex gap-2 flex-wrap">
        {PERIOD_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setPeriod(value)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              chipClass(period === value)
            }`}
          >
            {label}
            <ChipCheck selected={period === value} />
          </button>
        ))}
      </div>

      {/* The tiles answer the period the pills just set, so they stay
          directly under them. */}
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
            <StatCard label="Avg max severity" value={stats.avgSeverity} />
            {/* Plain observations, not streaks — see the note on
                `consecutiveMigraineDays`. Neither is a run to protect or
                break; one says what is happening now, the other when it last
                happened. */}
            <StatCard label="Days in a row" value={stats.inARow} sub="with a migraine" />
            <StatCard label="Days since" value={stats.daysSince} sub="your last attack" />
            {stats.timeToPeak !== null && (
              <StatCard label="Avg time to peak" value={`${stats.timeToPeak}h`} sub="from start" />
            )}
            {stats.avgAbove5 !== null && (
              <StatCard label="Avg time ≥5" value={`${Math.floor(stats.avgAbove5 / 60)}h ${stats.avgAbove5 % 60}m`} sub="per attack" />
            )}
          </div>
      )}

      {/* These two ignore the period filter — "days per month" and the overuse
          thresholds are monthly figures, and a rolling 7-day window can't
          express either. They also sit outside the empty-period branch above:
          picking "7 days" in a quiet week must not hide the month's
          medication count, which is the number someone would be checking. */}
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
                      itemStyle={{ color: '#e4dfd6' }}
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
          <FreqSection title="Top symptoms"       sub={PERIOD_SUB[period]} data={stats.symptoms}    color="#a65a52" />
          <FreqSection title="Top reliefs"        sub={PERIOD_SUB[period]} data={stats.reliefs}     color="#7fa187" />
        </>
      )}
    </div>
  );
}
