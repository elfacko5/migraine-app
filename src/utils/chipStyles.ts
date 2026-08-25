// **The app's one rule for "chosen" vs "the thing to press".**
//
// Solid accent (`btn-primary`, the FAB) means *action* — press this to move
// forward. A selected option is not an action, it's a state, and dressing it
// in the action style made a screen of chosen pills compete with the single
// button that actually did something. Neither iOS nor Material uses the
// primary colour for a selected state: both reach for a container tint, and
// keep the primary fill for the one action on screen.
//
// Half the app already worked this way — `ChipSelector`, `MedicationInput`,
// the impact pills — while the period rows, filter pills, text-size options,
// reminder intervals and the Front/Back control used solid accent. Same idea,
// two appearances, which is what made the End-attack dialog show a solid
// preset above tinted impact pills.
//
// Kept as strings in one module rather than copied per call site, because the
// severity ramp had already been copied into three files and two of them had
// drifted to the wrong threshold. Tailwind scans source text, so constants
// like these are picked up like any inline class list.
//
// **Both states carry a ring, never a border.** A ring is a box-shadow and
// takes no layout space; a border does. Mixing them makes the unselected pill
// 2px taller, which is invisible in a flex row (siblings stretch) and obvious
// on a control that sits alone — exactly how the "Woke up with this migraine"
// toggle was found jumping as it toggled.
export const CHIP_ON =
  'bg-accent/20 text-accent-light ring-1 ring-inset ring-accent/50';

export const CHIP_OFF =
  'bg-bg-raised text-text-secondary ring-1 ring-inset ring-border-control hover:text-text-primary';

/** The pair, for the common `className={...}` case. */
export const chipClass = (selected: boolean) => (selected ? CHIP_ON : CHIP_OFF);
