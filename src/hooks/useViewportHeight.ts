import { useEffect } from 'react';

// iOS Safari/WKWebView (including standalone PWAs) can leave `position: fixed`
// elements sized to a stale, shorter viewport after the on-screen keyboard or
// a native <input> picker wheel dismisses — WebKit doesn't always reflow
// fixed-position layout on keyboard close, leaving a permanent gap of blank
// space between the app content and the real bottom of the screen. Tracking
// the actual visual viewport height in a CSS var and re-applying it on every
// resize/scroll forces a correct recalculation instead of trusting the
// browser's own (sometimes stale) fixed-position sizing.
//
// A second, distinct failure mode confirmed via an on-device diagnostic
// readout: after a cold launch from a fully-terminated state, WebKit can
// report visualViewport.height/innerHeight as if the translucent status bar
// (set via apple-mobile-web-app-status-bar-style + viewport-fit=cover) were
// opaque reserved space instead of an overlay — a real, internally
// consistent measurement, not a stale one, so re-reading it later doesn't
// help. The shortfall matches a status bar's height (~40-60px on this
// device), never a keyboard's (200px+), so below that threshold we trust
// window.screen's physical dimensions (which a real keyboard never affects)
// over the browser's own figure.
// True while a text field is focused, i.e. the on-screen keyboard (or at least
// its accessory bar) is up. A keyboard shrink is always preceded by a focus, so
// this identifies the case directly rather than guessing from the size of the
// shortfall — which matters because the accessory bar alone takes ~68px, well
// inside the sub-100px band the status-bar workaround claims.
function isKeyboardOpen(): boolean {
  const el = document.activeElement;
  // Date/time inputs raise a picker rather than a keyboard, but both offset
  // the visual viewport the same way, so either counts.
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return true;
  return (window.visualViewport?.offsetTop ?? 0) > 0;
}

export function useViewportHeight() {
  useEffect(() => {
    const setHeight = () => {
      const measured = window.visualViewport?.height ?? window.innerHeight;
      const isPortrait = window.innerWidth <= window.innerHeight;
      const screenFull = isPortrait
        ? Math.max(window.screen.width, window.screen.height)
        : Math.min(window.screen.width, window.screen.height);
      const shortfall = screenFull - measured;
      const isStatusBarBug = shortfall > 0 && shortfall < 100;
      // With the keyboard up, WebKit does not shorten the layout viewport —
      // it keeps it full height and offsets the *visual* viewport instead
      // (visualViewport.offsetTop). The visible region is therefore
      // [offsetTop, offsetTop + visualViewport.height], which still ends at
      // the bottom of the layout viewport. So the shell must stay full height:
      // shrinking it to visualViewport.height subtracts the keyboard a second
      // time and lifts BottomNav clear of the bottom of the screen — measured
      // at a 68px accessory bar in the simulator, and a whole keyboard's worth
      // (~300px, nav stranded mid-screen) on device.
      const height = isStatusBarBug || isKeyboardOpen() ? screenFull : measured;
      document.documentElement.style.setProperty('--app-height', `${height}px`);
    };
    setHeight();
    // Also re-measure a few times shortly after mount in case the browser's
    // own figure needs a moment to settle on a genuinely correct value.
    const settleTimers = [50, 150, 300, 600, 1000].map((ms) => setTimeout(setHeight, ms));
    window.visualViewport?.addEventListener('resize', setHeight);
    window.visualViewport?.addEventListener('scroll', setHeight);
    window.addEventListener('resize', setHeight);
    window.addEventListener('orientationchange', setHeight);
    // Re-measure on foreground too — iOS keeps a backgrounded standalone PWA
    // alive in memory rather than reloading it (same reasoning useAttacks/
    // useUserPrefs already apply to their own sync-on-foreground), so a stale
    // height from before backgrounding needs a fresh read on return.
    document.addEventListener('visibilitychange', setHeight);
    window.addEventListener('focus', setHeight);
    // Focus changes gate isKeyboardOpen() above, and the viewport resize that
    // follows one can arrive before activeElement settles — so re-measure on
    // the focus change itself, and once more on the next frame, rather than
    // relying on the resize event alone.
    const onFocusChange = () => { setHeight(); requestAnimationFrame(setHeight); };
    document.addEventListener('focusin', onFocusChange);
    document.addEventListener('focusout', onFocusChange);
    return () => {
      settleTimers.forEach(clearTimeout);
      window.visualViewport?.removeEventListener('resize', setHeight);
      window.visualViewport?.removeEventListener('scroll', setHeight);
      window.removeEventListener('resize', setHeight);
      window.removeEventListener('orientationchange', setHeight);
      document.removeEventListener('visibilitychange', setHeight);
      window.removeEventListener('focus', setHeight);
      document.removeEventListener('focusin', onFocusChange);
      document.removeEventListener('focusout', onFocusChange);
    };
  }, []);
}
