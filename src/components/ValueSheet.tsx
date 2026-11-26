import { useState } from 'react';
import { usePanelDialog } from './usePanelDialog';

/** One number at a time, set with − and +, over the wizard (frames 15c-2 and
 *  15c-3). Lidd has no bottom sheet smaller than a full `Sheet`, so this is the
 *  nearest pattern: a panel anchored to the bottom of the wizard on a scrim. */
export function ValueSheet({ title, hint, unit, unitOne, steps: stepsIn, value, fallback, total, note, clearNote, onClear, onDone, onClose }: {
  title: string; hint: string; unit: string; unitOne: string; steps: number[]; value: number | undefined; fallback: number;
  total: ((n: number) => string | null) | null; note?: string; clearNote?: string; onClear?: () => void; onDone: (v: number) => void; onClose: () => void;
}) {
  const [v, setV] = useState(value ?? fallback);
  // A stored value that is not one of the steps (an old free-typed limit)
  // stays a step, so the stepper opens on it and moves from there.
  const steps = stepsIn.includes(v) ? stepsIn : [...stepsIn, v].sort((a, b) => a - b);
  const dialogRef = usePanelDialog();
  const i = Math.max(0, steps.indexOf(v));
  const t = total ? total(v) : null;
  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}
      className="absolute inset-0 z-10 flex items-end bg-scrim outline-none"
      role="dialog" aria-modal="true" aria-label={title}
    >
      <div className="w-full space-y-4 rounded-t-sheet bg-bg-surface px-gutter pt-5 sm:px-gutter-wide" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <div>
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
          <p className="text-xs text-text-secondary">{hint}</p>
        </div>
        <div className="flex items-center justify-center gap-4">
          {/* Fixed 64px, not the rem-scaling `size-16` (reviewer finding,
              2026-11-24): with the centre value's own `min-w-[6rem]` floor,
              a rem-based circle that grows with the text-size setting pushes
              this three-item row past 375px at lg/xl, and none of the three
              flex children can shrink to absorb it. A fixed size keeps the
              row's width constant regardless of text size — the deliberate
              "step up for a tap target that is the whole screen's job" (v4
              token decision 9) reads as a fixed design size, not a scaling
              one. */}
          <button type="button" aria-label="Less" disabled={i === 0} onClick={() => setV(steps[i - 1])}
            className="flex size-[64px] shrink-0 items-center justify-center rounded-full text-2xl text-text-primary ring-1 ring-inset ring-border-control disabled:[color:color-mix(in_srgb,var(--color-text-secondary)_55%,var(--color-bg-surface))]">−</button>
          <div className="min-w-[6rem] text-center" aria-live="polite">
            <span className="block text-[2.5rem] font-semibold tabular-nums leading-none text-text-primary">{v}</span>
            <span className="block text-sm text-text-secondary">{v <= 1 ? unitOne : unit}</span>
            {t && <span className="block text-xs text-text-secondary">= {t}</span>}
            {note && <span className="block text-xs text-text-secondary">{note}</span>}
          </div>
          <button type="button" aria-label="More" disabled={i === steps.length - 1} onClick={() => setV(steps[i + 1])}
            className="flex size-[64px] shrink-0 items-center justify-center rounded-full text-2xl text-text-primary ring-1 ring-inset ring-border-control disabled:[color:color-mix(in_srgb,var(--color-text-secondary)_55%,var(--color-bg-surface))]">+</button>
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
