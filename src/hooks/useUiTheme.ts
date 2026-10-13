import { useEffect, useState } from 'react';

export type UiTheme = 'dark' | 'light' | 'attack';

function readTheme(): UiTheme {
  const t = document.documentElement.dataset.theme;
  return t === 'attack' || t === 'light' ? t : 'dark';
}

// The hand-mirrored constants (headDiagram.ts, SeverityChart.tsx,
// HeadHeatmap.tsx, StatsView.tsx, AreaSeverityPicker.tsx) can't read a CSS
// custom property — an SVG presentation attribute and a Recharts style prop
// both take a literal value — so they take the theme as an argument instead
// of freezing it as a module constant at import time. This hook is where a
// component gets that argument: it watches `data-theme` on <html> directly
// rather than duplicating it into more React state, since that attribute is
// already the single thing useSettings.ts's `applyTheme` writes to.
export function useUiTheme(): UiTheme {
  const [theme, setTheme] = useState<UiTheme>(() => readTheme());

  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}
