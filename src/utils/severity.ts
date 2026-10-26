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

/**
 * The v3.10 shaded number (2026-10-26): a box whose fill is the accent mixed
 * into the card colour by severity — 14% at 1, 50% at 10 — so a higher peak
 * reads as a deeper tint while the number itself carries the value. One hue,
 * not the three-band ramp: on the Logs row and the detail's "Where it hurt"
 * table every box sits beside its printed number, so magnitude needs no
 * second colour system. Capped at 40% so `text-primary` on the box stays
 * readable in both themes (measured in docs/decisions.md).
 */
export function peakShade(n: number): string {
  if (n <= 0) return 'var(--color-bg-surface)';
  const pct = Math.min(40, Math.round(10 + n * 3));
  return `color-mix(in srgb, var(--color-accent) ${pct}%, var(--color-bg-surface))`;
}
