/**
 * The RIGHT / LEFT label beside the head diagram.
 *
 * **Its only job is to be the same width as its opposite number**, and that is
 * load-bearing. The pair reads `RIGHT`/`LEFT` on the front view and
 * `LEFT`/`RIGHT` on the back, and "RIGHT" is the wider word — so a row that
 * centres its three children as a *group* put the head 9.6px to one side on
 * the front and 9.6px to the other on the back. Flipping Front/Back slid the
 * head sideways, and in the heatmap, where both views are on screen at once,
 * the two heads sat misaligned with each other (found by Sunny, 2026-09-03).
 *
 * `flex-1` on the two labels fixes it at the default text size and **not at
 * 150%**, which is why it isn't the answer: `flex-1` floors each item at its
 * own min-content, so as soon as the row is tight enough that the labels stop
 * sharing the slack, the wider word claims more room and the shift is back —
 * measured at 14.45px. That failure is invisible unless you check the text
 * scales, which is the reason for this note.
 *
 * So each side reserves the width of **both** words — they are rendered into
 * one grid cell, which sizes to the wider — and the visible one sits on top,
 * aligned toward the head. Both sides are then identical at every text scale
 * by construction, with nothing measured, hardcoded, or assumed about which
 * word is wider (a length comparison would be wrong for the same reason a
 * hardcoded width would: it isn't what the font does).
 */
export function SideLabel({ labels, side, className = '' }: {
  /** Both of the view's labels — each side reserves room for the wider. */
  labels: { left: string; right: string };
  /** Which side of the diagram this sits on; the word hugs the head. */
  side: 'left' | 'right';
  className?: string;
}) {
  return (
    <span className={`grid shrink-0 ${className}`}>
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">{labels.left}</span>
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">{labels.right}</span>
      <span className={`col-start-1 row-start-1 ${side === 'left' ? 'justify-self-end' : 'justify-self-start'}`}>
        {labels[side]}
      </span>
    </span>
  );
}
