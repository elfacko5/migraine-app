import type { TextScale } from '../hooks/useSettings';

const CYCLE: Partial<Record<TextScale, TextScale>> = { md: 'lg', lg: 'xl', xl: 'md' };

interface Props {
  scale: TextScale;
  onScale: (s: TextScale) => void;
}

export function TextScalePill({ scale, onScale }: Props) {
  const next = CYCLE[scale];
  if (!next) return null; // hidden at xs and sm

  return (
    <button
      type="button"
      onClick={() => onScale(next)}
      aria-label="Increase text size"
      className="fixed bottom-[5.5rem] right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-bg-raised font-bold text-text-secondary shadow-lg ring-1 ring-bg-border hover:bg-bg-border active:scale-95 transition-all"
      style={{ fontSize: '0.8125rem' }}
    >
      A+
    </button>
  );
}
