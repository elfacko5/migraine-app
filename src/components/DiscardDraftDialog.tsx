import { useEffect, useRef } from 'react';

/**
 * What closing a half-filled wizard asks (`UpdateAttackForm`,
 * `PastAttackForm`). Only opened once pain areas are rated, which is the
 * whole minimum record — so "save what you have" is always possible.
 *
 * **Two buttons side by side, and a close for "keep going" (2026-11-27,
 * Sunny's call).** The 2026-11-25 version stacked three answers — filled
 * Save and close, outlined Keep going, a red Discard text button below —
 * and still read as too many choices for someone in pain. Now:
 *
 * - The title asks what the primary does ("Save what you have?").
 * - **Discard** (secondary) and **Save** (primary) share one row, Save on
 *   the right where the thumb lands. Discard is neutral, not red: the only
 *   other answer is the safe one, so it needs no alarm colour.
 * - **Keep going** is the sheet's own close (×), top right, plus the scrim
 *   and Escape. The 2026-11-25 note rejected the scrim *alone* as an
 *   invisible affordance; the × is the visible one.
 * - The row wraps at large text sizes, so neither label truncates.
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
  /** "Discard this update" / "Discard this attack" — the Discard button's
   *  accessible name, naming what goes; the visible label is just "Discard"
   *  so the two buttons fit one row. */
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
      <div className="absolute inset-0 bg-scrim" onClick={onKeepGoing} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="discard-draft-title"
        aria-describedby="discard-draft-body"
        className="relative w-full max-w-2xl rounded-t-sheet border border-bg-border bg-bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="discard-draft-title" className="pt-1.5 text-lg font-medium text-text-primary">Save what you have?</h2>
          {/* Lucide `x`. "Keep going" is its name: closing this sheet goes
              back to the form, never out of it. */}
          <button type="button" onClick={onKeepGoing} aria-label="Keep going"
            className="tap-44 -mr-1 flex size-compact shrink-0 items-center justify-center rounded-full bg-bg-raised text-text-primary transition-colors hover:bg-bg-elevated">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <p id="discard-draft-body" className="mt-1.5 text-sm text-text-secondary">
          Where it hurts is filled in, which is enough to save.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={onDiscard} aria-label={discardLabel} className="btn-secondary min-w-[8rem] flex-1">
            Discard
          </button>
          <button ref={saveRef} type="button" onClick={onSave} className="btn-primary min-w-[8rem] flex-1">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
