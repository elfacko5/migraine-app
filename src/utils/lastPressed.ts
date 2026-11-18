// The control that was last pressed, and when. Safari does not focus a button
// on tap, so `document.activeElement` is `body` after a touch (or VoiceOver's
// double-tap) and cannot say what opened a sheet or a value sheet. A click — a
// keyboard press also clicks — is the truest record.
//
// **Only a recent press counts.** A sheet can also be opened by code (a
// reminder answer, Siri) with nobody pressing anything; the last tap might then
// be a tab button pressed an hour ago, and handing focus back to it on close
// would send VoiceOver somewhere unrelated.
let pressed: { el: HTMLElement; at: number } | null = null;

if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const el = e.target instanceof Element ? e.target.closest<HTMLElement>('button, a, [role="button"]') : null;
    if (el) pressed = { el, at: Date.now() };
  }, true);
}

/** The control pressed within the last `maxAgeMs`, if it is still on the page. */
export function recentPress(maxAgeMs = 1500): HTMLElement | null {
  return pressed && pressed.el.isConnected && Date.now() - pressed.at <= maxAgeMs ? pressed.el : null;
}
