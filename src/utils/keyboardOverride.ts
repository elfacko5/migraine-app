import { useEffect, useState } from 'react';
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
