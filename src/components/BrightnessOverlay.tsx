interface Props {
  brightness: number;
  onOpenSettings: () => void;
}

export function BrightnessOverlay({ brightness, onOpenSettings }: Props) {
  return (
    <>
      {/* Dim overlay — above page content (z-35), below nav (z-40) and modals (z-50) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[35]"
        style={{ background: `rgba(0,0,0,${brightness})` }}
      />

      {/* Pill — visible above nav (z-45) only when overlay is active */}
      {brightness > 0 && (
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Adjust screen brightness"
          className="fixed bottom-[5.5rem] right-4 z-[45] flex h-10 items-center gap-1.5 rounded-full bg-bg-raised px-3 text-sm font-medium text-text-secondary ring-1 ring-bg-border hover:text-text-primary transition-colors"
        >
          🔆
        </button>
      )}
    </>
  );
}
