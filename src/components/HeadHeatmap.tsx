import {
  VIEWS, type DiagramView,
  HEAD_FILL, LINE_COLOR, DIVIDER_COLOR, DISABLED_FILL,
} from './headDiagram';

export interface AreaStat {
  area: string;
  value: number;
}

interface Props {
  data: AreaStat[];
  label?: string;
}

function lerpRgb(a: [number,number,number], b: [number,number,number], t: number): [number,number,number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

const LOW:  [number,number,number] = [90,  158, 122];  // accent green
const MID:  [number,number,number] = [201, 124, 42 ];
const HIGH: [number,number,number] = [184, 92,  92 ];

function heatFill(t: number): string {
  const [r,g,b] = t < 0.5 ? lerpRgb(LOW, MID, t * 2) : lerpRgb(MID, HIGH, (t - 0.5) * 2);
  return `rgb(${r},${g},${b})`;
}

export function HeadHeatmap({ data, label = 'attacks' }: Props) {
  const maxVal = Math.max(1, ...data.map((d) => d.value));
  const byArea = Object.fromEntries(data.map((d) => [d.area, d.value]));

  return (
    <div className="space-y-3">
      <div className="flex flex-col items-center gap-5">
        {VIEWS.map((view) => (
          <HeatView key={view.id} view={view} byArea={byArea} maxVal={maxVal} />
        ))}
      </div>

      <div className="flex items-center gap-2 justify-center pt-1">
        <span className="text-[0.6rem] text-text-secondary uppercase tracking-wider">Less</span>
        <div className="h-2 w-28 rounded-full"
          style={{ background: 'linear-gradient(to right, #5a9e7a, #c97c2a, #b85c5c)' }}/>
        <span className="text-[0.6rem] text-text-secondary uppercase tracking-wider">More {label}</span>
      </div>
    </div>
  );
}

interface HeatViewProps {
  view: DiagramView;
  byArea: Record<string, number>;
  maxVal: number;
}

function HeatView({ view, byArea, maxVal }: HeatViewProps) {
  const clip = `hm-clip-${view.id}`;
  const t = (area: string) => (byArea[area] ?? 0) / maxVal;

  return (
    <div className="w-full max-w-[190px]">
      <div className="flex justify-between px-1 text-[0.6rem] font-medium uppercase tracking-wider text-text-secondary">
        <span>{view.sideLabels.left}</span>
        <span className="text-text-secondary/70 normal-case tracking-normal">{view.label}</span>
        <span>{view.sideLabels.right}</span>
      </div>

      <svg viewBox={view.viewBox} className="block w-full"
        aria-label={`${view.label} pain area heatmap`}>
        <defs>
          <clipPath id={clip}>
            {view.base.map((d, i) => <path key={i} d={d}/>)}
          </clipPath>
        </defs>

        {view.base.map((d, i) => <path key={`base-${i}`} d={d} fill={HEAD_FILL}/>)}

        {/* Heat fills */}
        {view.zones.map((z) => {
          const tv = t(z.name);
          if (tv === 0) return null;
          return (
            <path key={`f-${z.name}`} d={z.path} clipPath={`url(#${clip})`}
              fill={heatFill(tv)} fillOpacity={0.45 + tv * 0.5} pointerEvents="none"/>
          );
        })}

        {/* Disabled regions */}
        {view.disabled.map((d, i) => (
          <path key={`d-${i}`} d={d} fill={DISABLED_FILL} fillOpacity={0.5} pointerEvents="none"/>
        ))}

        {/* Feature details (lips) */}
        {view.details.map((d, i) => (
          <path key={`det-${i}`} d={d} clipPath={`url(#${clip})`}
            fill="none" stroke="rgba(20,24,34,0.7)" strokeWidth={2.5}
            strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"/>
        ))}

        {/* Dividers */}
        {view.dividers.map((d, i) => (
          <path key={`v-${i}`} d={d} clipPath={`url(#${clip})`}
            fill="none" stroke={DIVIDER_COLOR} strokeWidth={2.2}
            strokeDasharray="1 9" strokeLinecap="round" pointerEvents="none"/>
        ))}

        {/* Outline */}
        {view.outline.map((d, i) => (
          <path key={`o-${i}`} d={d} fill="none" stroke={LINE_COLOR}
            strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"/>
        ))}

        {/* Counts — show labels only on the sparse (back) view; otherwise just counts */}
        {view.zones.map((z) => {
          const count = byArea[z.name] ?? 0;
          const [cx, cy] = z.center;
          const tv = t(z.name);
          if (!view.showLabels) {
            if (count === 0) return null;
            return (
              <text key={`c-${z.name}`} x={cx} y={cy + 7} textAnchor="middle"
                fontSize={20} fontFamily="system-ui,sans-serif" fontWeight="700"
                fill="#dde1eb" pointerEvents="none">
                {count}×
              </text>
            );
          }
          return (
            <g key={`c-${z.name}`} pointerEvents="none">
              <text x={cx} y={cy} textAnchor="middle" fontSize={18}
                fontFamily="system-ui,sans-serif"
                fill={tv > 0.15 ? 'rgba(221,225,235,0.95)' : 'rgba(208,216,230,0.55)'}>
                {z.label}
              </text>
              {count > 0 && (
                <text x={cx} y={cy + 22} textAnchor="middle" fontSize={22}
                  fontFamily="system-ui,sans-serif" fontWeight="700" fill="#dde1eb">
                  {count}×
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
