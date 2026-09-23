import { SideLabel } from './SideLabel';
import {
  VIEWS, type DiagramView,
  HEAD_FILL, LINE_COLOR, DETAIL_COLOR, DISABLED_LINE,
} from './headDiagram';

export interface AreaStat {
  area: string;
  value: number;
}

interface Props {
  data: AreaStat[];
}

// A single neutral tint, scaled by opacity — not the low/mid/high severity
// ramp this used to borrow (2026-09-23, Sunny's call). That ramp means *pain
// severity* everywhere else it appears (Logs, SeverityBreakdown, the picker),
// and reusing it here for *how often an area comes up* put two different
// variables behind the same colours — a red zone here didn't mean what a red
// zone means anywhere else in the app. Every zone already prints its exact
// count, so the fill only ever has to support scanning for hot spots at a
// glance, which one hue at varying strength does without implying a second
// meaning. It also drops the "Less…More attacks" legend below the heads —
// that existed to explain the gradient, and a fill with only one hue needs no
// explaining once the numbers are already exact.
const HEAT_RGB: [number, number, number] = [205, 199, 187]; // --color-text-primary
const HEAD_RGB: [number, number, number] = [43, 40, 35]; // HEAD_FILL, as an rgb triple

function tileOpacity(t: number): number {
  return 0.2 + t * 0.5;
}

// The exact blended colour of a tile at a given frequency — what the fill
// path two elements up actually paints on screen at that opacity. Shared by
// `tileFillColor` (the count's knockout patch, see `CountLabel`) and
// `countTextFill` below, so the two can never disagree about what a tile
// actually looks like.
function tileBgRgb(t: number): [number, number, number] {
  const a = tileOpacity(t);
  return HEAD_RGB.map((c, i) => Math.round(c + (HEAT_RGB[i] - c) * a)) as [number, number, number];
}
function tileFillColor(t: number): string {
  const [r, g, b] = tileBgRgb(t);
  return `rgb(${r},${g},${b})`;
}

// WCAG relative luminance / contrast ratio — the same formula the palette's
// own AA measurements in docs/palette.md were taken with.
function relLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrastRatio(l1: number, l2: number): number {
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// The count text was a fixed light colour — #cdc7bb, which *is* the heat
// tint's own colour — so on a busy zone the digit and its own background
// converged on the same value and nearly vanished (caught on device,
// 2026-09-23: the "5×" tile). Picking the text colour by a flat opacity
// threshold isn't enough to fix that on its own: the crossover where a dark
// digit reads better than a light one lands well before the tile itself
// looks "light" to the eye (measured — a mid-tone tile at t≈0.4 already
// favours dark text by a hair, and a fixed guess landed on the wrong side of
// that). So it's measured per tile instead — whichever of the two contrasts
// higher against that tile's own blended colour wins.
const COUNT_TEXT_LIGHT = '#cdc7bb';
const COUNT_TEXT_LIGHT_RGB: [number, number, number] = [205, 199, 187];
const COUNT_TEXT_DARK = '#1b1a18';
const COUNT_TEXT_DARK_RGB: [number, number, number] = [27, 26, 24];
function countTextFill(t: number): string {
  const bgLum = relLuminance(tileBgRgb(t));
  const lightContrast = contrastRatio(bgLum, relLuminance(COUNT_TEXT_LIGHT_RGB));
  const darkContrast = contrastRatio(bgLum, relLuminance(COUNT_TEXT_DARK_RGB));
  return darkContrast > lightContrast ? COUNT_TEXT_DARK : COUNT_TEXT_LIGHT;
}

export function HeadHeatmap({ data }: Props) {
  const maxVal = Math.max(1, ...data.map((d) => d.value));
  const byArea = Object.fromEntries(data.map((d) => [d.area, d.value]));
  // Skip a whole view (front or back) when nothing in the selected period
  // touched any of its zones — an empty illustration is just dead space.
  const visibleViews = VIEWS.filter((view) => view.zones.some((z) => (byArea[z.name] ?? 0) > 0));

  return (
    <div className="flex flex-col items-center gap-5">
      {visibleViews.map((view) => (
        <HeatView key={view.id} view={view} byArea={byArea} maxVal={maxVal} />
      ))}
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
    // Labels beside the head, not above it, and no view name — see the
    // matching note in AreaSeverityPicker. Here the view is named by the
    // heading over the whole section instead of a control.
    <div className="flex w-full items-center justify-center gap-2">
      {/* Equal-width sides — see `SideLabel`. Here the two heads are stacked
          and visible at once, so the mismatch showed as one sitting off-centre
          from the other rather than as a jump. */}
      <SideLabel labels={view.sideLabels} side="left"
        className="text-[0.6rem] font-medium uppercase tracking-wider text-text-secondary"/>

      <svg viewBox={view.viewBox} className="block w-full max-w-[190px]"
        aria-label={`${view.label} pain area heatmap`}>
        <defs>
          <clipPath id={clip}>
            {view.base.map((d, i) => <path key={i} d={d}/>)}
          </clipPath>
        </defs>

        {/* **No disabled hatch on the ears and neck, unlike the picker**
            (2026-09-23, Sunny's call, same reasoning as dropping the
            dividers). The recessed texture exists there to say "you can't
            tap this" — a distinction that means nothing on a diagram with no
            tap targets at all. Flat `HEAD_FILL`, the same ground every
            zone with nothing to report already sits on, so the ears and neck
            read as ordinary head rather than a separately-textured region
            nobody's asked to interpret. */}
        {view.base.concat(view.inert).map((d, i) => (
          <path key={`g-${i}`} d={d} fill={HEAD_FILL}/>
        ))}
        {view.zones.map((z) => (
          <path key={`b-${z.name}`} d={z.path} clipPath={`url(#${clip})`}
            fill={HEAD_FILL} stroke={HEAD_FILL} strokeWidth={1.5}
            pointerEvents="none"/>
        ))}

        {/* Heat fills */}
        {view.zones.map((z) => {
          const tv = t(z.name);
          if (tv === 0) return null;
          return (
            <path key={`f-${z.name}`} d={z.path} clipPath={`url(#${clip})`}
              fill={`rgb(${HEAT_RGB.join(',')})`} fillOpacity={tileOpacity(tv)} pointerEvents="none"/>
          );
        })}

        {/* Features, above the heat fills — the two diagrams share geometry
            and have to look like the same head. See AreaSeverityPicker. */}
        {view.details.map((d, i) => (
          <path key={`x-${i}`} d={d} clipPath={`url(#${clip})`}
            fill="none" stroke={DETAIL_COLOR} strokeWidth={1.8}
            strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"/>
        ))}

        {/* **No dividers here, unlike the picker** (2026-09-23, Sunny's
            call — she caught them crossing straight over a filled tile and
            competing with its count). `DIVIDER_COLOR` is protected in
            `headDiagram.ts` at 3.15:1 specifically because it's the line
            that says where one *tappable* region ends and the next begins —
            a WCAG 1.4.11 requirement for a control. This diagram has no
            controls; nothing here is tapped. A filled zone's boundary is
            already visible as the seam between its own tint and its
            neighbour's, and an unfilled zone has nothing to report, so
            there's nothing a boundary line would need to distinguish. */}

        {/* Inert edges, then the selectable body's silhouette */}
        {view.inert.map((d, i) => (
          <path key={`i-${i}`} d={d} fill="none" stroke={DISABLED_LINE}
            strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"/>
        ))}
        {view.outline.map((d, i) => (
          <path key={`o-${i}`} d={d} fill="none" stroke={LINE_COLOR}
            strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"/>
        ))}

        {/* Counts — show labels only on the sparse (back) view; otherwise just counts */}
        {view.zones.map((z) => {
          const count = byArea[z.name] ?? 0;
          const [cx, cy] = z.center;
          const tv = t(z.name);
          if (!view.showLabels) {
            if (count === 0) return null;
            return <CountLabel key={`c-${z.name}`} cx={cx} cy={cy + 7} t={tv} count={count} fontSize={20}/>;
          }
          return (
            <g key={`c-${z.name}`} pointerEvents="none">
              <text x={cx} y={cy} textAnchor="middle" fontSize={18}
                fontFamily="Lexend, system-ui, sans-serif"
                fill={countTextFill(tv)}>
                {z.label}
              </text>
              {count > 0 && <CountLabel cx={cx} cy={cy + 22} t={tv} count={count} fontSize={22}/>}
            </g>
          );
        })}
      </svg>

      <SideLabel labels={view.sideLabels} side="right"
        className="text-[0.6rem] font-medium uppercase tracking-wider text-text-secondary"/>
    </div>
  );
}

// A count, on a solid knockout of the tile's own colour rather than straight
// on top of the fill. Without it the count sits over whatever the zone's own
// geometry draws there — the Eye zone's closed-eyelid stroke is the case that
// caught this — and a line crossing directly behind a digit competes with it
// even where the two don't share a colour. The patch is filled with
// `tileFillColor`, the exact blend the fill path underneath already paints at
// that opacity, so it reads as part of the tile rather than as a new shape
// arriving on top of it.
function CountLabel({ cx, cy, t, count, fontSize }: {
  cx: number; cy: number; t: number; count: number; fontSize: number;
}) {
  const text = `${count}×`;
  const w = text.length * fontSize * 0.62 + 8;
  const h = fontSize * 0.85;
  return (
    <g pointerEvents="none">
      <rect x={cx - w / 2} y={cy - h * 0.7} width={w} height={h} rx={h / 2}
        fill={tileFillColor(t)}/>
      <text x={cx} y={cy} textAnchor="middle" fontSize={fontSize}
        fontFamily="Lexend, system-ui, sans-serif" fontWeight="700" fill={countTextFill(t)}>
        {text}
      </text>
    </g>
  );
}
