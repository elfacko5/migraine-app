import { useEffect, useRef, useState } from 'react';

// True while the user is scrolling *down* through the page, so a floating
// control can shed its label and get out of the way of the content it's
// floating over — and get it back the moment they scroll up, which is the
// gesture that means "I'm looking for something".
//
// It watches the app shell's own nested scroll container rather than the
// document: the document never scrolls (see docs/viewport-architecture.md),
// so a window-level scroll listener would never fire.
//
// The two thresholds are separate on purpose. DEAD_ZONE is how far you have
// to move before the state flips at all — without it, the one-pixel jitter
// of a finger resting on the screen flickers the label. TOP_ZONE keeps the
// label out no matter which way you were last moving while you're near the
// top of the page, so the resting state of every screen is the labelled one.
const DEAD_ZONE = 8;
const TOP_ZONE = 24;

export function useScrollCollapse(ref: React.RefObject<HTMLElement | null>) {
  const [collapsed, setCollapsed] = useState(false);
  // Not state: it's read and written inside the scroll handler on every
  // frame, and it must never be a reason to re-render on its own.
  const lastY = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    lastY.current = el.scrollTop;

    const onScroll = () => {
      const y = el.scrollTop;
      const delta = y - lastY.current;
      if (Math.abs(delta) < DEAD_ZONE) return;
      lastY.current = y;
      setCollapsed(y > TOP_ZONE && delta > 0);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [ref]);

  return collapsed;
}
