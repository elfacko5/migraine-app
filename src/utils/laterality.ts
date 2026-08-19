import type { Attack } from '../types';

// **Which side the pain was on, which is the only part of location that does
// diagnostic work.**
//
// ICHD-3 1.1 criterion B asks for at least two of four pain features, and one
// of the four is *unilateral*. So "left" or "right" is half a criterion, while
// "four areas" is not a fact anyone can act on — a count can't tell one-sided
// from both-sided, which is exactly the distinction the criterion turns on.
// That's why the Logs row reports a side rather than a list of zones or a
// tally of them.
//
// The 17 zones aren't lost: they're still recorded on every snapshot, drawn
// per-area in `SeverityBreakdown` on the detail sheet, and aggregated in the
// Insights heatmap. Those are the places with room to tell them apart, and
// the places where telling them apart is the question being asked. A row you
// scan is not.
//
// **Read across the whole attack, not one reading.** An attack that starts on
// the left and spreads is bilateral, and the criterion is about the attack.

export type Side = 'left' | 'right' | 'both';

export const SIDE_LABELS: Record<Side, string> = {
  left: 'Left side',
  right: 'Right side',
  both: 'Both sides',
};

/** The short form for a filter pill, where the column already says "side". */
export const SIDE_SHORT: Record<Side, string> = {
  left: 'Left',
  right: 'Right',
  both: 'Both',
};

/**
 * The side an attack was on, or `null` when nothing recorded says.
 *
 * `null` is a real answer and must not render as anything else: `Nose` is the
 * only sideless zone in `PAIN_AREAS`, so an attack recorded solely there
 * genuinely carries no laterality. Saying "both" there would invent half a
 * diagnostic criterion out of a zone that has no sides to speak of.
 */
export function attackSide(attack: Attack): Side | null {
  let left = false;
  let right = false;
  for (const snap of attack.snapshots) {
    for (const area of Object.keys(snap.areas)) {
      // Matched on the zone-name suffix `PAIN_AREAS` defines ("Temple left"),
      // which is why those strings are documented as not safe to rename.
      const lower = area.toLowerCase();
      if (lower.endsWith(' left')) left = true;
      else if (lower.endsWith(' right')) right = true;
    }
  }
  if (left && right) return 'both';
  if (left) return 'left';
  if (right) return 'right';
  return null;
}
