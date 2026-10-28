// The selected-state mark for a *single-choice* chip — the radio counterpart
// to `ChipCheck` (2026-10-28, the "rdot" from the Flow 1 design session).
//
// **A check means "pick any", a ring-dot means "pick one".** Every chip row
// used to carry `ChipCheck` and `aria-pressed` whether it was multi-select
// (symptoms, reliefs) or single-select (the When presets, the medication row,
// End attack's Just now / Earlier), so the two kinds read the same to the eye
// and to a screen reader. Single-choice rows are now `role="radiogroup"` with
// `role="radio"` + `aria-checked`, and show this mark.
//
// Same rules as `ChipCheck`, for the same reasons: the state must not rest on
// colour alone (the tint delta is ~1.4:1), so the dot carries it; the ring is
// **always rendered** so a chip is the same width selected or not and a
// wrapped row never reflows; sized in `em` to track the text-size control;
// `currentColor`, so it follows the chip's own label colour.
export function RadioDot({ selected }: { selected: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="h-[0.875em] w-[0.875em] shrink-0"
    >
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth={1.5} />
      <circle
        cx="8"
        cy="8"
        r="3.25"
        fill="currentColor"
        className={`transition-opacity ${selected ? 'opacity-100' : 'opacity-0'}`}
      />
    </svg>
  );
}
