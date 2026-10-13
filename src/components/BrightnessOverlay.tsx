interface Props {
  brightness: number;
  attackMode: boolean;
}

// Attack mode enforces a dim floor without touching the stored preference —
// turning it off has to restore exactly the brightness the user chose, so the
// floor is applied here at render rather than written back to hd_brightness.
const ATTACK_DIM_FLOOR = 0.35;

export function BrightnessOverlay({ brightness, attackMode }: Props) {
  const dim = attackMode ? Math.max(brightness, ATTACK_DIM_FLOOR) : brightness;
  return (
    // Dim overlay — above page content (z-35), below nav (z-40) and modals (z-50)
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[35]"
      // Warm rather than neutral black: a grey scrim over a warm palette
      // pulls the whole UI back toward the blue end this spec avoids.
      style={{ background: `rgba(20,20,15,${dim})` }}
    />
  );
}
