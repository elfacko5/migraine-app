import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { Attack } from '../types';
import { formatDate } from '../utils/format';
import {
  attackMaxSeverity, currentAttackStreak, currentPainFreeStreak,
  areaFrequency, avgTimeToPeak, minutesAboveSeverity,
  triggerFrequency, symptomFrequency, reliefFrequency, type Freq,
} from '../utils/stats';
import { HeadHeatmap } from './HeadHeatmap';

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

interface Props { attacks: Attack[] }

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl bg-bg-raised/60 border border-bg-border/60 p-4">
      <p className="text-xs uppercase tracking-wider font-medium text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-bold text-text-primary leading-none">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-text-secondary">{sub}</p>}
    </div>
  );
}

// Ranked horizontal frequency bars (most-frequent first).
function FreqBars({ data, color }: { data: Freq[]; color: string }) {
  const max = data[0]?.count ?? 1;
  return (
    <div className="rounded-xl bg-bg-raised/60 border border-bg-border/60 p-4 space-y-2.5">
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

function FreqSection({ title, sub, data, color }: { title: string; sub: string; data: Freq[]; color: string }) {
  if (data.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-xs uppercase tracking-wider font-medium text-text-secondary">{title} · {sub}</h3>
      <FreqBars data={data} color={color} />
    </section>
  );
}

export function StatsView({ attacks }: Props) {
  const [period, setPeriod] = useState<Period>('7d');

  const filtered = useMemo(() => {
    if (period === 'all') return attacks;
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
      date: formatDate(a.snapshots[0].time),
      severity: attackMaxSeverity(a),
    }));

    const areas = areaFrequency(filtered);

    return {
      count: filtered.length,
      avgSeverity,
      attackStreak: currentAttackStreak(attacks),
      painFreeStreak: currentPainFreeStreak(attacks),
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
    <div className="space-y-6">
      {/* Period filter chips */}
      <div className="flex gap-2 flex-wrap">
        {PERIOD_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setPeriod(value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              period === value
                ? 'bg-accent text-bg-base'
                : 'bg-bg-raised text-text-secondary ring-1 ring-inset ring-bg-border hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-text-secondary text-sm">
          No attacks in this period.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Attacks" value={stats.count} sub={PERIOD_SUB[period]} />
            <StatCard label="Avg max severity" value={stats.avgSeverity} sub={PERIOD_SUB[period]} />
            <StatCard label="Attack streak" value={`${stats.attackStreak}d`} sub="consecutive days" />
            <StatCard label="Pain-free streak" value={`${stats.painFreeStreak}d`} sub="consecutive days" />
            {stats.timeToPeak !== null && (
              <StatCard label="Avg time to peak" value={`${stats.timeToPeak}h`} sub="from start" />
            )}
            {stats.avgAbove5 !== null && (
              <StatCard label="Avg time ≥5" value={`${Math.floor(stats.avgAbove5 / 60)}h ${stats.avgAbove5 % 60}m`} sub="per attack" />
            )}
          </div>

          {/* Severity trend */}
          {stats.severityTrend.length >= 2 && (
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-wider font-medium text-text-secondary">
                Severity trend · {PERIOD_SUB[period]}
              </h3>
              <div className="rounded-xl bg-bg-raised/60 border border-bg-border/60 p-3">
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={stats.severityTrend} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                    <XAxis dataKey="date" tick={{ fill: '#7d8599', fontSize: '0.625rem' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={{ fill: '#7d8599', fontSize: '0.625rem' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#1e2028', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: '0.75rem' }}
                      labelStyle={{ color: '#7d8599' }}
                      itemStyle={{ color: '#dde1eb' }}
                    />
                    <Line type="monotone" dataKey="severity" stroke="#7fc4a0" strokeWidth={2} dot={{ r: 3, fill: '#7fc4a0' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* Area frequency heatmap */}
          {stats.areas.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-wider font-medium text-text-secondary">Pain area frequency</h3>
              <div className="rounded-xl bg-bg-raised/60 border border-bg-border/60 p-4">
                <HeadHeatmap data={stats.areas.map((a) => ({ area: a.area, value: a.count }))} label="attacks" />
              </div>
            </section>
          )}

          {/* Trigger / symptom / relief frequency */}
          <FreqSection title="Top triggers"  sub={PERIOD_SUB[period]} data={stats.triggers} color="#c97c2a" />
          <FreqSection title="Top symptoms"  sub={PERIOD_SUB[period]} data={stats.symptoms} color="#b85c5c" />
          <FreqSection title="Top reliefs"   sub={PERIOD_SUB[period]} data={stats.reliefs}  color="#5a9e7a" />
        </>
      )}
    </div>
  );
}
