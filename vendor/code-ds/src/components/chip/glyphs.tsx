import { glyphSlot } from './chipStyles'

// Glyphs inherit currentColor and are hidden from screen readers: the state is
// already exposed by aria-checked or aria-pressed.

/** Pick one: an empty ring that gets a dot. Reads as a radio, not a checkbox. */
export function RadioMark() {
  return (
    <svg className={glyphSlot} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" />
      <circle
        cx="10"
        cy="10"
        r="4"
        fill="currentColor"
        className="opacity-0 transition-opacity motion-reduce:transition-none group-data-[checked]:opacity-100"
      />
    </svg>
  )
}

/**
 * Pick any and lone boolean: a square outline, with a check inside when on.
 * The square differs from the radio's circle by shape. The outline is a
 * pressable outline, so it uses the line role (3:1) and not currentColor.
 */
export function CheckMark() {
  return (
    <svg className={glyphSlot} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect
        x="3"
        y="3"
        width="14"
        height="14"
        rx="3"
        strokeWidth="2"
        className="chip-box stroke-line transition-[stroke] motion-reduce:transition-none group-data-[pressed]:stroke-on-selected"
      />
      <path
        d="M6.5 10.5l2.5 2.5 4.5-5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-0 transition-opacity motion-reduce:transition-none group-data-[pressed]:opacity-100"
      />
    </svg>
  )
}

export function PlusMark() {
  return (
    <svg className={glyphSlot} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  )
}
