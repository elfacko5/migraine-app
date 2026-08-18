import { useState } from 'react';
import {
  VIEWS, type DiagramView,
  HEAD_FILL, LINE_COLOR, DIVIDER_COLOR, DISABLED_FILL, HOVER_FILL,
  sevText, sevFill, sevStroke,
} from './headDiagram';

interface Props {
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}

export function AreaSeverityPicker({ value, onChange }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [activeViewId, setActiveViewId] = useState<string>(VIEWS[0].id);
  const [activeArea, setActiveArea] = useState<string | null>(null);
  const activeView = VIEWS.find((v) => v.id === activeViewId) ?? VIEWS[0];

  // The single slider follows the most-recently-tapped area; if that area was
  // removed, fall back to any still-selected area.
  const active = activeArea && activeArea in value
    ? activeArea
    : (Object.keys(value)[0] ?? null);

  const selectedCount = (view: DiagramView) =>
    view.zones.filter((z) => z.name in value).length;

  // Tap an area: select + focus it; tapping the focused area again removes it;
  // tapping another already-selected area just moves the slider to it.
  function tapArea(area: string) {
    if (!(area in value)) {
      onChange({ ...value, [area]: 5 });
      setActiveArea(area);
    } else if (area === active) {
      const next = { ...value };
      delete next[area];
      onChange(next);
      setActiveArea(null);
    } else {
      setActiveArea(area);
    }
  }
  function setSev(s: number) {
    if (active) onChange({ ...value, [active]: s });
  }
  function removeActive() {
    if (!active) return;
    const next = { ...value };
    delete next[active];
    onChange(next);
    setActiveArea(null);
  }

  return (
    <div className="space-y-4">
      {/* Front / Back view toggle.
          Sized as a segmented control (32px overall), not as a pair of
          buttons: at the old height it carried the same weight as the
          wizard's primary/secondary actions and read as something to press
          to continue, rather than as a switch between two views of the same
          step. Everything here is scaled to fit that 32px — 2px of track
          padding around a 28px segment. */}
      <div className="flex justify-center">
        <div className="inline-flex h-8 items-center gap-0.5 rounded-lg border border-bg-border bg-bg-raised/40 p-0.5">
          {VIEWS.map((v) => {
            const isActive = v.id === activeViewId;
            const n = selectedCount(v);
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setActiveViewId(v.id)}
                aria-pressed={isActive}
                // Tint, not the solid accent fill — the app's rule is that
                // solid means "press this to act" and this is a switch between
                // two views of one step. No ring: the segment sits inside a
                // bordered track that already draws the boundary, and a ring
                // on top of it reads as a box in a box.
                className={`flex h-7 items-center gap-1.5 rounded-md px-4 text-xs font-medium transition-colors ${
                  isActive ? 'bg-accent/20 text-accent-light' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {v.label}
                {n > 0 && (
                  // The badge inverted against a solid segment before. On a
                  // tint it has to carry its own contrast instead, so the
                  // active one is a stronger tint of the same hue rather than
                  // page-colour text on accent.
                  <span
                    className={`inline-flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full px-1 text-[0.6rem] font-bold tabular-nums ${
                      isActive ? 'bg-accent/30 text-accent-light' : 'bg-bg-border text-text-secondary'
                    }`}
                  >
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center">
        <HeadDiagram
          view={activeView}
          value={value}
          active={active}
          hovered={hovered}
          onHover={setHovered}
          onToggle={tapArea}
        />
      </div>

      {/* Single severity slider — follows the focused area */}
      {active && (
        <div className="rounded-xl border border-bg-border bg-bg-raised/30 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary">{active}</span>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold tabular-nums ${sevText(value[active])}`}>{value[active]}</span>
              <button type="button" onClick={removeActive}
                className="text-text-secondary hover:text-text-primary transition-colors"
                aria-label={`Remove ${active}`}>
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4"
                  stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <line x1="4" y1="4" x2="12" y2="12"/>
                  <line x1="12" y1="4" x2="4" y2="12"/>
                </svg>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-7">Low</span>
            <input type="range" min={1} max={10} step={1} value={value[active]}
              onChange={(e) => setSev(Number(e.target.value))}
              className="flex-1"/>
            <span className="text-xs text-text-secondary w-12 text-right">Severe</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface DiagramProps {
  view: DiagramView;
  value: Record<string, number>;
  active: string | null;
  hovered: string | null;
  onHover: (a: string | null) => void;
  onToggle: (a: string) => void;
}

function HeadDiagram({ view, value, active, hovered, onHover, onToggle }: DiagramProps) {
  const clip = `clip-${view.id}`;

  return (
    // Side labels sit beside the head rather than above it: the head is
    // narrow and the space either side was empty. The view's own name is gone
    // from here — the Front/Back control above already says which is showing.
    <div className="flex w-full items-center justify-center gap-2">
      <span className="shrink-0 text-[0.65rem] font-medium uppercase tracking-wider text-text-secondary">
        {view.sideLabels.left}
      </span>

      <svg viewBox={view.viewBox} className="block w-full max-w-[230px]"
        aria-label={`${view.label} of head — tap a region to select it`}>
        <defs>
          <clipPath id={clip}>
            {view.base.map((d, i) => <path key={i} d={d}/>)}
          </clipPath>
        </defs>

        {/* Head base */}
        <g>
          {view.base.map((d, i) => <path key={i} d={d} fill={HEAD_FILL}/>)}
        </g>

        {/* Hover highlight (selectable zones only) */}
        {view.zones.map((z) =>
          (z.name in value || hovered !== z.name) ? null : (
            <path key={`h-${z.name}`} d={z.path} clipPath={`url(#${clip})`}
              fill={HOVER_FILL} pointerEvents="none"/>
          )
        )}

        {/* Disabled regions (non-interactive). Painted before the dividers:
            filled after them it covered the dashed lines crossing the jaw, so
            the front view lost the boundaries that say where the disabled
            region actually starts. */}
        {view.disabled.map((d, i) => (
          <path key={`d-${i}`} d={d} fill={DISABLED_FILL} pointerEvents="none"/>
        ))}

        {/* Dividers sit **above the disabled fill and below the selected
            fills**. Above, so the jaw's boundaries stay visible; below, so a
            selected zone covers the dashes along its own edge and reads as
            solid rather than as a translucent overlay on a grid. */}
        {view.dividers.map((d, i) => (
          <path key={`v-${i}`} d={d} clipPath={`url(#${clip})`}
            fill="none" stroke={DIVIDER_COLOR} strokeWidth={2.4}
            strokeDasharray="1 9" strokeLinecap="round" pointerEvents="none"/>
        ))}

        {/* Selected zone fills — tinted by each zone's own severity.
            **Each fill is also stroked in its own colour.** Adjacent zone
            paths in the exported artwork don't meet exactly: there's a
            sub-pixel gap along every shared edge. It was invisible while the
            dashed dividers painted on top of the fills, and became a ragged
            dotted seam between two selected zones the moment they moved
            underneath — the divider showing through the crack. A 1px stroke of
            the fill colour closes it, and costs nothing where there's no
            neighbour, since the head clip trims the outer edge anyway. */}
        {view.zones.map((z) =>
          !(z.name in value) ? null : (
            <path key={`f-${z.name}`} d={z.path} clipPath={`url(#${clip})`}
              fill={sevFill(value[z.name])} stroke={sevFill(value[z.name])}
              strokeWidth={1} pointerEvents="none"/>
          )
        )}

        {/* Outline on the zone the slider controls. Its colour is a darker
            shade of that zone's *own* severity (sevStroke), not the accent —
            a green ring on an amber fill made the focused zone carry two
            unrelated colour signals, and the ring won. */}
        {view.zones.map((z) =>
          z.name === active && z.name in value ? (
            <path key={`a-${z.name}`} d={z.path} clipPath={`url(#${clip})`}
              fill="none" stroke={sevStroke(value[z.name])} strokeWidth={4}
              strokeLinejoin="round" pointerEvents="none"/>
          ) : null
        )}


        {/* The mouth is no longer drawn. It was the only facial feature in a
            diagram that is otherwise a set of selectable regions, so it read
            as decoration on a control — and it sat inside the disabled jaw,
            drawing attention to the one part of the head you can't tap. The
            path data stays in `details` for the heatmap and in case it's ever
            wanted back. */}

        {/* Silhouette outline */}
        {view.outline.map((d, i) => (
          <path key={`o-${i}`} d={d} fill="none" stroke={LINE_COLOR}
            strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"
            pointerEvents="none"/>
        ))}

        {/* Click targets */}
        {view.zones.map((z) => (
          <path key={`t-${z.name}`} d={z.path} clipPath={`url(#${clip})`}
            fill="rgba(0,0,0,0)" style={{ cursor: 'pointer' }}
            onClick={() => onToggle(z.name)}
            onMouseEnter={() => onHover(z.name)}
            onMouseLeave={() => onHover(null)}/>
        ))}

        {/* Labels (unselected) — only when the view isn't too dense */}
        {view.showLabels && view.zones.map((z) => {
          if (z.name in value) return null;
          const [cx, cy] = z.center;
          return (
            <text key={`l-${z.name}`} x={cx} y={cy} textAnchor="middle"
              fontSize={20} fontFamily="Lexend, system-ui, sans-serif"
              fill="rgba(225,233,244,0.75)" pointerEvents="none">
              {z.label}
            </text>
          );
        })}

        {/* Severity badges (selected) — the focused area's badge is emphasised */}
        {view.zones.map((z) => {
          if (!(z.name in value)) return null;
          const [cx, cy] = z.center;
          const s = value[z.name];
          const isActive = z.name === active;
          return (
            <g key={`b-${z.name}`} pointerEvents="none">
              <circle cx={cx} cy={cy} r={isActive ? 18 : 16}
                fill="#1b1a18" stroke={sevFill(s)}
                strokeWidth={isActive ? 3.5 : 2.5}/>
              <text x={cx} y={cy + 6} textAnchor="middle"
                fontSize={18} fontFamily="Lexend, system-ui, sans-serif" fontWeight="700"
                fill="#e4dfd6">{s}</text>
            </g>
          );
        })}
      </svg>

      <span className="shrink-0 text-[0.65rem] font-medium uppercase tracking-wider text-text-secondary">
        {view.sideLabels.right}
      </span>
    </div>
  );
}
