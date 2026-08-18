// The severity ramp as Tailwind classes. `sevFill` in `components/headDiagram.ts`
// is the same three bands as literal hex, because an SVG presentation attribute
// can't read a `var()` — these two must always agree.
//
// It lives here because the boundaries had been hand-copied into three separate
// files and **two of the three had drifted to the wrong one**: both the Logs
// card badge and the timeline row used `<= 8` for the middle band, so a
// severity 8 rendered amber in those two places and terracotta everywhere else
// — on the single line each of those components exists to be scanned for.
//
// Add a fourth call site by importing from here, never by copying the numbers.
// Exported because the Logs filter offers severity as three bands and has to
// cut them at the same places the colours do — a "high" filter that disagreed
// with the red badge would be indefensible.
export const MID_MAX = 7;
export const LOW_MAX = 3;

/** Severity as text colour — the timeline's per-area line. */
export function sevTextClass(s: number): string {
  if (s <= LOW_MAX) return 'text-severity-low';
  if (s <= MID_MAX) return 'text-severity-mid';
  return 'text-severity-high';
}

/** Severity as a filled badge — the Logs list's peak-severity chip. */
export function sevBadgeClass(s: number): string {
  if (s <= LOW_MAX) return 'bg-severity-low/20 text-severity-low border-severity-low/30';
  if (s <= MID_MAX) return 'bg-severity-mid/20 text-severity-mid border-severity-mid/30';
  return 'bg-severity-high/20 text-severity-high border-severity-high/30';
}
