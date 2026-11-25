import { useEffect, useRef } from 'react';

/** Focus goes to the heading when a summary replaces the steps, so a screen
 *  reader announces the save; the step it replaced no longer exists. */
export function useHeadingFocus() {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  return ref;
}
