import { useState } from 'react';
import { SideLabel } from './SideLabel';
import { useUiTheme } from '../hooks/useUiTheme';
import { CHIP_ON } from '../utils/chipStyles';

// See the comment on the severity grid below for why this isn't `CHIP_OFF`.
const SEV_CELL_OFF =
  'bg-bg-elevated text-text-primary ring-1 ring-inset ring-bg-elevated';
import {
  VIEWS, type DiagramView,
  headFill, lineColor, dividerColor, detailColor, disabledFill, disabledHatch,
  disabledLine, hoverFill, badgeFill, badgeText,
  sevFill, sevStroke,
} from './headDiagram';

const SEVERITIES = Array.from({ length: 10 }, (_, i) => i + 1);

interface Props {
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  /** How each area stood at the last reading — the update flow's own "the
   *  severity control shows how that area was last logged, inline" rule
   *  (docs/redesign-v4-diff.md A2, rejecting the board's single-worst-area
   *  card but keeping this one piece of it). Purely a reference: the area
   *  still starts unselected and the value is never pre-filled from it. */
  previousValue?: Record<string, number>;
}

export function AreaSeverityPicker({ value, onChange, previousValue }: Props) {
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
      {/* Front / Back view toggle. Same shape as `SegmentedControl` — filled
          track, 44px segments, accent-bordered tinted selected state —
          matched by hand rather than shared because this one carries a count
          badge the generic component doesn't need (v4 sweep, 2026-11-24, see
          `SegmentedControl`'s own note).
          **Full width, not hugging the labels** (v4 fix, 2026-11-25): the
          `23-live`/`09-insights` boards both draw `.segs` as a block with no
          `max-width`, so it stretches to the row and its two `.seg` children
          split it evenly — this is `SegmentedControl`'s own `fill` mode, just
          not wired up here since the hand-copy predates that prop. Font size
          was also `text-xs` (12px), under both the board's own 16px `.seg`
          and CLAUDE.md's body floor — not a deliberate exception like
          `SegmentedControl`'s four-option row, which has that comment and
          this didn't.
          **Track is `bg-bg-raised`, not `bg-bg-surface`** (June's report,
          2026-11-25): every call site renders this inside a `flush
          bareHeader` Sheet, and the sheet's own root is already
          `bg-bg-surface` (`Sheet.tsx`) — same tone on same tone had zero
          contrast, so the track (and the unselected "Back" segment sitting
          on it) read as floating text with no box at all. Same "one surface
          up from what it sits on" rule as the flow-header circle buttons. */}
      <div className="flex w-full items-center gap-1 rounded-control-lg bg-bg-raised p-1">
        {VIEWS.map((v) => {
            const isActive = v.id === activeViewId;
            const n = selectedCount(v);
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setActiveViewId(v.id)}
                aria-pressed={isActive}
                // `--color-selected-fill` tint plus an accent border, not the
                // solid accent fill — solid means "press this to act" and
                // this is a switch between two views of one step. Text stays
                // primary, not accent-light (pattern library, 2026-11-23 —
                // see chipStyles.ts).
                className={`tap-44-y flex flex-1 min-h-target items-center justify-center gap-1.5 rounded-segment border px-4 text-base font-medium transition-colors ${
                  isActive ? 'border-accent bg-selected-fill text-text-primary font-semibold' : 'border-transparent text-text-secondary hover:text-text-primary'
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

      {/* Single severity card — follows the focused area. Matched against
          the board's own severity card (`23-live/Live23WhereDark`,
          `.grp .rw`): solid `bg-bg-raised` card at `rounded-card`, no border
          — not the translucent-outlined `rounded-control` box this drew
          before, which read as an empty outline rather than a card-on-card
          surface. Header is name (+ "was X") against a plain "Remove" text
          link, not an icon button — the board never uses an icon here. */}
      {active && (
        <div className="rounded-card bg-bg-raised px-4 py-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-base font-semibold text-text-primary">
              {active}
              {previousValue?.[active] !== undefined && (
                <span className="ml-1.5 font-normal text-text-secondary">· was {previousValue[active]}</span>
              )}
            </span>
            <button type="button" onClick={removeActive}
              className="tap-44-y shrink-0 text-base font-medium text-accent-light hover:text-accent transition-colors"
              aria-label={`Remove ${active}`}>
              Remove
            </button>
          </div>
          {/* Button grid, not a slider (pattern library, 2026-11-24) — the
              redesign's `UpdNowDark` board draws each value as its own tap
              target rather than a point on a continuous track. 1-10, not the
              design's 0-10 (June's call, 2026-11-25): every area that's
              selected already carries a severity (defaulted to 5), so there's
              no "unset" state for a 0 cell to mean — kept deliberately unlike
              every other piece of this card, which now matches the board.
              Previous value marked with a dashed outline (outline, not a
              ring — it's already carrying the selection ring) rather than
              redrawn as selected.
              Unselected cells are one surface step above the card
              (`bg-elevated`), not `CHIP_OFF`'s `bg-raised`: the board draws
              each cell as a visible tile on its card (`.pn` #302D29 on a
              #262421 `.grp`), and this card already *is* `bg-raised` because
              the sheet behind it is `bg-surface` — so `CHIP_OFF` made every
              unselected cell vanish into the card. Label is `text-primary`,
              as the board's `.pn` colour. */}
          <div className="grid grid-cols-5 gap-1.5" role="group"
            aria-label={`${active} severity, 1 to 10`}>
            {SEVERITIES.map((s) => {
              const isOn = value[active] === s;
              const wasThis = previousValue?.[active] === s;
              return (
                <button key={s} type="button" aria-pressed={isOn}
                  aria-label={wasThis ? `${s}, last time` : `${s}`}
                  onClick={() => setSev(s)}
                  className={`min-h-[2.875rem] rounded-control text-base font-medium tabular-nums transition-colors ${isOn ? CHIP_ON : SEV_CELL_OFF} ${
                    wasThis && !isOn ? 'outline outline-1 outline-dashed outline-border-control -outline-offset-1' : ''
                  }`}>
                  {s}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-sm text-text-secondary">
            <span>1 mild</span>
            <span>10 worst</span>
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
  const theme = useUiTheme();
  const clip = `clip-${view.id}`;
  const hatch = `hatch-${view.id}`;

  return (
    // Side labels sit beside the head rather than above it: the head is
    // narrow and the space either side was empty. The view's own name is gone
    // from here — the Front/Back control above already says which is showing.
    <div className="flex w-full items-center justify-center gap-2">
      {/* Equal-width sides — `SideLabel` exists for this and its note says why
          the obvious fixes aren't enough. */}
      <SideLabel labels={view.sideLabels} side="left"
        className="text-[0.65rem] font-medium uppercase tracking-wider text-text-secondary"/>

      {/* 230px -> 195px (2026-11-24, June's report): the diagram pushed the
          1-10 severity grid below the fold, so seeing it meant scrolling
          first. Measured on a 390×844 viewport: at 230px the severity
          card's own bottom ran ~35px past the pinned footer's top; at 195px
          it clears with ~19px to spare, so the grid is on screen as soon as
          an area is tapped. Smaller screens (iPhone SE-class, 667pt)
          still need a short scroll — shrinking further to avoid that would
          make the zones too small to tap reliably. */}
      <svg viewBox={view.viewBox} className="block w-full max-w-[195px]"
        aria-label={`${view.label} of head — tap a region to select it`}>
        <defs>
          <clipPath id={clip}>
            {view.base.map((d, i) => <path key={i} d={d}/>)}
          </clipPath>
          <pattern id={hatch} width="10" height="10" patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="10" stroke={disabledHatch(theme)} strokeWidth={2}/>
          </pattern>
        </defs>

        {/* **The ground is the disabled treatment, and the zones are painted
            back over it.** Non-selectable areas used to be an explicit list of
            paths, which meant every one had to be noticed and drawn: the back's
            jawline never was, and the front's neck needed a path computed along
            the jaw's curve so its fill didn't cover the chin. Inverted, "not
            selectable" is whatever no zone covers — true by construction, for
            this artwork and for the next one. */}
        {view.base.concat(view.inert).map((d, i) => (
          <g key={`g-${i}`}>
            <path d={d} fill={disabledFill(theme)}/>
            <path d={d} fill={`url(#${hatch})`}/>
          </g>
        ))}

        {/* The selectable body, painted back in the head colour. Stroked in
            that colour for the same reason the selected fills are — adjacent
            zone paths don't meet exactly, and the hatch would show through the
            gap as a seam. */}
        {view.zones.map((z) => (
          <path key={`b-${z.name}`} d={z.path} clipPath={`url(#${clip})`}
            fill={headFill(theme)} stroke={headFill(theme)} strokeWidth={1.5}
            pointerEvents="none"/>
        ))}

        {/* Hover highlight (selectable zones only) */}
        {view.zones.map((z) =>
          (z.name in value || hovered !== z.name) ? null : (
            <path key={`h-${z.name}`} d={z.path} clipPath={`url(#${clip})`}
              fill={hoverFill(theme)} pointerEvents="none"/>
          )
        )}

        {/* Dividers sit **below the selected fills**, so a selected zone covers
            the dashes along its own edge and reads as solid rather than as a
            translucent overlay on a grid. */}
        {view.dividers.map((d, i) => (
          <path key={`v-${i}`} d={d} clipPath={`url(#${clip})`}
            fill="none" stroke={dividerColor(theme)} strokeWidth={2.4}
            strokeDasharray="1 9" strokeLinecap="round" pointerEvents="none"/>
        ))}

        {/* Selected zone fills — tinted by each zone's own severity.
            **Each fill is also stroked in its own colour.** Adjacent zone
            paths in the exported artwork don't meet exactly: there's a
            sub-pixel gap along every shared edge. It was invisible while the
            dashed dividers painted on top of the fills, and became a ragged
            dotted seam between two selected zones the moment they moved
            underneath — the divider showing through the crack. A stroke of the
            fill colour closes it, and costs nothing where there's no
            neighbour, since the head clip trims the outer edge anyway.
            **It is 3, not the 1 the first artwork needed.** In that artwork
            the dividers were their own sparse set of lines; in this one the
            zone outlines *are* the section lines, so every dash a selected
            zone has to cover sits exactly on its own edge rather than near it,
            and a hairline left the dotted boundary visible straight through
            the fill. 3 is the divider's 2.4 plus the seam. */}
        {view.zones.map((z) =>
          !(z.name in value) ? null : (
            <path key={`f-${z.name}`} d={z.path} clipPath={`url(#${clip})`}
              fill={sevFill(value[z.name], theme)} stroke={sevFill(value[z.name], theme)}
              strokeWidth={3} strokeLinejoin="round" pointerEvents="none"/>
          )
        )}

        {/* Outline on the zone the slider controls. Its colour is a darker
            shade of that zone's *own* severity (sevStroke), not the accent —
            a green ring on an amber fill made the focused zone carry two
            unrelated colour signals, and the ring won. */}
        {view.zones.map((z) =>
          z.name === active && z.name in value ? (
            <path key={`a-${z.name}`} d={z.path} clipPath={`url(#${clip})`}
              fill="none" stroke={sevStroke(value[z.name], theme)} strokeWidth={4}
              strokeLinejoin="round" pointerEvents="none"/>
          ) : null
        )}


        {/* Features — the nostrils and the two closed eyelids.
            **Painted above the fills, so a selected zone doesn't swallow
            them.** The old artwork's one feature was a mouth, and it wasn't
            drawn at all: it was decoration on a control, sitting inside the
            one region you can't tap. These earn their place instead — the
            eyelid says which oval is the Eye, and the nose names the region
            it sits in, which is otherwise a large blank area of face. */}
        {view.details.map((d, i) => (
          <path key={`x-${i}`} d={d} clipPath={`url(#${clip})`}
            fill="none" stroke={detailColor(theme)} strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"/>
        ))}

        {/* Inert edges, dimmer and thinner than the silhouette. The fill alone
            wasn't enough: at full lineColor the ears and the neck still read
            as parts of the same drawn object as the head. */}
        {view.inert.map((d, i) => (
          <path key={`i-${i}`} d={d} fill="none" stroke={disabledLine(theme)}
            strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
            pointerEvents="none"/>
        ))}

        {/* Silhouette of the selectable body */}
        {view.outline.map((d, i) => (
          <path key={`o-${i}`} d={d} fill="none" stroke={lineColor(theme)}
            strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"
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
              fill={badgeText(theme)} pointerEvents="none">
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
                fill={badgeFill(theme)} stroke={sevFill(s, theme)}
                strokeWidth={isActive ? 3.5 : 2.5}/>
              <text x={cx} y={cy + 6} textAnchor="middle"
                fontSize={18} fontFamily="Lexend, system-ui, sans-serif" fontWeight="700"
                fill={badgeText(theme)}>{s}</text>
            </g>
          );
        })}
      </svg>

      <SideLabel labels={view.sideLabels} side="right"
        className="text-[0.65rem] font-medium uppercase tracking-wider text-text-secondary"/>
    </div>
  );
}
