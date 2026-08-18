import { LineChart, Line } from 'recharts';
import type { Attack } from '../types';

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
    <LineChart data={data} width={72} height={28}>
      <Line type="monotone" dataKey="v" stroke="#9bb9a1" strokeWidth={1.5} dot={false} isAnimationActive={false} />
    </LineChart>
  );
}
