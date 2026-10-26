import { AttackModeIcon } from './drawnIcons';

interface Props {
  active: boolean;
  onToggle: (on: boolean) => void;
  /** Scrolling down — shed the label and leave just the icon. */
  collapsed?: boolean;
  /**
   * Drawn in place rather than floating: in the Today hero's corner, or in
   * `TopBar`'s control slot on a first run. No scroll-collapse there — the
   * button scrolls away with the hero instead of riding over the content.
   */
  inline?: boolean;
}

// The glyph is a flare radiating from a centre — `AttackModeIcon` in
// drawnIcons.tsx, drawn there rather than in this file like every other icon
// here. It replaced a half-filled circle (the conventional dim/contrast mark),
// then the supplied `FlareUpIcon` artwork, which was the same metaphor as five
// filled concentric scalloped rings and carried more detail than a 20px pill
// can resolve — on device it read as a small flower or a gear. Same idea, one
// stroke weight, five elements.
//
// **The old reason to avoid a crescent moon here has expired**, and is
// recorded only so nobody reinstates the rule from memory: the moon used to
// mean "woke up with this migraine", so it couldn't also mean attack mode.
// That flag is now a drawn sunrise (SunriseIcon), which is the better
// metaphor for waking anyway, so the moon is unused. The live constraint is
// just the general one — one symbol, one meaning — and this mark is used
// nowhere else.
//
// The part of the old reasoning that survives is the colour. It's drawn in
// `currentColor` and inherits the pill's `text-text-secondary`, so the
// control isn't the brightest thing on a screen designed to be easy on the
// eyes — which a full-colour emoji was, and which a filled icon could easily
// become if it were ever given a literal fill.
//
// Sits at z-45, above the dim scrim (z-35) rather than under it — this is the
// control that turns attack mode *off*, so dimming it along with the content
// would be the one thing the scrim must not do.
//
// Replaces the old A+ text-size pill. Text size is a setting you choose once
// and leave alone, so it belongs in Profile → Accessibility; attack mode is
// the thing you reach for *while* an attack is happening, which is exactly
// when hunting through a settings page is hardest. One tap, always in the
// same place, reversible by tapping again.
export function AttackModePill({ active, onToggle, collapsed = false, inline = false }: Props) {
  if (inline) return <InlineAttackModeButton active={active} onToggle={onToggle} />;

  // Collapses on scroll-down like any other state, including while attack
  // mode is on (2026-09-25, Sunny's call, reversing the earlier "never while
  // active" rule — the tint (`bg-accent/20`) still tells the on state apart
  // from off even with the label gone, and it gets its label back on any
  // upward scroll or near the top, same as every other state).
  const compact = collapsed;

  return (
    <button
      type="button"
      onClick={() => onToggle(!active)}
      aria-pressed={active}
      aria-label={active ? 'Turn off attack mode' : 'Turn on attack mode'}
      // Clearance is measured from the nav, not guessed: BottomNav is ~4.5rem
      // plus the home-indicator inset, so a flat bottom offset sat on top of
      // it. The gap below is now explicit and grows with the inset.
      style={{
        bottom: 'calc(4.5rem + 1rem + env(safe-area-inset-bottom))',
        fontSize: 'min(1rem, 17px)',
        minHeight: 'min(3rem, 52px)',
      }}
      className={`absolute right-4 z-[45] flex items-center rounded-full px-3.5 font-medium ring-1 transition-[color,background-color,box-shadow] ${
        active
          ? 'bg-accent/20 text-accent-light ring-accent/40'
          : 'bg-bg-raised text-text-secondary ring-border-control hover:text-text-primary'
      }`}
    >
      {/* 24px, not the 20px it shipped at. The mark read small beside a 16px
          label — the nav pairs a 24px icon with a 14px one, and this control is
          physically larger than a nav tab, so 20px was the odd one out. Fixed,
          like the nav's, rather than scaling with the text setting: the pill's
          own font is clamped, and it has to keep clearing the nav below it. */}
      <AttackModeIcon className="h-6 w-6" />
      {/* The label collapses by width rather than unmounting, so the pill
          shrinks toward its icon instead of the text vanishing and leaving a
          wide empty pill behind. The gap before it is the span's own padding
          rather than a flex `gap`, which would survive the collapse as 8px of
          dead space beside the icon.

          **The padding has to be dropped explicitly, not left to `max-w-0`.**
          A used border-box width is floored at its own padding + border, so
          `max-width: 0` on a `ps-2` span still measures 8px — which is what
          left the collapsed pill 56×48 with 22px of air on the right of the
          icon against 14px on its left. It's animated with the width so the
          two ease together instead of the padding snapping shut first.

          Both attack mode and prefers-reduced-motion already zero every
          transition-duration in index.css, so where movement is unwelcome
          this is an instant swap and needs no opt-out of its own. */}
      <span
        aria-hidden={compact}
        className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity,padding] duration-200 ${
          compact ? 'max-w-0 ps-0 opacity-0' : 'max-w-[12rem] ps-2 opacity-100'
        }`}
      >
        {active ? 'Attack mode on' : 'Attack mode'}
      </span>
    </button>
  );
}

// The Today v3 placement (2026-10-26): a pill in the hero's top-right corner,
// replacing the floating pill on Today only — it still floats on the other
// three tabs. The off state is new, to the v3 spec: a `bg-surface` pill with a
// quiet `bg-border` ring, 44px tall, 15px label, 18px mark. **The on state is
// the floating pill's own pressed treatment, unchanged** — attack mode's look
// is being redesigned separately and is out of scope here.
//
// **The mark is `AttackModeIcon`, not a moon**, although the v3 spec and the
// prototype draw a crescent: `MoonIcon` already means sleep, as a relief and a
// trigger, and one symbol has one meaning in this app (see the note on the
// floating pill above). Same behaviour as that pill — the same `onToggle`, the
// same `aria-pressed` and label.
function InlineAttackModeButton({ active, onToggle }: Pick<Props, 'active' | 'onToggle'>) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!active)}
      aria-pressed={active}
      aria-label={active ? 'Turn off attack mode' : 'Turn on attack mode'}
      className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-[0.9375rem] font-medium ring-1 transition-[color,background-color,box-shadow] ${
        active
          ? 'bg-accent/20 text-accent-light ring-accent/40'
          : 'bg-bg-surface text-text-primary ring-bg-border hover:bg-bg-raised'
      }`}
    >
      <AttackModeIcon className="h-[1.125rem] w-[1.125rem]" />
      <span>{active ? 'Attack mode on' : 'Attack mode'}</span>
    </button>
  );
}
