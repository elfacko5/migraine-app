import { useEffect, useRef } from 'react';

/**
 * Settings → Data → Delete all data (`DataDeleteDark`, 2026-11-25).
 *
 * The board's bottom sheet: title, what goes, "Export a copy first" as a
 * link, then **Keep my data** (the filled, focused default) above **Delete
 * everything** (terracotta fill — the one place the palette allows it:
 * destructive, confirm-only).
 *
 * **Phone only.** The board says "from this phone and from your account";
 * deleting the account's rows (the diff doc's D3) is not built, so the copy
 * says what actually happens. Signed in, the delete signs out first — the
 * account keeps its copy, and signing in again brings it back. Saying so is
 * the honest version, not a reassurance.
 *
 * Same `fixed inset-0` overlay as `DiscardDraftDialog` / `ConfirmDialog`, and
 * the same Escape caveat: the Sheet underneath also hears Escape. Here that
 * only closes Data, which loses nothing.
 */
export function DeleteAllDialog({ open, signedIn, onExportFirst, onKeep, onDelete }: {
  open: boolean;
  signedIn: boolean;
  onExportFirst: () => void;
  onKeep: () => void;
  onDelete: () => void;
}) {
  const keepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onKeep(); };
    window.addEventListener('keydown', onKey);
    keepRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onKeep]);

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-end justify-center ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
      inert={!open}
      style={{ visibility: open ? 'visible' : 'hidden', transition: `visibility 0s linear ${open ? '0s' : '200ms'}` }}
    >
      <div className="absolute inset-0 bg-bg-base/70" onClick={onKeep} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-all-title"
        aria-describedby="delete-all-body"
        className="relative flex w-full max-w-2xl flex-col gap-3 rounded-t-sheet bg-bg-surface px-5 pt-2.5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <span aria-hidden="true" className="h-[5px] w-9 self-center rounded-full bg-border-control" />
        <h2 id="delete-all-title" className="mt-1 text-xl font-semibold text-text-primary">Delete all your data?</h2>
        <p id="delete-all-body" className="text-text-secondary">
          Every attack, check-in, medicine and setting is removed from this phone. This can’t be undone.
          {signedIn && ' You’ll be signed out; your account keeps its copy, and signing in again brings it back.'}
        </p>
        <button type="button" onClick={onExportFirst} className="btn-tertiary self-start px-0 text-base">
          Export a copy first
        </button>
        <button ref={keepRef} type="button" onClick={onKeep} className="btn-primary btn-inline w-full text-base">
          Keep my data
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="min-h-[3.25rem] w-full rounded-control px-control-x text-base font-medium bg-severity-high text-bg-base transition-opacity hover:opacity-90"
        >
          Delete everything
        </button>
      </div>
    </div>
  );
}
