// One-of-N switch, drawn as a filled track with a tinted, accent-bordered
// active segment. Matches `docs/redesign-v4/screens/09-insights`'s `.seg`
// exactly (v4 sweep, 2026-11-24, June's call — this control was previously
// flagged "open in the design" in CLAUDE.md's B table; it's now decided).
//
// It is the shape `AreaSeverityPicker`'s Front/Back toggle also uses, made
// shared when the Insights period moved into the top bar (2026-09-02, on
// Sunny's instruction): the pills scrolled away with the page, so half way
// down Insights there was nothing saying which period the figures answered.
// A segmented control says "these are the options, this is the one you're on"
// in the space a chip row spends saying only the second half.
//
// The rules it inherits, and the reasons they are not knobs:
//
// - **44px segments in a 4px track** (v4 board measurement) — a touch
//   target, not a thumbnail of one; the track's own padding is what keeps it
//   from reading as button-height chrome, not a shrunk segment.
// - **The active segment is a tint plus an accent border, never the solid
//   accent fill.** Solid accent means *act* in this app (`btn-primary`, the
//   FAB); a chosen option is a state. `--color-selected-fill` (`#2e3a31`)
//   and `--color-accent` are the same values the board's `.on` rule uses.
// - **The track itself has no border and no accent region of its own** — the
//   boundary is carried by each segment's own (invisible-unless-active)
//   border, not by the track, so an unselected segment reads as part of one
//   filled surface rather than a box inside a box.
// - **The track's fill is `bg-bg-surface`**, matching the board's literal
//   `#262421` — one step up from the page, same tier as a card.
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
  /** The track takes the page's `bg-base` — for a control sitting on a
   *  `bg-surface` card, where a surface track would vanish (Display's Theme row). */
  recessed?: boolean;
}

export function SegmentedControl<T extends string>({
  options, value, onChange, label, fill = false, recessed = false,
}: Props<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`${fill ? 'flex w-full' : 'inline-flex'} items-center gap-1 rounded-control-lg ${recessed ? 'bg-bg-base' : 'bg-bg-surface'} p-1`}
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
            className={`tap-44-y flex min-h-target min-w-0 items-center justify-center rounded-segment border px-2 text-xs font-medium transition-colors ${
              fill ? 'flex-1' : ''
            } ${isActive ? 'border-accent bg-selected-fill text-text-primary font-semibold' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
          >
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
