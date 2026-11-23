import { useEffect, useRef } from 'react';
import type { FabAction } from './BottomNav';

// The + opens this bottom action-sheet (v4, docs/redesign-v4/screens/01-today:
// TodayAddSheet / TodayAddSheetNoAttack). June's call to build the redesign
// version, which reverses the 2026-10-28 "built fresh, not a Sheet, because a
// full overlay is heavier than a choice of two" note — the sheet is heavier,
// but it is what the design draws.
//
// **Rendered from App, not BottomNav.** Every full-screen overlay is `absolute
// inset-0` against the app root (never `position: fixed` — the viewport
// architecture); rendered from inside the nav, which sits `absolute bottom-0`,
// a backdrop could not cover the screen upward. It mirrors Sheet's own
// close/inert/scroll-lock treatment rather than inventing a new one.
export function AddSheet({ open, ongoing, actions, onClose }: {
  open: boolean;
  /** Titles the sheet and is only for the heading — the actions decide the rest. */
  ongoing: boolean;
  actions: FabAction[];
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const title = ongoing ? 'Add or end' : 'Add';

  // Focus the first action on open, make everything behind the sheet inert
  // (aria-modal alone is not honoured by iOS VoiceOver in a WKWebView, so
  // without this the Today page, nav and the + stay reachable — the same
  // reason Sheet does it), and return focus to the + on close. Deps are
  // [open] only, so an unrelated App re-render can't re-steal focus to the
  // first row or re-run the inert dance (Sheet's rule).
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    firstRef.current?.focus({ preventScroll: true });

    const parent = rootRef.current?.parentElement;
    const touched: { el: HTMLElement; inert: boolean; hidden: string | null }[] = [];
    if (parent) {
      for (const c of Array.from(parent.children)) {
        if (c === rootRef.current || c.hasAttribute('data-modal-exempt')) continue;
        const el = c as HTMLElement;
        touched.push({ el, inert: el.inert, hidden: el.getAttribute('aria-hidden') });
        el.inert = true;
        el.setAttribute('aria-hidden', 'true');
      }
    }

    return () => {
      for (const t of touched) {
        t.el.inert = t.inert;
        if (t.hidden === null) t.el.removeAttribute('aria-hidden'); else t.el.setAttribute('aria-hidden', t.hidden);
      }
      const opener = openerRef.current;
      if (opener && opener.isConnected && !opener.closest('[inert]')) opener.focus({ preventScroll: true });
    };
  }, [open]);

  // Escape closes and body scroll locks while open. Separate from the focus
  // effect above so onClose's changing identity can't re-run that one.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  return (
    <div
      ref={rootRef}
      className={`absolute inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
      inert={!open}
      style={{ visibility: open ? 'visible' : 'hidden', transition: `visibility 0s linear ${open ? '0s' : '300ms'}` }}
    >
      {/* Backdrop — tap to dismiss. */}
      <div
        className={`absolute inset-0 bg-bg-base/70 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      {/* The card and its Cancel slide up together from the bottom. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`absolute inset-x-0 bottom-0 mx-auto w-full max-w-md px-gutter transition-transform duration-300 ease-out ${open ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="overflow-hidden rounded-sheet bg-bg-surface ring-1 ring-inset ring-border-control">
          <p className="px-4 pb-2 pt-3 text-xs font-semibold tracking-wide text-text-secondary">{title}</p>
          {actions.map((a, i) => (
            <button
              key={a.label}
              ref={i === 0 ? firstRef : undefined}
              type="button"
              onClick={() => { onClose(); a.onSelect(); }}
              className="flex min-h-target w-full flex-col items-start justify-center border-t border-bg-border px-4 py-2.5 text-left transition-colors hover:bg-bg-raised focus-visible:bg-bg-raised"
            >
              <span className="font-medium text-text-primary">{a.label}</span>
              {a.detail && <span className="text-xs text-text-secondary">{a.detail}</span>}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="btn-secondary mt-2 w-full">Cancel</button>
      </div>
    </div>
  );
}
