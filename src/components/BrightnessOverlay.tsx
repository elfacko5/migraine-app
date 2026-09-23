import { BrightnessIcon } from './icons';

interface Props {
  brightness: number;
  attackMode: boolean;
  onOpenProfile: () => void;
}

// Attack mode enforces a dim floor without touching the stored preference —
// turning it off has to restore exactly the brightness the user chose, so the
// floor is applied here at render rather than written back to hd_brightness.
const ATTACK_DIM_FLOOR = 0.35;

export function BrightnessOverlay({ brightness, attackMode, onOpenProfile }: Props) {
  const dim = attackMode ? Math.max(brightness, ATTACK_DIM_FLOOR) : brightness;
  return (
    <>
      {/* Dim overlay — above page content (z-35), below nav (z-40) and modals (z-50) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[35]"
        // Warm rather than neutral black: a grey scrim over a warm palette
        // pulls the whole UI back toward the blue end this spec avoids.
        style={{ background: `rgba(20,20,15,${dim})` }}
      />

      {/* Pill — visible above nav (z-45) only when overlay is active */}
      {/* Hidden while attack mode is on: the dim is coming from attack mode,
          not from a setting the user picked, and the two pills otherwise land
          on the same spot and overlap. AttackModePill is the control that
          matters in that state. */}
      {/* **Stacked above `AttackModePill`, not on top of it**, and
          deliberately a different size and weight from it — two passes,
          both on device (2026-09-24).

          The first pass fixed a real collision: `bottom-[5.5rem]` was a flat
          value copied from `AttackModePill`'s *base* offset
          (`4.5rem + 1rem`) without either the inset term or the pill it sits
          above, so at zero inset the two landed in the exact same spot.
          Positioning this one off `AttackModePill`'s own measured 48px
          height plus a gap (both carrying the identical
          `env(safe-area-inset-bottom)` term) fixed the overlap — confirmed
          on screen, no overlap — but it still read as "a double icon"
          afterwards, gap or no gap.

          **That's because the two were wearing the same outfit**: same
          `bg-bg-raised` fill, same `ring-1 ring-border-control`, nearly the
          same size — two solid filled circles stacked in one corner read as
          one control duplicated, whatever the gap between them. This pass
          fixes the actual cause: smaller (32px, not 40px), and *unfilled* —
          a ring with a transparent centre rather than a solid pill, closer to
          a quiet badge than a second primary button. The ring stays at full
          `border-control` strength (the WCAG 1.4.11 floor this app holds
          every control to), so it's still legible as tappable; the fill is
          what made it look like attack mode's twin, and the fill is what's
          gone. */}
      {!attackMode && brightness > 0 && (
        <button
          type="button"
          onClick={onOpenProfile}
          aria-label="Adjust screen brightness"
          style={{ bottom: 'calc(10rem + env(safe-area-inset-bottom))' }}
          className="absolute right-4 z-[45] flex h-8 w-8 items-center justify-center rounded-full text-text-secondary ring-1 ring-border-control transition-colors hover:bg-bg-raised/60 hover:text-text-primary"
        >
          {/* Was a `🔆` emoji — the last one in the app, and the rule it broke
              is the one the attack-mode pill gave up its own emoji for: a
              full-colour glyph can't inherit `currentColor`, so the brightest
              mark on screen belonged to the control that exists to make the
              screen dimmer. Sized down with the button, `h-4 w-4` rather than
              the default `h-5 w-5`, to keep the same proportion inside it. */}
          <BrightnessIcon className="h-4 w-4" />
        </button>
      )}
    </>
  );
}
