import { useEffect, useRef } from 'react';

/**
 * What closing a half-filled wizard asks (`UpdateAttackForm`,
 * `PastAttackForm`). Only opened once pain areas are rated, which is the
 * whole minimum record — so "save what you have" is always possible.
 *
 * **Three answers, three weights (2026-11-25, against `MrgPastStopDark`).**
 * The board stacks three full-width filled buttons — green, outline, solid
 * red. On the phone that read as three equal choices with the destructive
 * one the loudest thing on screen, and the title asked "Discard?" while the
 * first answer was "Keep going", so no button answered the question. Now:
 *
 * - The title asks what the primary does ("Save what you have?").
 * - **Save and close** is the one filled button — X was tapped, so leaving
 *   is the likely intent, and this is the way out that loses nothing.
 * - **Keep going** is outlined: no change, the same as tapping the scrim.
 * - **Discard** is a text button in the danger colour, set apart by extra
 *   space, so it is findable but never the thing the eye or thumb lands on.
 *
 * Same `fixed inset-0` positioning `ConfirmDialog` uses: a short-lived alert
 * overlay, never visible across the cold-launch resize the shell's own
 * `position: fixed` ban is about.
 *
 * **Escape here is not reliable, and neither is `ConfirmDialog`'s own.** The
 * Sheet underneath also listens for Escape on `window` and calls its own
 * `onClose` — both listeners fire, and nothing here can suppress one added
 * before this dialog opened, so a keyboard Escape nets out to the draft being
 * lost. Fixing it needs Sheet to know a nested dialog is open. The scrim and
 * the explicit buttons all work correctly.
 */
export function DiscardDraftDialog({ open, discardLabel, onKeepGoing, onSave, onDiscard }: {
  open: boolean;
  /** "Discard this update" / "Discard this attack" — names what goes. */
  discardLabel: string;
  onKeepGoing: () => void;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const saveRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onKeepGoing(); };
    window.addEventListener('keydown', onKey);
    saveRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onKeepGoing]);

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-end justify-center ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
      inert={!open}
      style={{ visibility: open ? 'visible' : 'hidden', transition: `visibility 0s linear ${open ? '0s' : '200ms'}` }}
    >
      <div className="absolute inset-0 bg-bg-base/70" onClick={onKeepGoing} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="discard-draft-title"
        aria-describedby="discard-draft-body"
        className="relative w-full max-w-2xl rounded-t-sheet border border-bg-border bg-bg-surface p-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
      >
        <h2 id="discard-draft-title" className="text-lg font-medium text-text-primary">Save what you have?</h2>
        <p id="discard-draft-body" className="mt-1.5 text-sm text-text-secondary">
          Where it hurts is filled in, which is enough to save.
        </p>
        <div className="mt-5 space-y-2">
          <button ref={saveRef} type="button" onClick={onSave} className="btn-primary w-full">
            Save and close
          </button>
          <button type="button" onClick={onKeepGoing} className="btn-secondary w-full">
            Keep going
          </button>
        </div>
        {/* mt-3 on top of the stack's own gap: distance is what separates
            the destructive answer, not a louder colour. */}
        <button type="button" onClick={onDiscard} className="btn-tertiary mt-3 w-full text-severity-high">
          {discardLabel}
        </button>
      </div>
    </div>
  );
}
