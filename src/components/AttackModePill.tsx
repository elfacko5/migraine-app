import { useEffect, useRef } from 'react';
import { AttackModeIcon } from './drawnIcons';

// Attack mode's two controls, one per state, in two different places
// (direction D, 2026-11-25; mock-ups in
// `docs/redesign-v4/proposals/AttackModeBandBottomProposals.html`).
//
// - **Off: `AttackModePill`**, at the top of Today — the hero's top-left
//   corner, or `TopBar`'s control slot on a first run before there is a hero.
//   The sunglasses mark plus "Attack mode", hugging its text so it doesn't
//   read as a second headline (why the label was dropped on 2026-10-28).
//   Renders nothing while attack mode is on.
// - **On: `AttackModeStrip`**, joined to the top of `BottomNav`, on every
//   tab. A band at the top of the hero (95bb96f) wrapped to two lines at
//   attack mode's 20px text and made the top of the screen heaviest exactly
//   when it should be quietest; at the bottom it's near the thumb, and as
//   part of the nav it reads as "the app is in a mode" rather than as one
//   more card. Its type is capped like the nav's, so it stays one line.
//
// **Focus follows the control across the screen.** The one you pressed
// unmounts, so `handOff` records where focus should land and the other
// control takes it when it mounts. Turning off from a tab without the pill
// lands on that tab's own nav button instead of dropping to `body`.
//
// Text size is deliberately not here: it's chosen once and left alone, where
// attack mode is reached for *while* an attack is happening, which is exactly
// when hunting through a settings page is hardest.

let handOff: 'pill' | 'strip' | null = null;

interface Props {
  active: boolean;
  onToggle: (on: boolean) => void;
}

export function AttackModePill({ active, onToggle }: Props) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (active || handOff !== 'pill') return;
    // Today stays mounted behind the other tabs, so the pill can exist
    // without being on screen; then the strip's fallback takes focus.
    if (!ref.current || ref.current.offsetParent === null) return;
    handOff = null;
    ref.current.focus();
  }, [active]);

  if (active) return null;

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => { handOff = 'strip'; onToggle(true); }}
      aria-pressed={false}
      className="inline-flex min-h-target shrink-0 items-center gap-2 rounded-chip bg-bg-surface px-control-compact-x text-base font-medium text-text-primary ring-1 ring-bg-border transition-colors hover:bg-bg-raised"
    >
      <AttackModeIcon className="-ml-1 h-6 w-6 shrink-0" />
      Attack mode
    </button>
  );
}

/** Rendered by `BottomNav` above its tabs, only while attack mode is on. */
export function AttackModeStrip({ onToggle }: { onToggle: (on: boolean) => void }) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (handOff !== 'strip') return;
    handOff = null;
    ref.current?.focus();
  }, []);

  const turnOff = () => {
    handOff = 'pill';
    onToggle(false);
    // The pill only exists on Today. If nothing took focus once React has
    // committed, give it to the current tab's own button.
    requestAnimationFrame(() => {
      if (handOff !== 'pill') return;
      handOff = null;
      document.querySelector<HTMLElement>('nav [aria-current="page"]')?.focus();
    });
  };

  return (
    // Fixed type, like the tabs below it (`min(…, px)`): at attack mode's
    // 20px root and the 150% text setting the line would otherwise wrap, and
    // a two-line strip brings back the weight this placement exists to remove.
    <div
      className="mx-auto flex w-full max-w-2xl items-center gap-3 pl-gutter pr-3 sm:pl-gutter-wide"
      // 6px + 44px + 6px = the 56px App's bottom reserve adds while this shows.
      style={{ fontSize: 'min(1.0625rem, 18px)', paddingBlock: '6px' }}
    >
      <p className="min-w-0 flex-1 truncate font-medium text-text-primary">Attack mode on</p>
      <button
        ref={ref}
        type="button"
        onClick={turnOff}
        // "Turn off" alone is ambiguous out of context (a rotor list of
        // buttons); the name keeps the visible words first.
        aria-label="Turn off attack mode"
        // Height and type pinned for the same reason as the strip's text;
        // the class still supplies colour, ring and radius.
        className="btn-secondary shrink-0"
        style={{ fontSize: 'inherit', minHeight: '44px', paddingBlock: 0, paddingInline: '1rem' }}
      >
        Turn off
      </button>
    </div>
  );
}
