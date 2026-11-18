import { useEffect, useRef, useState } from 'react';

/** One number at a time, set with − and +, over the wizard (frames 15c-2 and
 *  15c-3). Lidd has no bottom sheet smaller than a full `Sheet`, so this is the
 *  nearest pattern: a panel anchored to the bottom of the wizard on a scrim. */
export function ValueSheet({ title, hint, unit, unitOne, steps, value, fallback, total, note, clearNote, onClear, onDone, onClose }: {
  title: string; hint: string; unit: string; unitOne: string; steps: number[]; value: number | undefined; fallback: number;
  total: ((n: number) => string | null) | null; note?: string; clearNote?: string; onClear?: () => void; onDone: (v: number) => void; onClose: () => void;
}) {
  const [v, setV] = useState(value ?? fallback);
  const dialogRef = useRef<HTMLDivElement>(null);
  // A dialog takes focus when it opens and gives it back to the row that
  // opened it; Escape closes without saving.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus({ preventScroll: true });
    return () => opener?.focus({ preventScroll: true });
  }, []);
  const i = Math.max(0, steps.indexOf(v));
  const t = total ? total(v) : null;
  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}
      className="absolute inset-0 z-10 flex items-end bg-bg-base/70 outline-none"
      role="dialog" aria-modal="true" aria-label={title}
    >
      <div className="w-full space-y-4 rounded-t-sheet bg-bg-surface px-gutter pt-5 sm:px-gutter-wide" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <div>
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
          <p className="text-xs text-text-secondary">{hint}</p>
        </div>
        <div className="flex items-center justify-center gap-4">
          <button type="button" aria-label="Less" disabled={i === 0} onClick={() => setV(steps[i - 1])}
            className="flex size-14 items-center justify-center rounded-full text-2xl text-text-primary ring-1 ring-inset ring-border-control disabled:[color:color-mix(in_srgb,var(--color-text-secondary)_55%,var(--color-bg-surface))]">−</button>
          <div className="min-w-[6rem] text-center" aria-live="polite">
            <span className="block text-[2.5rem] font-semibold tabular-nums leading-none text-text-primary">{v}</span>
            <span className="block text-sm text-text-secondary">{v <= 1 ? unitOne : unit}</span>
            {t && <span className="block text-xs text-text-secondary">= {t}</span>}
            {note && <span className="block text-xs text-text-secondary">{note}</span>}
          </div>
          <button type="button" aria-label="More" disabled={i === steps.length - 1} onClick={() => setV(steps[i + 1])}
            className="flex size-14 items-center justify-center rounded-full text-2xl text-text-primary ring-1 ring-inset ring-border-control disabled:[color:color-mix(in_srgb,var(--color-text-secondary)_55%,var(--color-bg-surface))]">+</button>
        </div>
        {onClear && clearNote && <p className="text-center text-xs text-text-secondary">{clearNote}</p>}
        <div className="flex flex-wrap gap-2">
          {onClear && <button type="button" onClick={onClear} className="btn-secondary flex-1">Clear</button>}
          <button type="button" onClick={() => onDone(v)} className="btn-primary flex-1">Done</button>
        </div>
      </div>
    </div>
  );
}
