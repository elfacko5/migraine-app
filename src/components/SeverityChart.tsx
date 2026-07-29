import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { Attack } from '../types';
import { formatTime } from '../utils/format';

// Desaturated, distinguishable palette for per-area lines — drawn only from
// the brand hues (green / amber-tan / red / gray); no blue, violet or purple.
const AREA_COLORS: Record<string, string> = {
  'Forehead left':  '#7fc4a0', 'Forehead right': '#5a9e7a',
  'Temple left':    '#c4b07f', 'Temple right':   '#d2c29a',
  'Eye left':       '#c97c2a', 'Eye right':      '#b8924a',
  'Nose':           '#9aa3b5',
  'Cheek left':     '#b85c5c', 'Cheek right':    '#cc7e7e',
  'Jaw left':       '#c4807f', 'Jaw right':      '#a85a5a',
  'Crown left':     '#9ad0b0', 'Crown right':    '#6fb38e',
  'Occiput left':   '#aab0c0', 'Occiput right':  '#8a93a8',
  'Nape left':      '#87c9a6', 'Nape right':     '#7d8599',
};

function getColor(area: string): string {
  return AREA_COLORS[area] ?? '#7d8599';
}

interface Props {
  attack: Attack;
  height?: number;
}

export function SeverityChart({ attack, height = 200 }: Props) {
  const data = attack.snapshots.map((s) => ({
    time: new Date(s.time).getTime(),
    ...s.areas,
    _med: s.medication?.name ?? null,
  }));

  const activeAreas = [
    ...new Set(attack.snapshots.flatMap((s) => Object.keys(s.areas))),
  ];
  const medEvents = attack.snapshots.filter((s) => s.medication?.name);
  // A legend only earns its space when there's more than one line to tell apart.
  const showLegend = activeAreas.length > 1;

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-bg-raised/60 text-text-secondary text-sm" style={{ minHeight: height }}>
        Add another update to see the chart.
      </div>
    );
  }

  return (
    // Clips the chart's negative left margin (used to pull the Y-axis in)
    // so it can never register as extra horizontal scroll width on the page —
    // that overflow was making the whole sheet scrollable sideways on iOS.
    <div style={{ overflowX: 'hidden' }}>
    <ResponsiveContainer width="100%" height={showLegend ? height + 28 : height}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
        <XAxis
          dataKey="time"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(v) => formatTime(new Date(v).toISOString())}
          tick={{ fill: '#7d8599', fontSize: '0.6875rem' }}
          axisLine={false}
          tickLine={false}
          scale="time"
        />
        <YAxis
          domain={[0, 10]}
          ticks={[0, 2, 4, 6, 8, 10]}
          tick={{ fill: '#7d8599', fontSize: '0.6875rem' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{ background: '#1e2028', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: '0.75rem' }}
          labelFormatter={(v) => formatTime(new Date(Number(v)).toISOString())}
          labelStyle={{ color: '#7d8599' }}
          itemStyle={{ color: '#dde1eb' }}
        />
        {medEvents.map((s, i) => (
          <ReferenceLine
            key={i}
            x={new Date(s.time).getTime()}
            stroke="#5a9e7a"
            strokeDasharray="4 2"
            label={{ value: `💊 ${s.medication?.name}`, position: 'top', fill: '#7fc4a0', fontSize: '0.625rem' }}
          />
        ))}
        {activeAreas.map((area) => (
          <Line
            key={area}
            type="monotone"
            dataKey={area}
            stroke={getColor(area)}
            strokeWidth={2}
            dot={{ r: 3, fill: getColor(area) }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
        {showLegend && (
          <Legend
            verticalAlign="bottom"
            height={24}
            wrapperStyle={{ fontSize: '0.6875rem' }}
            formatter={(value) => <span style={{ color: '#dde1eb' }}>{value}</span>}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
    </div>
  );
}

// Tiny sparkline for attack cards.
export function SeveritySparkline({ attack }: { attack: Attack }) {
  const data = attack.snapshots.map((s) => {
    const maxSev = Math.max(0, ...Object.values(s.areas));
    return { time: new Date(s.time).getTime(), v: maxSev };
  });
  if (data.length < 2) return null;

  return (
    <ResponsiveContainer width={72} height={28}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="v" stroke="#7fc4a0" strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
