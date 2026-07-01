import { useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * In-app confirmation modal — a centered alert dialog that replaces the native
 * window.confirm(). Closes on backdrop click or Escape; Enter confirms for
 * non-destructive actions only (a destructive `danger` action must be clicked).
 *
 * Intentionally does NOT lock body scroll: this dialog can open on top of a
 * Sheet that already locks scroll, and two components saving/restoring
 * document.body.style.overflow can leave the page permanently unscrollable.
 */
export function ConfirmDialog({
  open, title, message,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  danger = false, onConfirm, onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      else if (e.key === 'Enter' && !danger) onConfirm();
    };
    window.addEventListener('keydown', onKey);
    // Focus the safe default: Cancel for destructive actions, Confirm otherwise.
    (danger ? cancelRef : confirmRef).current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, danger, onConfirm, onCancel]);

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-4 ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-bg-base/70 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onCancel}
      />
      {/* Panel — elevation via lighter surface (bg-surface), not shadow */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full max-w-sm rounded-2xl border border-bg-border bg-bg-surface p-5 transition-all duration-200 ${open ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
      >
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        {message && <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">{message}</p>}
        <div className="mt-5 flex gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="btn-secondary flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
              danger
                ? 'bg-severity-high text-text-primary hover:opacity-90'
                : 'btn-primary'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
