// A letter in a ringed square — T / C / P for the three overuse classes on
// Today, "+" for the combined line. It always sits beside its text label, so
// the letter is never the only cue; it's `aria-hidden` for the same reason.
//
// Two sizes: 30px in the medication card's rows, 36px heading the ongoing
// dose card. `bg-base` inside a `bg-surface` card reads as a small recess,
// and the 1.5px accent ring is the badge's whole outline — a ring, never a
// border, so it takes no layout space.
export function ClassBadge({ children, large = false }: { children: React.ReactNode; large?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-[0.625rem] bg-bg-base font-bold text-text-primary ring-[1.5px] ring-inset ring-accent ${
        large ? 'h-9 w-9 text-sm' : 'h-[1.875rem] w-[1.875rem] text-xs'
      }`}
    >
      {children}
    </span>
  );
}
