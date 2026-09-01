import { useEffect, useRef } from 'react';
import type { Attack, Medication } from '../types';
import { buildWidgetSnapshot, publishWidgetSnapshot } from '../utils/widgetSnapshot';

/**
 * Keeps the home-screen widget's copy of the diary current.
 *
 * It watches `attacks` and `medications` rather than hooking each writer, so
 * every path that changes what the widget shows is covered by construction —
 * starting an attack, a reading, a dose, ending it, a limit edited in the
 * library, and the merge that lands after a sync pull. Adding a new writer
 * later cannot forget to tell the widget.
 *
 * **The publish on `hidden` is the load-bearing one.** Backgrounding the app
 * is, more often than not, the user going to the home screen the widget is on
 * — so it is the last moment the payload can be made right before it is
 * actually looked at.
 *
 * The foreground publish is for the other direction: figures that decay on
 * their own. A dose ages out of the rolling 24h, and a minimum gap elapses,
 * with nothing running to notice.
 */
export function useWidgetSnapshot(attacks: Attack[], medications: Medication[]): void {
  // What was last handed over, minus its timestamp — so an unchanged diary
  // doesn't reload the widget's timeline on every render. WidgetKit's refresh
  // budget is finite and spending it on identical payloads is how a widget
  // ends up stale at the moment it matters.
  const lastRef = useRef<string | null>(null);

  useEffect(() => {
    const publish = () => {
      const snapshot = buildWidgetSnapshot(attacks, medications);
      // Everything except the build time: that changes on every call, so
      // comparing the whole payload would make the dedupe a no-op.
      const key = JSON.stringify({ ...snapshot, updatedAt: '' });
      if (key === lastRef.current) return;
      lastRef.current = key;
      void publishWidgetSnapshot(snapshot);
    };

    publish();
    const onVisibility = () => publish();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
    };
  }, [attacks, medications]);
}
