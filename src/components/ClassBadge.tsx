// A letter in a ringed square — T / C / P for the three overuse classes on
// Today, "+" for the combined line. It always sits beside its text label, so
// the letter is never the only cue; it's `aria-hidden` for the same reason.
//
// Two sizes (v4 "clean batch", 2026-11-22): 28px in a row, 40px only beside
// a page heading. There used to be a third, 26px `small` size with its own
// --radius-badge-sm token — nothing in the decided v4 set calls for a third
// size, and every call site using `small` was a row like any other, so it
// collapsed into the default. `bg-base` inside a `bg-surface` card reads as
// a small recess, and the 1.5px accent ring is the badge's whole outline —
// a ring, never a border, so it takes no layout space.
export function ClassBadge({ children, large = false }: { children: React.ReactNode; large?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center bg-bg-base font-bold text-text-primary ring-[1.5px] ring-inset ring-accent ${
        large ? 'h-10 w-10 rounded-badge text-sm' : 'h-7 w-7 rounded-badge text-xs'
      }`}
    >
      {children}
    </span>
  );
}
