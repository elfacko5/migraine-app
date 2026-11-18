import { useEffect, useLayoutEffect, useRef } from 'react';
import { recentPress } from '../utils/lastPressed';

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
// `aria-modal` alone is not honoured reliably by iOS VoiceOver in a WKWebView:
// with the add-medicine wizard open over My medications, VoiceOver could still
// select the page behind it (its Back button, its "My medications" title).
// So while any sheet is open, every sibling of the topmost one — the app
// content, the nav, and any sheet lower in the stack — is `inert` and
// `aria-hidden`. `inert` landed in iOS 15.5 and the target is 15, hence both.
//
// **"Topmost" is the open sheet latest in the DOM, not the latest opened.** The
// sheets are z-50 siblings, so DOM order is paint order: a sheet opened by code
// (a reminder answer opens QuickUpdate, Siri opens LogForm) while one drawn
// above it is open appears *underneath*, and treating it as the top would make
// the sheet the person can actually see inert, with nothing on screen able to
// answer. Closed sheets are left to their own React-managed `inert`, and an
// element marked `data-modal-exempt` (the toast's live region) is never made
// inert, or its message would never be announced.
const openSheets: HTMLElement[] = [];
const touched = new Map<Element, { inert: boolean; hidden: string | null }>();
const byDomOrder = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
const isClosedSheet = (el: Element) => el.hasAttribute('data-sheet') && !openSheets.includes(el as HTMLElement);
const topSheet = () => [...openSheets].sort(byDomOrder).pop();
function syncModal() {
  touched.forEach((v, el) => {
    // A sheet that has closed since is React's again: writing back what it had
    // while open would leave a closed sheet looking open to assistive tech.
    if (isClosedSheet(el)) return;
    (el as HTMLElement).inert = v.inert;
    if (v.hidden === null) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', v.hidden);
  });
  touched.clear();
  const top = topSheet();
  if (!top?.parentElement) return;
  for (const c of Array.from(top.parentElement.children)) {
    if (c === top || isClosedSheet(c) || c.hasAttribute('data-modal-exempt')) continue;
    touched.set(c, { inert: (c as HTMLElement).inert, hidden: c.getAttribute('aria-hidden') });
    (c as HTMLElement).inert = true;
    c.setAttribute('aria-hidden', 'true');
  }
}

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
  useEffect(() => {
    const el = wrapRef.current;
    if (!open || !el) return;
    openSheets.push(el);
    syncModal();
    // Focus goes into the sheet when it opens (unless something inside already
    // took it, such as a heading or an autofocused field) and back to whatever
    // opened it when it closes. Without this VoiceOver's cursor stays on the
    // button that was pressed, which is now hidden, and drifts from there.
    const opener = openerRef.current;
    const panel = el.querySelector<HTMLElement>('[role="dialog"]');
    if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    return () => {
      openSheets.splice(openSheets.indexOf(el), 1);
      syncModal();
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
        className={`absolute inset-0 bg-bg-base/70 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
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
