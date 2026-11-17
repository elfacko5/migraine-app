import { useEffect } from 'react';

// A plain message that appears and goes: no button, no Undo (June, 2026-11-17).
// Lidd had no toast; this is it, message only.
//
// - Stays at least 5 s, and the clock **pauses while the page is hidden**: it
//   restarts in full when the app comes back, so a message shown just before
//   backgrounding is still there to read.
// - `role="status"` + `aria-live="polite"`: announced without taking focus.
// - `absolute`, never `fixed`, against the app root (viewport-architecture),
//   offset from the bottom the way the nav is measured — 4.5rem of nav plus a
//   gap, growing with the home-indicator inset — and above the dim scrim.
// - Quiet: the raised surface and the control ring, no accent, no shadow.
export const TOAST_MS = 5000;

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    let timer: number | undefined;
    const start = () => { window.clearTimeout(timer); timer = window.setTimeout(onDone, TOAST_MS); };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') window.clearTimeout(timer);
      else start();
    };
    if (document.visibilityState !== 'hidden') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [message, onDone]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 z-[46] flex justify-center px-gutter"
      style={{ bottom: 'calc(4.5rem + 1rem + env(safe-area-inset-bottom))' }}
    >
      {message && (
        <p className="pointer-events-auto max-w-sm rounded-control bg-bg-raised px-control-x py-control-y text-sm text-text-primary ring-1 ring-inset ring-border-control">
          {message}
        </p>
      )}
    </div>
  );
}
