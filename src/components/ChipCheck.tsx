// The selected-state mark for every chip in the app.
//
// Its own file rather than living in `utils/chipStyles.ts`: that module is
// constants, and a file exporting both constants and a component breaks Fast
// Refresh (eslint react-refresh/only-export-components, and lint here has to
// stay at zero).
// **The selected state must not rest on colour alone.**
//
// Measured 2026-08-25: selected-vs-unselected is 1.38:1 on the fill and
// 1.26:1 on the label — both far under the 3:1 WCAG 1.4.11 asks of a
// component's state, and §8.2 of the dossier is stricter still, because some
// users read through FL-41 tinted lenses which shift exactly these hues. A
// sage-vs-grey distinction is precisely the one that degrades for this app's
// own users.
//
// The mark carries the state instead: `accent-light` on the selected tint
// measures 4.68:1, so it passes as a graphical object with no palette change.
//
// **The slot is always rendered, at `opacity-0` when unselected.** A check
// that appears on tap makes the chip wider than its unselected self, so a
// wrapped row reflows on every toggle — the same failure as the "Woke up with
// this migraine" toggle that changed height as it toggled, and the reason
// every chip state here is a ring rather than a border. Reserving the space
// costs ~0.875em per chip and nothing moves.
//
// Sized in `em`, so it tracks the text-size control like the label beside it.
// The path is Lucide's `check`, inlined unchanged per the icon rule. Stroke 2
// rather than the nav's 1.8: this renders at roughly 14px where the nav's
// icons are 24px, and a two-segment mark needs the weight to read at all.
export function ChipCheck({ selected }: { selected: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`h-[0.875em] w-[0.875em] shrink-0 transition-opacity ${
        selected ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
