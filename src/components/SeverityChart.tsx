import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { Attack } from '../types';
import { formatTime } from '../utils/format';

// Desaturated, distinguishable palette for per-area lines. Warm and
// low-saturation throughout — sage, clay, ochre — because saturated blue is
// the worst hue for photophobia and the old set ran through three blue-greys.
// Mirrors the CSS tokens by hand: a presentation attribute can't read var().
const AREA_COLORS: Record<string, string> = {
  'Forehead left':  '#9bb9a1', 'Forehead right': '#7fa187',
  'Temple left':    '#c4b07f', 'Temple right':   '#a89769',
  'Eye left':       '#b07a3c', 'Eye right':      '#c99a5e',
  'Nose':           '#9a9384',
  'Cheek left':     '#a65a52', 'Cheek right':    '#c17f77',
  'Jaw left':       '#b08a70', 'Jaw right':      '#93705c',
  'Crown left':     '#a9bfad', 'Crown right':    '#6e8b74',
  'Occiput left':   '#8e8a7e', 'Occiput right':  '#77716a',
  'Nape left':      '#87a98f', 'Nape right':     '#5f7a66',
};

function getColor(area: string): string {
  return AREA_COLORS[area] ?? '#a39d92';
}

interface Props {
  attack: Attack;
  height?: number;
}

// Recharts' own ResponsiveContainer sizes itself from `getBoundingClientRect()`,
// which is measured through every ancestor transform. `Sheet`'s panel animates
// in on `translate-y-full → translate-y-0`, so a chart mounted inside it is
// measured mid-transform — and on WebKit that first read can come back 0.
// Nothing resizes afterwards (the element really was its final width all
// along), so the ResizeObserver never fires a correction and the chart stays
// unpainted: reserved height, no lines. Opening the same attack from Logs
// happened to measure late enough to get a real number; from the Today card it
// didn't, which is why one entry point drew the chart and the other didn't.
//
// `clientWidth` is the layout box and ignores ancestor transforms entirely, so
// it reads the true width whatever the animation is doing. The extra
// post-layout re-measure covers a mount that lands before layout has settled.
function useMeasuredWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  // A width of 0 after layout means the read itself was wrong, not that the
  // element is genuinely collapsed — retry once past the sheet's 300ms open
  // transition rather than leaving a permanently blank chart.
  useEffect(() => {
    if (width > 0) return;
    const t = setTimeout(() => setWidth(ref.current?.clientWidth ?? 0), 350);
    return () => clearTimeout(t);
  }, [width]);

  return { ref, width };
}

export function SeverityChart({ attack, height = 200 }: Props) {
  const { ref, width } = useMeasuredWidth();
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
    <div ref={ref} style={{ overflowX: 'hidden' }}>
    {width > 0 && (
    <LineChart data={data} width={width} height={showLegend ? height + 28 : height} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
        <XAxis
          dataKey="time"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(v) => formatTime(new Date(v).toISOString())}
          tick={{ fill: '#a39d92', fontSize: '0.6875rem' }}
          axisLine={false}
          tickLine={false}
          scale="time"
        />
        <YAxis
          domain={[0, 10]}
          ticks={[0, 2, 4, 6, 8, 10]}
          tick={{ fill: '#a39d92', fontSize: '0.6875rem' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{ background: '#302d29', border: '1px solid #3a3733', borderRadius: 8, fontSize: '0.75rem' }}
          labelFormatter={(v) => formatTime(new Date(Number(v)).toISOString())}
          labelStyle={{ color: '#a39d92' }}
          itemStyle={{ color: '#e4dfd6' }}
        />
        {medEvents.map((s, i) => (
          <ReferenceLine
            key={i}
            x={new Date(s.time).getTime()}
            stroke="#7fa187"
            strokeDasharray="4 2"
            label={{ value: `💊 ${s.medication?.name}`, position: 'top', fill: '#9bb9a1', fontSize: '0.625rem' }}
          />
        ))}
        {/* Animation off, everywhere a Line is drawn. Recharts paints the
            line by growing its `stroke-dasharray` from 0 to the path length,
            and here that animation started and never finished — the geometry
            was right (`M40,33.2 L335,33.2`) while the dash stayed at
            `11.32px 295px`, so the dots appeared at both ends with 11px of a
            295px line between them. The sparkline in the Logs list was stuck
            at `0px` and drew no line at all. A chart read mid-migraine has
            nothing to gain from drawing itself in anyway. */}
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
            isAnimationActive={false}
          />
        ))}
        {showLegend && (
          <Legend
            verticalAlign="bottom"
            height={24}
            wrapperStyle={{ fontSize: '0.6875rem' }}
            formatter={(value) => <span style={{ color: '#e4dfd6' }}>{value}</span>}
          />
        )}
    </LineChart>
    )}
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
        <Line type="monotone" dataKey="v" stroke="#9bb9a1" strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
