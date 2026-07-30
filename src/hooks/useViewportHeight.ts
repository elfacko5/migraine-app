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
      const height = isStatusBarBug ? screenFull : measured;
      document.documentElement.style.setProperty('--app-height', `${height}px`);
      // `position: fixed; bottom: 0` elements (BottomNav, the floating text-size
      // and brightness pills) anchor to WebKit's own (possibly also-broken)
      // fixed-positioning viewport, not to --app-height — so on top of sizing
      // Sheet correctly, expose the same shortfall (negative — `bottom: 0`
      // sits `shortfall`px above the true edge, so pushing the element back
      // *down* past that reference point needs a negative `bottom` value, not
      // a positive one) as a nudge those elements can add to their own
      // `bottom` offset to land back at the true edge. Zero in the normal/
      // keyboard-open case, so it's a no-op then.
      document.documentElement.style.setProperty('--viewport-shortfall', `${isStatusBarBug ? -shortfall : 0}px`);
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
    return () => {
      settleTimers.forEach(clearTimeout);
      window.visualViewport?.removeEventListener('resize', setHeight);
      window.visualViewport?.removeEventListener('scroll', setHeight);
      window.removeEventListener('resize', setHeight);
      window.removeEventListener('orientationchange', setHeight);
      document.removeEventListener('visibilitychange', setHeight);
      window.removeEventListener('focus', setHeight);
    };
  }, []);
}
