import { AttackModeIcon } from './drawnIcons';

interface Props {
  active: boolean;
  onToggle: (on: boolean) => void;
}

// The attack mode button. Since v3 (2026-10-26) it lives in exactly two
// places: the Today hero's top-left corner (top-right until 2026-10-28), and
// `TopBar`'s control slot on a first run, before there is a hero. It **no longer floats** over the other
// tabs — that pill (with its scroll-collapsing label, at z-45 above the dim
// scrim) was removed on Sunny's call; Display & attack mode in Settings is the
// way in from anywhere else.
//
// **Icon only, in both states** (2026-10-28, Flow 1): a 44px circle with the
// mark centred and no visible label — "Attack mode" printed on the hero was
// a second headline competing with the real one. The name lives in
// `aria-label`, and `aria-pressed` carries on/off, so a screen reader loses
// nothing. Off is a `bg-surface` circle with a quiet `bg-border` ring; **on is
// the old pressed treatment, unchanged** — attack mode's look is being
// redesigned separately, and this change is placement and label only.
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
      // A static name with `aria-pressed` for the state — "Attack mode,
      // toggle button, pressed" — rather than a label that flips: a name
      // that changes with the state makes the state be announced twice.
      aria-label="Attack mode"
      title="Attack mode"
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1 transition-[color,background-color,box-shadow] ${
        active
          ? 'bg-accent/20 text-accent-light ring-accent/40'
          : 'bg-bg-surface text-text-primary ring-bg-border hover:bg-bg-raised'
      }`}
    >
      <AttackModeIcon className="h-6 w-6" />
    </button>
  );
}
