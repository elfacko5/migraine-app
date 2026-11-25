import type { Attack } from '../types';
import { maxSeverity } from '../utils/stats';
import { formatTime } from '../utils/format';
import { isRetired } from '../utils/retired';

// Chart geometry, in viewBox units. Pain runs 1…10 as on Insights: no reading
// is ever 0, so a 0 row is space for a value that can't occur.
const LEFT = 40;
const RIGHT = 304;
const y = (v: number) => 122 - (v - 1) * 10;
const MAX_TIME_LABELS = 4;
const MARK_GAP = 24;

/**
 * Pain over time: the highest place at each reading, **evenly spaced**
 * (reminders are answered when they are answered, so clock gaps say more about
 * the diary than the attack), each dose a dashed line carrying its type letter.
 *
 * Nothing is drawn after the last reading. No pain was read at the end, and a
 * line down to zero would draw a score that was never logged; the caption says
 * where the readings stop instead.
 */
export function AttackPainChart({ attack, letterFor }: { attack: Attack; letterFor: (name: string) => string | null }) {
  // A reading with no areas (symptoms only) hasn't reported a pain score.
  const scored = attack.snapshots.filter((s) => Object.keys(s.areas).length > 0);
  const n = scored.length;
  if (n === 0) return null;
  const values = scored.map(maxSeverity);
  const x = (i: number) => (n === 1 ? LEFT : LEFT + (i * (RIGHT - LEFT)) / (n - 1));
  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v)}`).join(' ');

  // At most four times along the bottom — first, last and two between — so
  // labels never run into each other however many readings there are.
  const labelled = [...new Set(
    Array.from({ length: Math.min(n, MAX_TIME_LABELS) }, (_, k) => Math.round((k * (n - 1)) / Math.max(1, Math.min(n, MAX_TIME_LABELS) - 1))),
  )];

  const doses = scored
    .map((s, i) => ({ i, name: s.medication?.name?.trim() }))
    .filter((m): m is { i: number; name: string } => !!m.name && !isRetired(m.name));
  // The line stays on its reading; a letter box that would cover the one
  // before it moves right.
  const marks = doses.reduce<Array<{ i: number; name: string; box: number }>>((out, d) => {
    const prev = out[out.length - 1];
    return [...out, { ...d, box: Math.min(315, prev ? Math.max(x(d.i), prev.box + MARK_GAP) : x(d.i)) }];
  }, []);

  const lastTime = scored[n - 1].time;
  const stopsShort = attack.end !== null && (attack.endUnknown || new Date(attack.end).getTime() - new Date(lastTime).getTime() >= 60_000);
  const caption = [
    n === 1 ? 'One reading.' : 'Highest place at each reading, evenly spaced.',
    doses.length ? 'Lettered lines are doses.' : null,
    stopsShort && n > 1 ? `No reading after ${formatTime(lastTime)}.` : null,
  ].filter(Boolean).join(' ');
  const label = `Pain over time: ${scored.map((s, i) => `${values[i]} at ${formatTime(s.time)}`).join(', ')}${doses.length ? `. Doses: ${doses.map((m) => m.name).join(', ')}` : ''}`;
  const text = { fontSize: 14, fontFamily: 'Lexend, sans-serif', className: 'fill-text-secondary' };

  return (
    <>
      <h3 className="pt-2 text-lg font-semibold text-text-primary">Pain over time</h3>
      <div className="space-y-2 rounded-card bg-bg-surface p-card">
        <svg viewBox="0 0 326 150" role="img" aria-label={label} className="block h-auto w-full">
          {[10, 5, 1].map((v) => (
            <g key={v}>
              <text x={v === 10 ? 0 : 8} y={y(v) + 5} {...text}>{v}</text>
              <line x1="28" y1={y(v)} x2="326" y2={y(v)} className="stroke-bg-border" />
            </g>
          ))}
          {marks.map((m) => (
            <g key={`${m.i}-${m.name}`}>
              <line x1={x(m.i)} y1="24" x2={x(m.i)} y2="122" className="stroke-text-secondary" strokeWidth="1.2" strokeDasharray="3 3" />
              <rect x={m.box - 11} y="1" width="22" height="22" rx="6" className="fill-bg-base stroke-accent" strokeWidth="1.5" />
              <text x={m.box} y="17" textAnchor="middle" fontSize="13" fontWeight="700" fontFamily="Lexend, sans-serif" className="fill-text-primary">
                {letterFor(m.name) ?? '–'}
              </text>
            </g>
          ))}
          {n > 1 && <path d={line} fill="none" className="stroke-accent-light" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
          {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="4" className="fill-accent-light" />)}
          {labelled.map((i) => (
            <text key={i} x={x(i)} y="144" textAnchor="middle" {...text}>{formatTime(scored[i].time)}</text>
          ))}
        </svg>
        <p className="text-xs text-text-secondary">{caption}</p>
      </div>
    </>
  );
}
