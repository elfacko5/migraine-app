import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

// Switches on the keyboard's own bar (the arrows and the check). That check is
// the control that closes the keyboard when tapping outside a field does not.
// Lidd draws no close button of its own: see docs/decisions.md, "Requirement:
// the keyboard plugin". Native only; the web build has no such bar and the
// plugin has no web implementation of this call.
export function showKeyboardBar(): void {
  if (!Capacitor.isNativePlatform()) return;
  Keyboard.setAccessoryBarVisible({ isVisible: true }).catch((e) => {
    console.error('keyboard bar:', e);
  });
}
