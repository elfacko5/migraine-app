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
 * the honest version, not a reassurance — but only for what has synced:
 * with sync in error or mid-push (`unsynced`), recent changes may exist only
 * here and the copy
 * says they'd be lost (reviews of 2cf7e47 and d5f4b07).
 *
 * **Locked while `busy`.** The sign-out is a network call; before, every
 * button stayed live through it, so "Keep my data" closed the sheet and the
 * delete still ran. Now nothing but waiting is possible.
 *
 * Same `fixed inset-0` overlay as `DiscardDraftDialog` / `ConfirmDialog`, and
 * the same Escape caveat: the Sheet underneath also hears Escape. Here that
 * only closes Data, which loses nothing.
 */
export function DeleteAllDialog({ open, signedIn, unsynced, busy, failed, onExportFirst, onKeep, onDelete }: {
  open: boolean;
  signedIn: boolean;
  /** Sync is in error: some changes may exist only on this phone. */
  unsynced: boolean;
  /** Deleting — every control is disabled and Escape/scrim do nothing. */
  busy: boolean;
  /** Sign-out couldn't be made certain, so nothing was deleted. */
  failed: boolean;
  onExportFirst: () => void;
  onKeep: () => void;
  onDelete: () => void;
}) {
  const keepRef = useRef<HTMLButtonElement>(null);

  // Focus moves in once, on open — not in the Escape effect, which re-runs
  // on every parent render (`onKeep` is inline) and pulled focus back to
  // Keep each time, e.g. while VoiceOver rested on Delete.
  useEffect(() => {
    if (open) keepRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onKeep(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onKeep]);

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-end justify-center ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
      inert={!open}
      style={{ visibility: open ? 'visible' : 'hidden', transition: `visibility 0s linear ${open ? '0s' : '200ms'}` }}
    >
      <div className="absolute inset-0 bg-bg-base/70" onClick={busy ? undefined : onKeep} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-all-title"
        aria-describedby="delete-all-body"
        aria-busy={busy}
        className="relative flex w-full max-w-2xl flex-col gap-3 rounded-t-sheet bg-bg-surface px-5 pt-2.5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <span aria-hidden="true" className="h-[5px] w-9 self-center rounded-full bg-border-control" />
        <h2 id="delete-all-title" className="mt-1 text-xl font-semibold text-text-primary">Delete all your data?</h2>
        <p id="delete-all-body" className="text-text-secondary">
          Every attack, check-in, medicine and setting is removed from this phone. This can’t be undone.
          {signedIn && (unsynced
            ? ' You’ll be signed out on this phone. Some recent changes haven’t synced yet, so they would be lost.'
            : ' You’ll be signed out on this phone. What has synced stays in your account, and signing in again brings it back.')}
        </p>
        <button type="button" onClick={onExportFirst} disabled={busy} className="btn-tertiary self-start px-0">
          Export a copy first
        </button>
        <button ref={keepRef} type="button" onClick={onKeep} disabled={busy} className="btn-primary btn-inline w-full">
          Keep my data
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="min-h-[3.25rem] w-full rounded-control px-control-x text-sm font-medium bg-severity-high text-bg-base transition-opacity hover:opacity-90 disabled:cursor-wait"
        >
          {busy ? 'Deleting…' : 'Delete everything'}
        </button>
        {/* Amber, not the alarm colour: nothing was deleted. The live region
            stays mounted so VoiceOver hears the text when it arrives. */}
        <p role="status" className="text-sm text-severity-mid empty:hidden">
          {failed ? 'Couldn’t sign out on this phone, so nothing was deleted. Try again in a moment.' : ''}
        </p>
      </div>
    </div>
  );
}
