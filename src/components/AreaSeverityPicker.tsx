import { useState } from 'react';
import {
  VIEWS, type DiagramView,
  HEAD_FILL, LINE_COLOR, DIVIDER_COLOR, DISABLED_FILL, HOVER_FILL,
  sevText, sevFill,
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
      {/* Front / Back view toggle */}
      <div className="flex justify-center">
        <div className="inline-flex gap-1 rounded-xl border border-bg-border bg-bg-raised/40 p-1">
          {VIEWS.map((v) => {
            const isActive = v.id === activeViewId;
            const n = selectedCount(v);
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setActiveViewId(v.id)}
                aria-pressed={isActive}
                className={`flex items-center gap-1.5 rounded-lg px-6 py-1.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent text-bg-base' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {v.label}
                {n > 0 && (
                  <span
                    className={`inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[0.65rem] font-bold tabular-nums ${
                      isActive ? 'bg-bg-base/25 text-bg-base' : 'bg-accent text-bg-base'
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
    <div className="w-full max-w-[230px]">
      <div className="flex justify-between px-1 text-[0.65rem] font-medium uppercase tracking-wider text-text-secondary">
        <span>{view.sideLabels.left}</span>
        <span className="text-text-secondary/70 normal-case tracking-normal">{view.label}</span>
        <span>{view.sideLabels.right}</span>
      </div>

      <svg viewBox={view.viewBox} className="block w-full"
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

        {/* Selected zone fills — tinted by each zone's own severity */}
        {view.zones.map((z) =>
          !(z.name in value) ? null : (
            <path key={`f-${z.name}`} d={z.path} clipPath={`url(#${clip})`}
              fill={sevFill(value[z.name])} pointerEvents="none"/>
          )
        )}

        {/* Focused-area outline (the one the slider controls) */}
        {view.zones.map((z) =>
          z.name === active ? (
            <path key={`a-${z.name}`} d={z.path} clipPath={`url(#${clip})`}
              fill="none" stroke="#7fc4a0" strokeWidth={4} strokeLinejoin="round"
              pointerEvents="none"/>
          ) : null
        )}

        {/* Disabled regions (non-interactive) */}
        {view.disabled.map((d, i) => (
          <path key={`d-${i}`} d={d} fill={DISABLED_FILL} fillOpacity={0.62}
            pointerEvents="none"/>
        ))}

        {/* Feature details (lips) */}
        {view.details.map((d, i) => (
          <path key={`det-${i}`} d={d} clipPath={`url(#${clip})`}
            fill="none" stroke="rgba(20,24,34,0.7)" strokeWidth={2.5}
            strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"/>
        ))}

        {/* Dashed section dividers */}
        {view.dividers.map((d, i) => (
          <path key={`v-${i}`} d={d} clipPath={`url(#${clip})`}
            fill="none" stroke={DIVIDER_COLOR} strokeWidth={2.4}
            strokeDasharray="1 9" strokeLinecap="round" pointerEvents="none"/>
        ))}

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
              fontSize={20} fontFamily="system-ui,sans-serif"
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
                fill="#0d0f14" stroke={isActive ? '#7fc4a0' : sevFill(s)}
                strokeWidth={isActive ? 3 : 2.5}/>
              <text x={cx} y={cy + 6} textAnchor="middle"
                fontSize={18} fontFamily="system-ui,sans-serif" fontWeight="700"
                fill="#dde1eb">{s}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
