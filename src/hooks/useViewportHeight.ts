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
    window.visualViewport?.addEventListener('resize', setHeight);
    window.visualViewport?.addEventListener('scroll', setHeight);
    window.addEventListener('resize', setHeight);
    window.addEventListener('orientationchange', setHeight);
    return () => {
      window.visualViewport?.removeEventListener('resize', setHeight);
      window.visualViewport?.removeEventListener('scroll', setHeight);
      window.removeEventListener('resize', setHeight);
      window.removeEventListener('orientationchange', setHeight);
    };
  }, []);
}
