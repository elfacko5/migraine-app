import type { TextScale } from '../hooks/useSettings';

const SCALES: TextScale[] = ['xs', 'sm', 'md', 'lg', 'xl'];

interface Props {
  scale: TextScale;
  onScale: (s: TextScale) => void;
}

/** Compact "− A A +" text-size stepper for a top app bar. */
export function TextScaleControl({ scale, onScale }: Props) {
  const i = SCALES.indexOf(scale);
  const atMin = i <= 0;
  const atMax = i >= SCALES.length - 1;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => !atMin && onScale(SCALES[i - 1])}
        disabled={atMin}
        aria-label="Decrease text size"
        className="flex h-8 w-7 items-center justify-center rounded-md text-lg leading-none text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
      >
        −
      </button>

      <span aria-hidden="true" className="flex items-baseline gap-0.5 text-text-primary">
        <span className="text-xs font-semibold">A</span>
        <span className="text-base font-semibold">A</span>
      </span>

      <button
        type="button"
        onClick={() => !atMax && onScale(SCALES[i + 1])}
        disabled={atMax}
        aria-label="Increase text size"
        className="flex h-8 w-7 items-center justify-center rounded-md text-lg leading-none text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
      >
        +
      </button>
    </div>
  );
}
