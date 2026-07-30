import { useEffect } from 'react';

// iOS Safari/WKWebView (including standalone PWAs) can leave `position: fixed`
// elements sized to a stale, shorter viewport after the on-screen keyboard or
// a native <input> picker wheel dismisses — WebKit doesn't always reflow
// fixed-position layout on keyboard close, leaving a permanent gap of blank
// space between the app content and the real bottom of the screen. Tracking
// the actual visual viewport height in a CSS var and re-applying it on every
// resize/scroll forces a correct recalculation instead of trusting the
// browser's own (sometimes stale) fixed-position sizing.
export function useViewportHeight() {
  useEffect(() => {
    const setHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${height}px`);
    };
    setHeight();
    // On a cold PWA launch, visualViewport.height can briefly report a
    // too-small value before the standalone window chrome finishes settling —
    // there's no event for "settled", so re-measure a few times shortly after
    // mount to catch the correct value once it's available. Without this, the
    // undersized reading sticks in --app-height for the rest of the session
    // unless some unrelated scroll/resize happens to fire first.
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
