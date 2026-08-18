interface Props {
  active: boolean;
  onToggle: (on: boolean) => void;
}

// Sits at z-45, above the dim scrim (z-35) rather than under it like the old
// A+ pill — this is the control that turns attack mode *off*, so dimming it
// along with the content would be the one thing the scrim must not do.
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
      // Capped like the nav: a floating pill that grows to 200% covers the
      // content it floats over.
      style={{ fontSize: 'min(1rem, 17px)', minHeight: 'min(3rem, 52px)' }}
      className={`absolute bottom-[5.5rem] right-4 z-[45] flex items-center gap-1.5 rounded-full px-3.5 font-medium ring-1 transition-colors ${
        active
          ? 'bg-accent/20 text-accent-light ring-accent/40'
          : 'bg-bg-raised text-text-secondary ring-bg-border hover:text-text-primary'
      }`}
    >
      {/* A crescent moon — the same glyph the "woke up with it" flag uses for
          low light, and no colour-only meaning: the label changes too. */}
      <span aria-hidden="true">🌙</span>
      {active ? 'Attack mode on' : 'Attack mode'}
    </button>
  );
}
