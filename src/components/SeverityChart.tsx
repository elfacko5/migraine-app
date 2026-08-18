import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts';
import type { Attack } from '../types';
import { attackMaxSeverity } from '../utils/stats';
import { sevFill } from './headDiagram';

// Tiny trend line for the Logs list rows. The full multi-line chart that used
// to live here is gone — see SeverityBreakdown for what replaced it and why.
// This one is a single series (max severity per reading), so it never had the
// categorical-colour problem.
export function SeveritySparkline({ attack }: { attack: Attack }) {
  const data = attack.snapshots.map((s) => {
    const maxSev = Math.max(0, ...Object.values(s.areas));
    return { time: new Date(s.time).getTime(), v: maxSev };
  });
  if (data.length < 2) return null;

  return (
    // Sized in rem, not the px the chart used to be hard-coded to, so it
    // tracks the app's own text-size control like everything beside it —
    // `[data-scale]` sets the root font-size, so rem is what responds.
    <div className="h-7 w-18" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 1, bottom: 2, left: 1 }}>
          {/* **The domain is fixed to the severity scale, and has to be.**
              Without it Recharts fits each attack to its own range, so a run
              of 3→4 draws the identical slope to one of 2→9 — every line
              filling its box top to bottom regardless of what it describes.
              On a page whose whole purpose is scanning one row against the
              next, a shape that isn't comparable between rows is worse than
              no shape: it invites a comparison it can't support. Hidden, so
              it costs no width. */}
          <YAxis domain={[0, 10]} hide />
          <Line
            type="monotone"
            dataKey="v"
            // **The severity ramp, not the accent.** This was a fixed
            // `#9bb9a1` — which is the app's *low-severity* green to within a
            // few points, so a peak-10 attack drew a red badge beside a green
            // line and the row contradicted itself. The line plots the same
            // figure the badge shows, so it takes the same colour.
            stroke={sevFill(attackMaxSeverity(attack))}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
