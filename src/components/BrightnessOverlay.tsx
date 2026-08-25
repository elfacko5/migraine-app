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
      {!attackMode && brightness > 0 && (
        <button
          type="button"
          onClick={onOpenProfile}
          aria-label="Adjust screen brightness"
          className="absolute bottom-[5.5rem] right-4 z-[45] flex h-10 items-center gap-1.5 rounded-full bg-bg-raised px-3 text-sm font-medium text-text-secondary ring-1 ring-bg-border hover:text-text-primary transition-colors"
        >
          {/* Was a `🔆` emoji — the last one in the app, and the rule it broke
              is the one the attack-mode pill gave up its own emoji for: a
              full-colour glyph can't inherit `currentColor`, so the brightest
              mark on screen belonged to the control that exists to make the
              screen dimmer. */}
          <BrightnessIcon />
        </button>
      )}
    </>
  );
}
