interface Props {
  active: boolean;
  onToggle: (on: boolean) => void;
}

// Not the crescent moon — that glyph already means "woke up with this
// migraine" on the attack header, and one symbol can't carry two unrelated
// meanings in the same app. A half-filled circle is the conventional
// contrast/dim mark, and drawn as a stroke SVG in currentColor it also stops
// the control being the brightest thing on a screen meant to be easy on the
// eyes — which a full-colour emoji was.
function DimIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Sits at z-45, above the dim scrim (z-35) rather than under it — this is the
// control that turns attack mode *off*, so dimming it along with the content
// would be the one thing the scrim must not do.
//
// Replaces the old A+ text-size pill. Text size is a setting you choose once
// and leave alone, so it belongs in Profile → Accessibility; attack mode is
// the thing you reach for *while* an attack is happening, which is exactly
// when hunting through a settings page is hardest. One tap, always in the
// same place, reversible by tapping again.
export function AttackModePill({ active, onToggle }: Props) {
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
      className={`absolute right-4 z-[45] flex items-center gap-2 rounded-full px-3.5 font-medium ring-1 transition-colors ${
        active
          ? 'bg-accent/20 text-accent-light ring-accent/40'
          : 'bg-bg-raised text-text-secondary ring-bg-border hover:text-text-primary'
      }`}
    >
      <DimIcon />
      {active ? 'Attack mode on' : 'Attack mode'}
    </button>
  );
}
