import { useEffect } from 'react';

// The shared stack behind every full-screen overlay (`Sheet`, `AddSheet`):
// while any is open, every sibling of the topmost one — app content, the
// nav, and any sheet lower in the stack — is `inert` and `aria-hidden`.
// `aria-modal` alone is not honoured reliably by iOS VoiceOver in a WKWebView
// (confirmed with the add-medicine wizard open over My medications: VoiceOver
// could still select the page behind it). `inert` landed in iOS 15.5 and the
// target is 15, hence both attributes.
//
// Lives in its own file, not Sheet.tsx, because exporting a hook alongside a
// component breaks Fast Refresh — the same reason `ChipCheck` is its own
// file.
//
// **"Topmost" is the open overlay latest in the DOM, not the latest opened.**
// Overlays are z-50 siblings, so DOM order is paint order: one opened by code
// (a reminder answer opens QuickUpdate, Siri opens LogForm) while another
// drawn above it is open appears *underneath*, and treating it as the top
// would make the overlay the person can actually see inert, with nothing on
// screen able to answer. A closed overlay is left to its own React-managed
// `inert`, and an element marked `data-modal-exempt` (the toast's live
// region) is never made inert, or its message would never be announced.
const openSheets: HTMLElement[] = [];
const touched = new Map<Element, { inert: boolean; hidden: string | null }>();
const byDomOrder = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
const isClosedSheet = (el: Element) => el.hasAttribute('data-sheet') && !openSheets.includes(el as HTMLElement);
export const topSheet = () => [...openSheets].sort(byDomOrder).pop();
function syncModal() {
  touched.forEach((v, el) => {
    // An overlay that has closed since is React's again: writing back what it
    // had while open would leave a closed one looking open to assistive tech.
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

/**
 * Registers `ref`'s element into this stack while `open`, and keeps every
 * other overlay/the app content inert for as long as it's the topmost one.
 * The element must carry `data-sheet=""` and set `inert={!open}` directly as
 * a React prop on itself — synchronous with render, not from an effect, so
 * it's never a frame behind this hook — exactly as `Sheet`'s own wrapper
 * does; this hook only ever touches *siblings*, never the element it's given.
 *
 * Extracted 2026-11-23, after `AddSheet` kept its own hand-rolled copy of
 * this and it raced with `Sheet`'s: it captured a sibling's `inert` value
 * when *it* opened (often `true` — e.g. LogForm's Sheet, still closed) and
 * wrote that back unconditionally on its own close, even when, in the same
 * batched tap ("Log an attack" closes AddSheet and opens LogForm in one
 * update), that sibling had just become the thing that opened. AddSheet's
 * cleanup ran *after* React had already committed the new Sheet's
 * `inert={false}`, and silently overwrote it back to `true` — permanently
 * trapping the sheet that had just opened, Close button included. Found on
 * device: tapping "Log an attack" (or "Add a past attack") opened the wizard
 * with no way out short of force-quitting. One shared stack, not two
 * independent ones each bookkeeping the other's siblings, is what makes this
 * impossible.
 */
export function useModalStack(open: boolean, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    openSheets.push(el);
    syncModal();
    return () => {
      openSheets.splice(openSheets.indexOf(el), 1);
      syncModal();
    };
  }, [open, ref]);
}
