import { useState } from 'react';

interface Props {
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}

// ── Head shape (front view) ──────────────────────────────────────────────
const HEAD = 'M 140 26 C 210 26 258 80 258 152 C 258 210 238 256 208 272 C 192 281 167 286 140 286 C 113 286 88 281 72 272 C 42 256 22 210 22 152 C 22 80 70 26 140 26 Z';

// ── Severity helpers (using actual theme hex values) ─────────────────────
function sevFill(s: number): string {
  if (s <= 3) return 'rgba(90,158,122,0.28)';
  if (s <= 8) return 'rgba(201,124,42,0.30)';
  return 'rgba(184,92,92,0.38)';
}
function sevRing(s: number): string {
  if (s <= 3) return '#5a9e7a';
  if (s <= 8) return '#c97c2a';
  return '#b85c5c';
}
function sevText(s: number): string {
  if (s <= 3) return 'text-severity-low';
  if (s <= 8) return 'text-severity-mid';
  return 'text-severity-high';
}

// ── Front-view zone rects [x, y, w, h] ──────────────────────────────────
// Zones are NON-OVERLAPPING; head clipPath rounds the edges.
const ZONES: Record<string, [number, number, number, number]> = {
  'Top of head':  [0,   0,   280, 100],
  'Left temple':  [0,   100, 80,  100],
  'Forehead':     [80,  100, 120, 55 ],
  'Right temple': [200, 100, 80,  100],
  'Left eye':     [80,  155, 60,  45 ],
  'Right eye':    [140, 155, 60,  45 ],
};

// Label positions (center of the visible clipped zone area)
const LABELS: Record<string, [number, number, string]> = {
  'Top of head':  [140, 68,  'Top of head'],
  'Forehead':     [140, 133, 'Forehead'],
  'Left temple':  [48,  155, 'Temple'],
  'Right temple': [232, 155, 'Temple'],
  'Left eye':     [108, 179, 'L. Eye'],
  'Right eye':    [172, 179, 'R. Eye'],
};

export function AreaSeverityPicker({ value, onChange }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  function toggle(area: string) {
    if (area in value) {
      const next = { ...value };
      delete next[area];
      onChange(next);
    } else {
      onChange({ ...value, [area]: 5 });
    }
  }

  function setSev(area: string, s: number) {
    onChange({ ...value, [area]: s });
  }

  function zoneFill(area: string): string {
    if (area in value) return sevFill(value[area]);
    return hovered === area ? 'rgba(221,225,235,0.07)' : 'rgba(221,225,235,0.02)';
  }

  const backActive = 'Back of head' in value;
  const backSev = value['Back of head'] ?? 5;

  return (
    <div className="space-y-3">

      {/* ── Head SVG ─────────────────────────────────────────── */}
      <svg
        viewBox="0 0 280 310"
        className="block w-full max-w-[300px] mx-auto"
        aria-label="Head diagram — tap a region to select it"
      >
        <defs>
          {/* Head clip */}
          <clipPath id="hc">
            <path d={HEAD} />
          </clipPath>

          {/* Subtle radial gradient for depth */}
          <radialGradient id="hg" cx="50%" cy="42%" r="55%">
            <stop offset="0%"   stopColor="#242736" />
            <stop offset="100%" stopColor="#161820" />
          </radialGradient>
        </defs>

        {/* ── Head fill & outline ── */}
        <path d={HEAD} fill="url(#hg)" />

        {/* ── Tap zones ── */}
        {(Object.entries(ZONES) as [string, [number,number,number,number]][]).map(([area, [x, y, w, h]]) => (
          <rect
            key={area}
            x={x} y={y} width={w} height={h}
            clipPath="url(#hc)"
            fill={zoneFill(area)}
            style={{ cursor: 'pointer', transition: 'fill 0.18s ease' }}
            onClick={() => toggle(area)}
            onMouseEnter={() => setHovered(area)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}

        {/* ── Head outline (on top of zones) ── */}
        <path d={HEAD} fill="none" stroke="#2a2d3a" strokeWidth={1.5} pointerEvents="none" />

        {/* ── Zone separator lines ── */}
        {([
          [0,   100, 280, 100],   // hairline (h)
          [80,  100, 80,  200],   // L-temple right edge (v)
          [200, 100, 200, 200],   // R-temple left edge (v)
          [80,  155, 200, 155],   // eyebrow line (h)
          [140, 155, 140, 200],   // eye midline (v)
        ] as [number,number,number,number][]).map(([x1,y1,x2,y2], i) => (
          <line key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            clipPath="url(#hc)"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={0.8}
            strokeDasharray="4 3"
            pointerEvents="none"
          />
        ))}

        {/* ── Ears (decorative) ── */}
        <path
          d="M 23 148 C 12 154 9 164 10 174 C 11 184 17 190 23 188 L 23 148 Z"
          fill="#1a1c28" stroke="#2a2d3a" strokeWidth={1.2}
          pointerEvents="none"
        />
        <path
          d="M 257 148 C 268 154 271 164 270 174 C 269 184 263 190 257 188 L 257 148 Z"
          fill="#1a1c28" stroke="#2a2d3a" strokeWidth={1.2}
          pointerEvents="none"
        />

        {/* ── Eyebrows ── */}
        <path d="M 86 150 Q 107 142 127 149" fill="none" stroke="rgba(221,225,235,0.22)" strokeWidth={2} strokeLinecap="round" pointerEvents="none" />
        <path d="M 153 149 Q 173 142 194 150" fill="none" stroke="rgba(221,225,235,0.22)" strokeWidth={2} strokeLinecap="round" pointerEvents="none" />

        {/* ── Eyes ── */}
        <ellipse cx={108} cy={170} rx={18} ry={10} fill="#0e1018" stroke="rgba(221,225,235,0.28)" strokeWidth={1.3} pointerEvents="none" />
        <circle cx={108} cy={170} r={5.5} fill="rgba(90,80,140,0.55)" pointerEvents="none" />
        <circle cx={108} cy={170} r={2.8} fill="#080a10" pointerEvents="none" />

        <ellipse cx={172} cy={170} rx={18} ry={10} fill="#0e1018" stroke="rgba(221,225,235,0.28)" strokeWidth={1.3} pointerEvents="none" />
        <circle cx={172} cy={170} r={5.5} fill="rgba(90,80,140,0.55)" pointerEvents="none" />
        <circle cx={172} cy={170} r={2.8} fill="#080a10" pointerEvents="none" />

        {/* ── Nose ── */}
        <path d="M 140 186 L 132 212 C 130 218 138 220 140 219 C 142 220 150 218 148 212 Z"
          fill="none" stroke="rgba(221,225,235,0.13)" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round"
          pointerEvents="none"
        />

        {/* ── Mouth ── */}
        <path d="M 120 238 C 129 246 151 246 160 238"
          fill="none" stroke="rgba(221,225,235,0.18)" strokeWidth={1.6} strokeLinecap="round"
          pointerEvents="none"
        />

        {/* ── Zone labels (hidden when zone is active) ── */}
        {(Object.entries(LABELS) as [string,[number,number,string]][]).map(([area,[x,y,text]]) =>
          !(area in value) && (
            <text
              key={area}
              x={x} y={y}
              textAnchor="middle"
              fontSize={8.5}
              fontFamily="system-ui,sans-serif"
              fill="rgba(125,133,153,0.7)"
              pointerEvents="none"
            >
              {text}
            </text>
          )
        )}

        {/* ── Selection indicators ── */}
        {(Object.entries(ZONES) as [string,[number,number,number,number]][]).map(([area,[x,y,w,h]]) =>
          (area in value) && (
            <g key={`sel-${area}`} clipPath="url(#hc)" pointerEvents="none">
              <circle cx={x + w/2} cy={y + h/2} r={8} fill={sevRing(value[area])} opacity={0.9} />
              <text
                x={x + w/2} y={y + h/2 + 4}
                textAnchor="middle"
                fontSize={8}
                fontFamily="system-ui,sans-serif"
                fontWeight="700"
                fill="#0d0f14"
              >
                {value[area]}
              </text>
            </g>
          )
        )}

      </svg>

      {/* ── Back of head ── */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => toggle('Back of head')}
          className="flex items-center gap-2.5 rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors"
          style={{
            borderColor: backActive ? sevRing(backSev) : '#2a2d3a',
            backgroundColor: backActive ? sevFill(backSev) : 'transparent',
            color: backActive ? '#dde1eb' : '#7d8599',
          }}
        >
          {/* Mini rear-view icon */}
          <svg width="22" height="22" viewBox="0 0 22 22">
            <ellipse cx={11} cy={10} rx={8} ry={9}
              fill={backActive ? sevFill(backSev) : 'rgba(221,225,235,0.04)'}
              stroke={backActive ? sevRing(backSev) : '#2a2d3a'}
              strokeWidth={1.2}
            />
            {/* back-of-head hair lines */}
            <path d="M 5.5 7 Q 11 4 16.5 7" fill="none" stroke={backActive ? sevRing(backSev) : 'rgba(221,225,235,0.2)'} strokeWidth={1} strokeLinecap="round" />
            <path d="M 4 11 Q 11 8.5 18 11" fill="none" stroke={backActive ? sevRing(backSev) : 'rgba(221,225,235,0.15)'} strokeWidth={0.8} strokeLinecap="round" />
            {backActive && (
              <>
                <circle cx={11} cy={10} r={3.5} fill={sevRing(backSev)} />
                <text x={11} y={13.5} textAnchor="middle" fontSize={5.5} fontFamily="system-ui,sans-serif" fontWeight="700" fill="#0d0f14">{backSev}</text>
              </>
            )}
          </svg>
          Back of head
          {backActive && (
            <span className={`text-xs font-bold tabular-nums ${sevText(backSev)}`}>{backSev}</span>
          )}
        </button>
      </div>

      {/* ── Severity sliders ── */}
      {Object.keys(value).length > 0 && (
        <div className="rounded-xl border border-bg-border overflow-hidden divide-y divide-bg-border">
          {Object.entries(value).map(([area, sev]) => (
            <div key={area} className="px-4 py-3 bg-bg-raised/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">{area}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold tabular-nums ${sevText(sev)}`}>{sev}</span>
                  <button
                    type="button"
                    onClick={() => toggle(area)}
                    className="text-text-secondary hover:text-text-primary transition-colors"
                    aria-label={`Remove ${area}`}
                  >
                    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                      <line x1="4" y1="4" x2="12" y2="12" />
                      <line x1="12" y1="4" x2="4" y2="12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-secondary w-7">Low</span>
                <input
                  type="range" min={1} max={10} step={1} value={sev}
                  onChange={(e) => setSev(area, Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-xs text-text-secondary w-12 text-right">Severe</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
