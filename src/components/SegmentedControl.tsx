// One-of-N switch, drawn as a bordered track with a tinted active segment.
//
// It is the shape `AreaSeverityPicker`'s Front/Back toggle already used, made
// shared when the Insights period moved into the top bar (2026-09-02, on
// Sunny's instruction): the pills scrolled away with the page, so half way
// down Insights there was nothing saying which period the figures answered.
// A segmented control says "these are the options, this is the one you're on"
// in the space a chip row spends saying only the second half.
//
// The rules it inherits, and the reasons they are not knobs:
//
// - **32px overall — a 28px segment inside a 2px track.** At button height it
//   carries the same weight as a primary action and reads as something to
//   press to continue, rather than as a switch between views of one thing.
// - **The active segment is a tint, never the solid accent.** Solid accent
//   means *act* in this app (`btn-primary`, the FAB); a chosen option is a
//   state. See `chipStyles.ts`.
// - **No ring on the segment.** It sits inside a bordered track that already
//   draws the boundary, and a ring on top of that reads as a box in a box.
// - **The track's border is `border-control`**, not `bg-border`: this is the
//   outline of something you press, which WCAG 1.4.11 wants at 3:1.
//
// `fill` makes the segments share the width equally instead of hugging their
// labels — for a control that owns its row, where hugging leaves it floating.
interface Props<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Names the choice for a screen reader — the segments are only the values. */
  label: string;
  fill?: boolean;
}

export function SegmentedControl<T extends string>({
  options, value, onChange, label, fill = false,
}: Props<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`${fill ? 'flex w-full' : 'inline-flex'} h-8 items-center gap-0.5 rounded-lg border border-border-control bg-bg-raised/40 p-0.5`}
    >
      {options.map((o) => {
        const isActive = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={isActive}
            // px-2 rather than the Front/Back control's px-4: that one has two
            // segments and room to spare, this one has four and has to hold
            // "3 months" at 375px. `truncate` is the backstop at the largest
            // text sizes; `min-w-0` is what lets it engage inside a flex item.
            className={`flex h-7 min-w-0 items-center justify-center rounded-md px-2 text-xs font-medium transition-colors ${
              fill ? 'flex-1' : ''
            } ${isActive ? 'bg-accent/20 text-accent-light' : 'text-text-secondary hover:text-text-primary'}`}
          >
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
