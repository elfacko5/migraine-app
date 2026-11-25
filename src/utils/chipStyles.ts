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
// toggle was found jumping as it toggled. The pattern library's own CSS draws
// this as a literal `border`, which would reintroduce exactly that bug; the
// fix here is to take its *colours*, not its box model — ring stays a ring.
//
// **Fill is `--color-selected`, not an `accent/20` alpha tint** (2026-11-23,
// pattern library — a fixed, named "selected fill" colour, listed alongside
// accent and accent-light as one of the app's three core state colours).
// **Text stays `text-primary`, not `accent-light`** — the library never
// tints the label when selected, only the fill/border, plus `font-semibold`
// for emphasis. Both are real corrections, not stylistic preference: the old
// accent-light text thinned contrast against the new, deliberately darker
// fill, where text-primary measures comfortably on it in every theme.
export const CHIP_ON =
  'bg-selected-fill text-text-primary font-semibold ring-1 ring-inset ring-accent';

// **Unselected ring colour matches the fill** (June's call, 2026-11-25,
// overriding the WCAG audit below): Patterns.html's `.rdc`/`.chip` sets
// `border` to the same hex as `background`, so an unselected chip reads as a
// borderless filled pill, not a filled pill with a stroke. `ring-bg-raised`
// keeps the ring (box-shadow, no layout cost — the reasoning above still
// holds) while making its colour disappear into the fill it sits on.
//
// This is a known, accepted regression of the 2026-08-25 palette audit
// (`docs/decisions.md`): `ring-border-control` existed specifically because
// an unselected chip's edge then measured 1.15-1.8:1 against its own fill,
// failing WCAG 1.4.11's 3:1 non-text-contrast floor for UI components, and
// `ring-bg-raised` puts it back at ~1:1. Accepted deliberately in favour of
// matching the design pixel-for-pixel; if this chip set gets a non-colour
// affordance for "pressable" later (the way `ChipCheck` already carries the
// selected state off colour alone, per that same audit), revisit this.
export const CHIP_OFF =
  'bg-bg-raised text-text-secondary ring-1 ring-inset ring-bg-raised hover:text-text-primary';

/** The pair, for the common `className={...}` case. */
export const chipClass = (selected: boolean) => (selected ? CHIP_ON : CHIP_OFF);
