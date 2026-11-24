import { useEffect, useRef } from 'react';
import type { FabAction } from './BottomNav';
import { useModalStack } from './modalStack';

// The + opens this bottom action-sheet (v4, docs/redesign-v4/screens/01-today:
// TodayAddSheetDark / TodayAddSheetNoAttackDark). June's call to build the
// redesign version, which reverses the 2026-10-28 "built fresh, not a Sheet,
// because a full overlay is heavier than a choice of two" note — the sheet is
// heavier, but it is what the design draws.
//
// **Matches the boards pixel-for-pixel** (2026-11-23, against a "visually far
// from the redesign" report from device): full-bleed to both screen edges
// (no side gutter — the padding is the sheet's own, not an outer inset), a
// drag-handle affordance, a real 20px/600 title (not a small label), and the
// action rows on their own `bg-bg-raised` card nested inside the sheet's own
// `bg-bg-surface` — card-on-card, the same surface-stacking rule the rest of
// the app follows. Cancel is a plain centred text link (`accent-light`), not
// a bordered button — the design never gives it one.
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

  // Registers into Sheet's own modal stack rather than keeping a second,
  // independent copy of the same bookkeeping — see useModalStack's comment
  // for the bug that caused (every control in a sheet opened from one of
  // these actions became permanently untappable). Requires the root below
  // to carry `data-sheet=""` and set `inert={!open}` directly.
  useModalStack(open, rootRef);

  // Focus the first action on open and return focus to the + on close.
  // Deps are [open] only, so an unrelated App re-render can't re-steal focus
  // to the first row (Sheet's rule).
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    firstRef.current?.focus({ preventScroll: true });
    return () => {
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
      data-sheet=""
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
      {/* The sheet itself is full-bleed — no side gutter, no floating inset
          card. Its own padding (not an outer margin) is what keeps the
          content off the screen edges, so the backdrop never shows a strip
          down either side of it the way an inset card would. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`absolute inset-x-0 bottom-0 flex flex-col gap-4 rounded-t-sheet bg-bg-surface px-5 pt-2.5 transition-transform duration-300 ease-out ${open ? 'translate-y-0' : 'translate-y-full'}`}
        // 22px (pattern library's own Confirm/Edit-sheet reference,
        // docs/redesign-v4/reference/Patterns.html), not the 34px this
        // screen's own board draws — found too much dead space below Cancel
        // on device. 22px + the real safe-area inset reads correctly; 34px
        // was double-counting roughly what the inset already reserves.
        style={{ paddingBottom: 'calc(1.375rem + env(safe-area-inset-bottom))' }}
      >
        {/* Drag-handle affordance — decorative; this sheet dismisses by tap,
            not drag, but the design draws the handle regardless. 36×5
            (pattern library), not the 40×5 this screen's own board draws. */}
        <span aria-hidden="true" className="mx-auto h-[5px] w-9 rounded-full bg-text-secondary" />
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        {/* The action rows sit on their own bg-bg-raised card — a card on the
            sheet's own bg-bg-surface card, per the surface-stacking rule. */}
        <div className="overflow-hidden rounded-sheet bg-bg-raised">
          {actions.map((a, i) => (
            <button
              key={a.label}
              ref={i === 0 ? firstRef : undefined}
              type="button"
              onClick={() => { onClose(); a.onSelect(); }}
              className={`flex min-h-[4.5rem] w-full items-center gap-2.5 px-4 py-3.5 text-left transition-colors hover:bg-bg-elevated focus-visible:bg-bg-elevated ${
                i > 0 ? 'border-t border-bg-border' : ''
              }`}
            >
              <span className="flex-1">
                <span className="block text-base font-semibold text-text-primary">{a.label}</span>
                {a.detail && <span className="mt-0.5 block text-xs text-text-secondary">{a.detail}</span>}
              </span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4 shrink-0 text-text-secondary">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="mx-auto flex min-h-target items-center px-0.5 text-sm font-medium text-accent-light">
          Cancel
        </button>
      </div>
    </div>
  );
}
