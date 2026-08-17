import { useEffect, useState } from 'react';

/**
 * Re-renders the calling component every `intervalMs`, **and** whenever the app
 * comes back to the foreground.
 *
 * For anything that derives a duration from `Date.now()` during render —
 * "Started 3m", "Attack-free for 14 days", "Synced 3m ago". Those values are
 * only as fresh as the last render, so they need something to force one.
 *
 * **The foreground half is the part that matters, and it was missing.** An
 * interval alone looks correct and is wrong on iOS: the OS keeps a
 * backgrounded PWA/WKWebView page alive in memory rather than reloading it
 * (the same fact the sync hooks are built around), and it suspends the page's
 * timers while it's back there. Nothing ticks, so nothing re-renders, so on
 * resume the component paints whatever it last computed *before* the app was
 * backgrounded — and keeps painting it until some unrelated state change
 * happens to re-render it.
 *
 * Observed on device: the Today card read "Started 1h" for an attack logged
 * the previous day, and only corrected itself after switching to Logs and
 * back. The interval hadn't fired since the app was backgrounded, about an
 * hour after that attack began, so "1h" was a faithful reading of a clock
 * that had stopped. A stale duration on a health record is a wrong fact
 * stated plainly, not a cosmetic lag — hence a hook, so the next thing that
 * shows a live duration gets this for free rather than rediscovering it.
 *
 * `visibilitychange` and `focus` are both observed because neither alone
 * covers every resume path — the same pair `useAttacks`/`useUserPrefs`
 * already listen to for sync.
 *
 * Only the `visibilitychange` path tests `visibilityState`, and deliberately
 * so: that event also fires on the way *out*, where re-rendering would be
 * pointless. A `focus` event refreshes unconditionally, because there are
 * environments that hand a page focus while still reporting it hidden (the
 * sandboxed preview browser is one), and skipping the refresh there would
 * leave the very staleness this hook exists to prevent. An extra re-render
 * of one line of text is not worth guarding against.
 */
export function useNowTick(intervalMs = 60_000): void {
  const [, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    let id = setInterval(bump, intervalMs);

    const refresh = () => {
      // Restart the interval as well as re-rendering now, so the next tick is
      // a full period away rather than firing immediately after this one.
      clearInterval(id);
      id = setInterval(bump, intervalMs);
      bump();
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') refresh();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', refresh);
    };
  }, [intervalMs]);
}
