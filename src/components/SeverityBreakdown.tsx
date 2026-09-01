import type { Attack } from '../types';
import { sevFill } from './headDiagram';

// One row per pain area: a sparkline for shape, then peak and now for
// precision. It replaced a multi-line chart with one categorical colour per
// zone — 17 of them, where 8 is the ceiling and the worst adjacent pair
// measured ΔE 4.5 in *normal* vision, so two lines were indistinguishable
// even to a reader with no colour-vision deficiency.
//
// The fix isn't a better palette, it's a different encoding: colour here
// carries magnitude (the severity ramp, shared with the head diagram and the
// timeline) rather than identity, and identity is carried by a row label.
// It's also why this form is width-stable — the column count is fixed at two
// however many readings an attack has, where a column per reading stops
// fitting a 375px screen at around five.
interface Props { attack: Attack }

const W = 96;
const H = 20;
const PAD = 3;

function sevClasses(v: number): { text: string; bg: string } {
  if (v <= 3) return { text: 'text-severity-low', bg: 'bg-severity-low/15' };
  if (v <= 7) return { text: 'text-severity-mid', bg: 'bg-severity-mid/15' };
  return { text: 'text-severity-high', bg: 'bg-severity-high/20' };
}

interface Row {
  area: string;
  peak: number;
  /** Value at the most recent reading, or null if it wasn't recorded there. */
  now: number | null;
  points: { x: number; y: number; i: number; v: number }[];
}

export function SeverityBreakdown({ attack }: Props) {
  const snaps = attack.snapshots;
  const times = snaps.map((s) => new Date(s.time).getTime());
  const t0 = times[0];
  const span = Math.max(1, times[times.length - 1] - t0);

  const x = (t: number) => PAD + ((t - t0) / span) * (W - PAD * 2);
  const y = (v: number) => PAD + ((10 - v) / 10) * (H - PAD * 2);

  const areas = [...new Set(snaps.flatMap((s) => Object.keys(s.areas)))];

  const rows: Row[] = areas.map((area) => {
    const points = snaps
      .map((s, i) => ({ i, v: s.areas[area] }))
      .filter((p) => typeof p.v === 'number')
      .map((p) => ({ ...p, x: x(times[p.i]), y: y(p.v) }));
    const last = points[points.length - 1];
    return {
      area,
      peak: Math.max(...points.map((p) => p.v)),
      // Absent from the latest reading means *not recorded*, never zero — the
      // wizard starts blank every time, so a missing area can equally mean
      // "it stopped" or "I only logged the worst one". Rendering it as 0
      // would assert something nobody said.
      now: last.i === snaps.length - 1 ? last.v : null,
      points,
    };
  });

  // Worst first: the row that matters is the one at the top.
  rows.sort((a, b) => b.peak - a.peak || (b.now ?? -1) - (a.now ?? -1) || a.area.localeCompare(b.area));

  return (
    // Sits on its own surface rather than floating on the sheet — px-3 not
    // px-4, because the name column is the one that pays for the padding.
    <div className="space-y-2 rounded-xl bg-bg-raised px-3 py-3">
      <div className="grid grid-cols-[1fr_96px_2rem_2rem] items-center gap-2">
        <span className="text-[0.6875rem] text-text-secondary">Pain areas</span>
        <span />
        <span className="text-center text-[0.6875rem] text-text-secondary">peak</span>
        {/* **"now" only while the attack is running.** On a finished one it
            was claiming the present tense about a reading that could be days
            old. It says "last" rather than "end" because that is what the
            column actually holds — the final *recorded* reading, which may
            sit well before the attack's end time. The same rule as the
            missing-value dash below: report what was recorded, never
            interpolate to what the attack presumably did afterwards. */}
        <span className="text-center text-[0.6875rem] text-text-secondary">
          {attack.end ? 'last' : 'now'}
        </span>
      </div>

      {rows.map((row) => {
        const peak = sevClasses(row.peak);
        const now = row.now === null ? null : sevClasses(row.now);
        return (
          <div key={row.area} className="grid grid-cols-[1fr_96px_2rem_2rem] items-center gap-2">
            {/* Just the name. A "last seen 6:28" note was here and earned
                neither the width nor the attention: the dashed tail and the
                empty now cell already say it isn't current, and the timeline
                below gives the exact time. */}
            <span className="min-w-0 truncate text-xs text-text-primary">{row.area}</span>

            <Sparkline row={row} snapshotCount={snaps.length} />

            <span className={`rounded-md py-1 text-center text-xs ${peak.bg} ${peak.text}`}>{row.peak}</span>
            {now ? (
              <span className={`rounded-md py-1 text-center text-xs ${now.bg} ${now.text}`}>{row.now}</span>
            ) : (
              // A dot here read as a speck of dirt on the screen. A short rule
              // says "no value" the way a dash does in any table, and it's the
              // same mark the sparkline uses for a stretch with no reading.
              <span className="flex items-center justify-center" title="Not recorded in the latest update">
                <span className="sr-only">Not recorded</span>
                <span aria-hidden="true" className="block h-0.5 w-3 rounded-full bg-text-secondary/50" />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Solid between consecutive readings that both recorded this area; dashed
// across a stretch where it wasn't recorded, including before the first
// mention and after the last. A solid line straight through a gap is what
// the old chart drew (`connectNulls`), and it read as a flat severity that
// nobody had actually reported.
function Sparkline({ row, snapshotCount }: { row: Row; snapshotCount: number }) {
  const segments: { d: string; gap: boolean; color?: string }[] = [];
  const first = row.points[0];
  const last = row.points[row.points.length - 1];

  if (first.i > 0) segments.push({ d: `M${PAD},${first.y} L${first.x},${first.y}`, gap: true });
  for (let k = 0; k < row.points.length - 1; k++) {
    const a = row.points[k];
    const b = row.points[k + 1];
    // A drawn segment takes the colour of the reading it arrives at, so it
    // runs into its dot in the same colour. Dashed spans stay neutral —
    // they represent no reading, and colouring them would imply a severity.
    const gap = b.i !== a.i + 1;
    segments.push({ d: `M${a.x},${a.y} L${b.x},${b.y}`, gap, color: gap ? undefined : sevFill(b.v) });
  }
  if (last.i < snapshotCount - 1) segments.push({ d: `M${last.x},${last.y} L${W - PAD},${last.y}`, gap: true });

  return (
    // Decorative: every value it encodes is printed in the two cells beside
    // it, so a screen reader gets the numbers rather than a shape.
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true" className="text-text-secondary">
      {segments.map((seg, i) => (
        <path
          key={i}
          d={seg.d}
          fill="none"
          stroke={seg.color ?? 'currentColor'}
          strokeWidth={seg.gap ? 1 : 2}
          strokeOpacity={seg.gap ? 0.45 : 0.9}
          strokeDasharray={seg.gap ? '2 3' : undefined}
          strokeLinecap="round"
        />
      ))}
      {/* One reading and nothing to join it to: a lone dot floating between
          two dashed runs reads as a smudge on the screen, so it's drawn as a
          short rule at its own level instead — the shape says "measured once,
          here" rather than "something went wrong". */}
      {row.points.length === 1 ? (
        <path
          d={`M${row.points[0].x - 5},${row.points[0].y} L${row.points[0].x + 5},${row.points[0].y}`}
          stroke={sevFill(row.points[0].v)}
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        // Every reading is one reading: the last one is not a bigger event
        // than the rest, so it doesn't get a bigger dot.
        row.points.map((p) => <circle key={p.i} cx={p.x} cy={p.y} r={2} fill={sevFill(p.v)} />)
      )}
    </svg>
  );
}
