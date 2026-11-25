import { SideLabel } from './SideLabel';
import { useUiTheme, type UiTheme } from '../hooks/useUiTheme';
import { VIEWS, type DiagramView, detailColor } from './headDiagram';

export interface AreaStat {
  area: string;
  value: number;
}

interface Props {
  data: AreaStat[];
}

// **One purple, stronger the more often an area came up** (Sunny,
// 2026-11-25, matching the v4 board's purple heat). The most-logged area in
// the period is the full `chart-2` purple; an area logged once is the
// faintest step; everything between is spaced evenly by count. Still one hue,
// never the severity ramp — that means *pain intensity* everywhere else, and
// this is *how often* (the 2026-09-23 reasoning still holds; only the hue
// changed from the neutral text tint to Insights' purple, which A7 allows on
// Insights). Every zone prints its exact count, so the fill only has to
// support scanning for hot spots.
//
// Values mirror `--color-chart-2` and `--color-bg-elevated` by hand, as every
// SVG here does (CLAUDE.md, "SVG/Recharts mirror tokens by hand").
const HEAT_RGB: Record<UiTheme, [number, number, number]> = {
  dark:   [171, 159, 203], // --color-chart-2, dark (#ab9fcb)
  attack: [171, 159, 203], // attack reuses dark's chart set (StatsView's CHART_COLORS)
  light:  [105, 85, 157],  // --color-chart-2, light (#69559d)
};
// **The head's own ground, with no outline** (Sunny, 2026-11-25): the
// silhouette, ears and neck are told apart from the card by fill alone —
// one surface step up from the card it sits on (`bg-elevated`), rather than
// the picker's `headFill`, which is within a shade of the card here.
const HEAD_RGB: Record<UiTheme, [number, number, number]> = {
  dark:   [56, 52, 48],    // --color-bg-elevated, dark (#383430)
  attack: [47, 42, 31],    // --color-bg-elevated, attack (#2f2a1f)
  light:  [216, 209, 195], // --color-bg-elevated, light (#d8d1c3)
};
const rgb = (c: [number, number, number]) => `rgb(${c.join(',')})`;

/** Faintest step, for an area logged once while another was logged more. */
const HEAT_FLOOR = 0.3;
function tileOpacity(t: number): number {
  return HEAT_FLOOR + t * (1 - HEAT_FLOOR);
}

// The exact blended colour of a tile at a given strength — what the fill
// path paints on screen at that opacity. Shared by `tileFillColor` (the
// count's knockout patch, see `CountLabel`) and `countTextFill` below, so the
// two can never disagree about what a tile actually looks like.
function tileBgRgb(t: number, theme: UiTheme): [number, number, number] {
  const a = tileOpacity(t);
  const head = HEAD_RGB[theme];
  const heat = HEAT_RGB[theme];
  return head.map((c, i) => Math.round(c + (heat[i] - c) * a)) as [number, number, number];
}
function tileFillColor(t: number, theme: UiTheme): string {
  return rgb(tileBgRgb(t, theme));
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
//
// **The two candidates are each theme's own near-white/near-black token**,
// not a literal white/black — `--color-bg-base` and `--color-text-primary`,
// whichever of the pair is lighter vs. darker for that theme. In dark mode
// that's text-primary (light) and bg-base (dark); in light mode the same two
// tokens swap which one is which, since light's bg-base is the near-white end
// and its text-primary is the near-black end.
const COUNT_TEXT: Record<UiTheme, { light: string; lightRgb: [number, number, number]; dark: string; darkRgb: [number, number, number] }> = {
  dark:   { light: '#cdc7bb', lightRgb: [205, 199, 187], dark: '#1b1a18', darkRgb: [27, 26, 24] },
  attack: { light: '#cdc7bb', lightRgb: [205, 199, 187], dark: '#1b1a18', darkRgb: [27, 26, 24] },
  light:  { light: '#f5f2ec', lightRgb: [245, 242, 236], dark: '#3a3733', darkRgb: [58, 55, 51] },
};
function countTextFill(t: number, theme: UiTheme): string {
  const candidates = COUNT_TEXT[theme];
  const bgLum = relLuminance(tileBgRgb(t, theme));
  const lightContrast = contrastRatio(bgLum, relLuminance(candidates.lightRgb));
  const darkContrast = contrastRatio(bgLum, relLuminance(candidates.darkRgb));
  return darkContrast > lightContrast ? candidates.dark : candidates.light;
}

export function HeadHeatmap({ data }: Props) {
  const theme = useUiTheme();
  const maxVal = Math.max(1, ...data.map((d) => d.value));
  const byArea = Object.fromEntries(data.map((d) => [d.area, d.value]));
  // Skip a whole view (front or back) when nothing in the selected period
  // touched any of its zones — an empty illustration is just dead space.
  const visibleViews = VIEWS.filter((view) => view.zones.some((z) => (byArea[z.name] ?? 0) > 0));

  return (
    <div className="flex flex-col items-center gap-5">
      {visibleViews.map((view) => (
        <HeatView key={view.id} view={view} byArea={byArea} maxVal={maxVal} theme={theme} />
      ))}
    </div>
  );
}

interface HeatViewProps {
  view: DiagramView;
  byArea: Record<string, number>;
  maxVal: number;
  theme: UiTheme;
}

function HeatView({ view, byArea, maxVal, theme }: HeatViewProps) {
  const clip = `hm-clip-${view.id}`;
  // Strength 0..1 by count: 1 at the most-logged area, 0 at a single log.
  // With every area at the same count there's nothing to rank — all full.
  const t = (area: string) => {
    const n = byArea[area] ?? 0;
    if (n === 0) return 0; // unfilled; only its label's text colour reads this
    return maxVal <= 1 ? 1 : (n - 1) / (maxVal - 1);
  };

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

        {/* Head, ears and neck as one flat ground — no hatch (nothing here
            is tapped, 2026-09-23) and no outline (2026-11-25): the fill
            alone sets the head off the card. */}
        {view.base.concat(view.inert).map((d, i) => (
          <path key={`g-${i}`} d={d} fill={rgb(HEAD_RGB[theme])}/>
        ))}

        {/* Heat fills */}
        {view.zones.map((z) => {
          if (!byArea[z.name]) return null;
          const tv = t(z.name);
          return (
            <path key={`f-${z.name}`} d={z.path} clipPath={`url(#${clip})`}
              fill={rgb(HEAT_RGB[theme])} fillOpacity={tileOpacity(tv)} pointerEvents="none"/>
          );
        })}

        {/* Features, above the heat fills — the two diagrams share geometry
            and have to look like the same head. See AreaSeverityPicker. */}
        {view.details.map((d, i) => (
          <path key={`x-${i}`} d={d} clipPath={`url(#${clip})`}
            fill="none" stroke={detailColor(theme)} strokeWidth={1.8}
            strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"/>
        ))}

        {/* **No dividers here, unlike the picker** (2026-09-23, Sunny's
            call — she caught them crossing straight over a filled tile and
            competing with its count). `dividerColor` is protected in
            `headDiagram.ts` at 3.15:1 specifically because it's the line
            that says where one *tappable* region ends and the next begins —
            a WCAG 1.4.11 requirement for a control. This diagram has no
            controls; nothing here is tapped. A filled zone's boundary is
            already visible as the seam between its own tint and its
            neighbour's, and an unfilled zone has nothing to report, so
            there's nothing a boundary line would need to distinguish. */}

        {/* Counts — show labels only on the sparse (back) view; otherwise just counts */}
        {view.zones.map((z) => {
          const count = byArea[z.name] ?? 0;
          const [cx, cy] = z.center;
          const tv = t(z.name);
          if (!view.showLabels) {
            if (count === 0) return null;
            return <CountLabel key={`c-${z.name}`} cx={cx} cy={cy + 9} t={tv} count={count} fontSize={28} theme={theme}/>;
          }
          return (
            <g key={`c-${z.name}`} pointerEvents="none">
              <text x={cx} y={cy} textAnchor="middle" fontSize={18}
                fontFamily="Lexend, system-ui, sans-serif"
                fill={countTextFill(tv, theme)}>
                {z.label}
              </text>
              {count > 0 && <CountLabel cx={cx} cy={cy + 26} t={tv} count={count} fontSize={28} theme={theme}/>}
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
function CountLabel({ cx, cy, t, count, fontSize, theme }: {
  cx: number; cy: number; t: number; count: number; fontSize: number; theme: UiTheme;
}) {
  const text = `${count}×`;
  const w = text.length * fontSize * 0.62 + 8;
  const h = fontSize * 0.85;
  return (
    <g pointerEvents="none">
      <rect x={cx - w / 2} y={cy - h * 0.7} width={w} height={h} rx={h / 2}
        fill={tileFillColor(t, theme)}/>
      <text x={cx} y={cy} textAnchor="middle" fontSize={fontSize}
        fontFamily="Lexend, system-ui, sans-serif" fontWeight="700" fill={countTextFill(t, theme)}>
        {text}
      </text>
    </g>
  );
}
