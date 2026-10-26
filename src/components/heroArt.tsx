// The Today hero's artwork, drawn rather than shipped as a picture.
//
// It replaced two JPEGs (2026-10-26) that were night-toned and composed for
// the dark page: in light mode they read as a dark rectangle dropped into the
// screen, and the CSS filter that softened them was a stopgap. Flat shapes
// filled from `--color-ill-1` / `--color-ill-2` follow the theme by
// construction, so there is nothing to filter and nothing to re-export.
//
// **No background plate.** Every shape sits straight on the page, which is
// why `HomeCard`'s gradients can still fade from `bg-bg-base` and leave no
// seam: there is no picture-edge for them to cover except the box itself.
//
// `xMaxYMid slice` keeps the right edge, which is what both pieces are
// composed against — the box is right-aligned and its left side runs under the
// headline's fade.

interface Props { className?: string }

function art(className: string | undefined, children: React.ReactNode) {
  return (
    <svg
      viewBox="0 0 250 268"
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

/** Sun, leaf and hill — between attacks. */
export function AttackFreeArt({ className }: Props) {
  return art(className, <>
    <circle cx="140" cy="128" r="74" fill="var(--color-ill-1)" fillOpacity="0.22" />
    <circle cx="140" cy="128" r="42" fill="var(--color-ill-1)" fillOpacity="0.85" />
    <path d="M196 48c26-8 48 10 44 35-3 22-24 27-37 17-13-10-22-43-7-52z" fill="var(--color-ill-2)" />
    <path d="M30 268c14-46 80-74 220-64v64z" fill="var(--color-ill-1)" fillOpacity="0.45" />
  </>);
}

/** Calm concentric rings — during an attack. Still, never animated. */
export function OngoingArt({ className }: Props) {
  return art(className, <>
    <circle cx="150" cy="134" r="112" fill="none" stroke="var(--color-ill-1)" strokeOpacity="0.18" strokeWidth="14" />
    <circle cx="150" cy="134" r="80" fill="none" stroke="var(--color-ill-1)" strokeOpacity="0.32" strokeWidth="12" />
    <circle cx="150" cy="134" r="50" fill="none" stroke="var(--color-ill-1)" strokeOpacity="0.5" strokeWidth="10" />
    <circle cx="150" cy="134" r="24" fill="var(--color-ill-1)" fillOpacity="0.85" />
    <path d="M150 22a112 112 0 0 1 104 70" fill="none" stroke="var(--color-ill-2)" strokeWidth="14" strokeLinecap="round" />
  </>);
}
