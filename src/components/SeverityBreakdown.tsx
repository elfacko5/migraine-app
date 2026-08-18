import type { Attack } from '../types';
import { formatTime } from '../utils/format';
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
  /** Time of the last reading that did record it — shown when `now` is null. */
  lastSeen: string;
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
      lastSeen: snaps[last.i].time,
      points,
    };
  });

  // Worst first: the row that matters is the one at the top.
  rows.sort((a, b) => b.peak - a.peak || (b.now ?? -1) - (a.now ?? -1) || a.area.localeCompare(b.area));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_96px_2.25rem_2.25rem] items-center gap-2">
        <span />
        <span />
        <span className="text-center text-xs text-text-secondary">peak</span>
        <span className="text-center text-xs text-text-secondary">now</span>
      </div>

      {rows.map((row) => {
        const peak = sevClasses(row.peak);
        const now = row.now === null ? null : sevClasses(row.now);
        return (
          <div key={row.area} className="grid grid-cols-[1fr_96px_2.25rem_2.25rem] items-center gap-2">
            {/* Two lines rather than one: at 375px "Nape right · last 11:28"
                truncated the clock time away, which is the one thing the note
                is there to say. */}
            <span className="min-w-0">
              <span className="block truncate text-sm text-text-primary">{row.area}</span>
              {row.now === null && (
                <span className="block truncate text-xs text-text-secondary">last {formatTime(row.lastSeen)}</span>
              )}
            </span>

            <Sparkline row={row} snapshotCount={snaps.length} />

            <span className={`rounded-md py-1 text-center text-sm ${peak.bg} ${peak.text}`}>{row.peak}</span>
            {now ? (
              <span className={`rounded-md py-1 text-center text-sm ${now.bg} ${now.text}`}>{row.now}</span>
            ) : (
              <span className="text-center text-sm text-text-secondary" title="Not recorded in the latest update">·</span>
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
  const segments: { d: string; gap: boolean }[] = [];
  const first = row.points[0];
  const last = row.points[row.points.length - 1];

  if (first.i > 0) segments.push({ d: `M${PAD},${first.y} L${first.x},${first.y}`, gap: true });
  for (let k = 0; k < row.points.length - 1; k++) {
    const a = row.points[k];
    const b = row.points[k + 1];
    segments.push({ d: `M${a.x},${a.y} L${b.x},${b.y}`, gap: b.i !== a.i + 1 });
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
          stroke="currentColor"
          strokeWidth={seg.gap ? 1 : 2}
          strokeOpacity={seg.gap ? 0.45 : 0.9}
          strokeDasharray={seg.gap ? '2 3' : undefined}
          strokeLinecap="round"
        />
      ))}
      {row.points.map((p) => (
        <circle key={p.i} cx={p.x} cy={p.y} r={p.i === last.i ? 2.5 : 1.6} fill={sevFill(p.v)} />
      ))}
    </svg>
  );
}
