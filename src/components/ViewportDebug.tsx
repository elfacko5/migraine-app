import { useEffect, useState } from 'react';

// TEMPORARY diagnostic overlay for the bottom-gap bug investigation — remove
// once the real cause is confirmed from a device screenshot. Reports the
// competing height sources live so we can see which one is wrong instead of
// guessing blind.
export function ViewportDebug() {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const tick = () => {
      const vv = window.visualViewport;
      const appHeight = getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim();
      setLines([
        `innerHeight: ${window.innerHeight}`,
        `docEl.clientHeight: ${document.documentElement.clientHeight}`,
        `vv.height: ${vv?.height ?? 'n/a'}`,
        `vv.offsetTop: ${vv?.offsetTop ?? 'n/a'}`,
        `vv.scale: ${vv?.scale ?? 'n/a'}`,
        `--app-height: ${appHeight}`,
        `screen: ${window.screen.width}x${window.screen.height}`,
        `dpr: ${window.devicePixelRatio}`,
      ]);
    };
    tick();
    const id = setInterval(tick, 250);
    window.visualViewport?.addEventListener('resize', tick);
    window.visualViewport?.addEventListener('scroll', tick);
    return () => {
      clearInterval(id);
      window.visualViewport?.removeEventListener('resize', tick);
      window.visualViewport?.removeEventListener('scroll', tick);
    };
  }, []);

  return (
    <div
      className="fixed left-1 top-1 z-[999] rounded bg-black/80 px-2 py-1 font-mono text-[10px] leading-tight text-lime-300"
      style={{ paddingTop: 'calc(0.25rem + env(safe-area-inset-top))' }}
    >
      {lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}
