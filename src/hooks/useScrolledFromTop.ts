import { useEffect, useRef, useState } from 'react';

// True once the page has been scrolled away from the top, false again only
// when it is back at the top. For chrome that gives something up while you
// read and takes it back when you return to the start — currently the
// Insights header, which hides its title and keeps only the period control.
//
// **Deliberately not `useScrollCollapse`.** That one watches *direction*, so
// a floating pill gets its label back the moment you scroll up, which is the
// gesture meaning "I'm looking for something". A header that changes height
// cannot do that: every upward flick would grow it and every downward one
// shrink it, and the content under it would move each time. Position, not
// direction, is the right signal here — and it is what "reappear once we
// scroll all the way up" asks for (Sunny, 2026-09-02).
//
// It watches the app shell's own nested scroll container rather than the
// document: the document never scrolls (see docs/viewport-architecture.md),
// so a window-level scroll listener would never fire.
//
// **The two thresholds are separate on purpose.** Collapsing shortens the
// header, which shortens the scroll range under it; with a single threshold
// the state can sit exactly on the boundary and flicker as the layout it just
// changed moves back across it. Leaving `EXIT` well below `ENTER` means the
// flip is never undone by its own consequence.
const ENTER = 24;
const EXIT = 4;

export function useScrolledFromTop(ref: React.RefObject<HTMLElement | null>) {
  const [scrolled, setScrolled] = useState(false);
  // Read and written in the scroll handler on every frame; never a reason to
  // re-render on its own.
  const state = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onScroll = () => {
      const y = el.scrollTop;
      const next = state.current ? y > EXIT : y > ENTER;
      if (next === state.current) return;
      state.current = next;
      setScrolled(next);
    };

    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [ref]);

  return scrolled;
}
