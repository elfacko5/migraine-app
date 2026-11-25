import { useEffect, useRef } from 'react';
import { AttackModeIcon } from './drawnIcons';

interface Props {
  active: boolean;
  onToggle: (on: boolean) => void;
}

// The attack mode control on Today. It lives in exactly two places: the Today
// hero's top-left corner, and `TopBar`'s control slot on a first run, before
// there is a hero. It **does not float** over the other tabs (removed in v3) —
// Settings → Display & attack mode is the way in from anywhere else.
//
// **Quiet when off, a clear state when on** (direction B, 2026-11-25; the
// mock-ups are `docs/redesign-v4/proposals/AttackModeSwitchProposals.html`).
// The icon-only circle it replaces had two problems: the mark had to be
// learned, and "on" was only a sage ring — once the screen had gone dim and
// warm, nothing said why or how to undo it.
//
// - **Off** is a small pill, the mark plus "Attack mode", hugging its text so
//   it doesn't read as a second headline over the hero (the reason the label
//   was dropped on 2026-10-28). `aria-pressed="false"`.
// - **On** is a full-width band: what's on, and a plain "Turn off". The band
//   is the only thing that changes size, so the state is obvious at a glance
//   even under the dim floor. At attack mode's 20px body it wraps to two
//   lines; `HomeCard` measures it and moves the hero text down to match.
//
// **Focus follows the swap.** The control you pressed unmounts, so focus moves
// to its replacement — otherwise it drops to `body` and VoiceOver starts over
// from the top of the page.
//
// Text size is deliberately not here: it's chosen once and left alone, where
// attack mode is reached for *while* an attack is happening, which is exactly
// when hunting through a settings page is hardest.
export function AttackModePill({ active, onToggle }: Props) {
  const pressedHere = useRef(false);
  const onRef = useRef<HTMLButtonElement>(null);
  const offRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pressedHere.current) return;
    pressedHere.current = false;
    (active ? offRef : onRef).current?.focus();
  }, [active]);

  const toggle = (on: boolean) => {
    pressedHere.current = true;
    onToggle(on);
  };

  if (active) {
    return (
      <div className="flex w-full items-center gap-3 rounded-card bg-selected-fill py-2 pl-4 pr-2 ring-1 ring-accent">
        <AttackModeIcon className="h-6 w-6 shrink-0 text-text-primary" />
        <p className="min-w-0 flex-1 text-base font-medium text-text-primary">Attack mode on</p>
        <button
          ref={offRef}
          type="button"
          onClick={() => toggle(false)}
          // "Turn off" alone is ambiguous out of context (a rotor list of
          // buttons); the name keeps the visible words first.
          aria-label="Turn off attack mode"
          className="btn-secondary btn-compact shrink-0"
        >
          Turn off
        </button>
      </div>
    );
  }

  return (
    <button
      ref={onRef}
      type="button"
      onClick={() => toggle(true)}
      aria-pressed={false}
      className="inline-flex min-h-target shrink-0 items-center gap-2 rounded-chip bg-bg-surface px-control-compact-x text-base font-medium text-text-primary ring-1 ring-bg-border transition-colors hover:bg-bg-raised"
    >
      <AttackModeIcon className="-ml-1 h-6 w-6 shrink-0" />
      Attack mode
    </button>
  );
}
