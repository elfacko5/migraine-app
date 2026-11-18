import { useCallback, useEffect, useRef, useState } from 'react';
import type { FocusEvent } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';

// The keyboard override for the medication flows (plan section 4). Measured on
// June's phone, 2026-11-18, Name field, against the app's own 'native' mode:
//   native  footer clear of the keyboard at 948 ms   (the "Save slide")
//   body    never (the page is not resized at all)
//   none    78 ms, lifting the footer by the height `keyboardWillShow` reports
// So while one of these flows is open the webview is NOT shortened ('none'), and
// the flow shortens itself by the height the event gives, which arrives at the
// start of the keyboard's animation rather than after it.
//
// Returns the keyboard's height in px (0 when down, and always 0 on the web,
// where `AppRoot` already follows the visual viewport). **'native' is always
// put back** when the flow closes or unmounts: every other screen is built for
// it, and a flow that left 'none' behind would cover low fields everywhere.
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let alive = true;
    const handles: Promise<{ remove: () => Promise<void> }>[] = [];
    Keyboard.setResizeMode({ mode: KeyboardResize.None }).catch((e) => console.error('keyboard mode:', e));
    handles.push(Keyboard.addListener('keyboardWillShow', (i) => { if (alive) setInset(i.keyboardHeight); }));
    handles.push(Keyboard.addListener('keyboardWillHide', () => { if (alive) setInset(0); }));
    return () => {
      alive = false;
      Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch((e) => console.error('keyboard mode:', e));
      handles.forEach((h) => { void h.then((x) => x.remove()); });
    };
  }, []);
  return inset;
}

/**
 * Everything a medication flow needs for the keyboard: the inset, a root and a
 * scroll body to attach refs to, and the focus handler that keeps the focused
 * field in view. The root takes `paddingBottom: inset` (which lifts the footer
 * and shrinks the body); the footer drops its home-indicator padding while the
 * keyboard is up, since the keyboard's height already includes it.
 *
 * Fields are centred in the flow's own body, never with `scrollIntoView`: that
 * scrolls every ancestor too, including the app shell, which is how a focus
 * during a sheet's slide-in once left the whole app scrolled up.
 */
export function useKeyboardFlow() {
  const inset = useKeyboardInset();
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const centerInBody = useCallback((el: HTMLElement) => {
    const body = bodyRef.current;
    if (!body) return;
    const b = body.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    body.scrollTop += r.top + r.height / 2 - (b.top + b.height / 2);
  }, []);
  useEffect(() => {
    if (inset === 0) return;
    const a = document.activeElement;
    if (a instanceof HTMLInputElement && rootRef.current?.contains(a)) centerInBody(a);
  }, [inset, centerInBody]);
  const onFocus = (e: FocusEvent) => {
    if (inset > 0 && e.target instanceof HTMLInputElement) centerInBody(e.target);
  };
  const footerPaddingBottom = inset > 0 ? '1rem' : 'calc(1rem + env(safe-area-inset-bottom))';
  return { inset, rootRef, bodyRef, onFocus, footerPaddingBottom };
}
