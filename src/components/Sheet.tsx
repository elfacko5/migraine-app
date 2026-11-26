import { useEffect, useLayoutEffect, useRef } from 'react';
import { recentPress } from '../utils/lastPressed';
import { useModalStack, topSheet } from './modalStack';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  // When true, the body is a non-scrolling flex column — the child manages its
  // own scroll region and can flex-pin a footer (more reliable than `sticky`
  // inside a scroll container on iOS PWAs).
  flush?: boolean;
  // Optional control rendered on the right of the header (e.g. text-size stepper).
  headerRight?: React.ReactNode;
  // When true, Sheet renders no header/close of its own — the child owns the
  // full-height area and provides its own top bar (used by the log flow, whose
  // header shows a live step count + contextual actions).
  bareHeader?: boolean;
  // Which edge the panel enters from. 'bottom' is the modal default — a sheet
  // that covers what you were looking at. 'right' is a drill-down: the Profile
  // rows are a list you go one level *into*, and a page that slides in from
  // the right with a back button says that, where a sheet rising from the
  // bottom says "this is a detour". Pair it with a back chevron, not a close
  // X — the two have to agree or the gesture and the icon tell different
  // stories.
  enterFrom?: 'bottom' | 'right';
}

// **An open sheet makes everything behind it unreachable to assistive tech.**
// The stacking/inert mechanism (`useModalStack`, shared with `AddSheet`) and
// the reasoning for it live in `./modalStack` — moved out 2026-11-23 so a
// second kind of overlay can share the one stack instead of keeping its own
// copy that can race with this one (see that file's comment for the bug that
// caused).

export function Sheet({ open, onClose, title, children, flush = false, headerRight, bareHeader = false, enterFrom = 'bottom' }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  // Recorded in a layout effect, which runs before any child's passive effect
  // has moved focus (the wizard focuses its heading), so this is the control
  // that actually opened the sheet.
  const openerRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    // A recent press is the truest record of what opened the sheet. Failing
    // that, a focused control outside any dialog; never the panel of a sheet
    // below, and never a stale tap when code opened the sheet.
    const a = document.activeElement;
    openerRef.current = recentPress() ?? (a instanceof HTMLElement && a !== document.body && !a.closest('[role="dialog"]') ? a : null);
  }, [open]);
  // Stacking/inert is the shared concern (useModalStack); focus is kept as
  // its own effect here since AddSheet's version of it differs (it focuses
  // the first action, not the panel).
  useModalStack(open, wrapRef);
  useEffect(() => {
    const el = wrapRef.current;
    if (!open || !el) return;
    // Focus goes into the sheet when it opens (unless something inside already
    // took it, such as a heading or an autofocused field) and back to whatever
    // opened it when it closes. Without this VoiceOver's cursor stays on the
    // button that was pressed, which is now hidden, and drifts from there.
    const opener = openerRef.current;
    const panel = el.querySelector<HTMLElement>('[role="dialog"]');
    if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    return () => {
      // Back to what opened it; if that is gone (the row of a medicine just
      // removed) or there was none (opened by code), to the sheet that is now on
      // top, so VoiceOver is never left on something that no longer exists.
      if (opener && opener.isConnected && !opener.closest('[inert]')) opener.focus({ preventScroll: true });
      else topSheet()?.querySelector<HTMLElement>('[role="dialog"]')?.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  return (
    // **A closed overlay must leave the focus order, not just stop taking
    // taps.** `aria-hidden` + `pointer-events-none` hid it from assistive
    // tech and the mouse, but every button inside stayed tabbable — so a
    // keyboard user tabbing through Today walked straight into a closed
    // sheet's controls, and `aria-hidden` with focusable descendants is
    // itself the violation. `inert` fixes both in one attribute; the
    // delayed `visibility` is the belt-and-braces version for older Safari
    // (the deployment target is iOS 15, and `inert` only landed in 15.5),
    // and it is delayed by the transition's own length so the close still
    // animates instead of vanishing.
    <div
      ref={wrapRef}
      data-sheet=""
      className={`absolute inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
      inert={!open}
      style={{ visibility: open ? 'visible' : 'hidden', transition: `visibility 0s linear ${open ? '0s' : '300ms'}` }}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-scrim transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`outline-none absolute inset-x-0 top-0 flex flex-col bg-bg-surface transition-transform duration-300 ease-out ${
          open ? 'translate-x-0 translate-y-0' : enterFrom === 'right' ? 'translate-x-full' : 'translate-y-full'
        }`}
        style={{ height: '100%' }}
      >
        {!bareHeader && (
          <div
            className="relative flex items-center border-b border-border-subtle px-3 py-3 sm:px-4"
            style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
          >
            {/* Close — left */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="tap-44 rounded-full p-2 text-text-secondary hover:bg-bg-raised hover:text-text-primary transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            {/* Title — centered */}
            <h2 className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-base font-medium text-text-primary">
              {title}
            </h2>

            {/* Optional control — right */}
            <div className="ml-auto flex items-center">{headerRight}</div>
          </div>
        )}
        {flush ? (
          <div className="flex flex-col flex-1 min-h-0">
            {open && children}
          </div>
        ) : (
          <div
            className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-gutter py-5 sm:px-gutter-wide"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
          >
            {open && children}
          </div>
        )}
      </div>
    </div>
  );
}
