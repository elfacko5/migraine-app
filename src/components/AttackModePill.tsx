import { AttackModeIcon } from './drawnIcons';

interface Props {
  active: boolean;
  onToggle: (on: boolean) => void;
}

// The attack mode button. Since v3 (2026-10-26) it lives in exactly two
// places: the Today hero's top-right corner, and `TopBar`'s control slot on a
// first run, before there is a hero. It **no longer floats** over the other
// tabs — that pill (with its scroll-collapsing label, at z-45 above the dim
// scrim) was removed on Sunny's call; Display & attack mode in Settings is the
// way in from anywhere else.
//
// **The off state is the v3 spec**: a `bg-surface` pill with a quiet
// `bg-border` ring, 44px tall, 15px label, 18px mark. **The on state is the
// old floating pill's pressed treatment, unchanged** — attack mode's look is
// being redesigned separately.
//
// **The mark is `AttackModeIcon`, a flare drawn as arcs, not a moon**,
// although the v3 prototype draws a crescent: `MoonIcon` already means sleep,
// as a relief and a trigger, and one symbol has one meaning in this app. Arcs
// rather than rays, because a dot with straight rays is a sun. It is
// `currentColor`, so the control is never the brightest thing on a screen
// built to be easy on the eyes — the rule a full-colour emoji broke.
//
// Text size is deliberately not here: it's chosen once and left alone, where
// attack mode is reached for *while* an attack is happening, which is exactly
// when hunting through a settings page is hardest.
export function AttackModePill({ active, onToggle }: Props) {
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
