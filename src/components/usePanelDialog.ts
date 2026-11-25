import { useEffect, useRef } from 'react';
import { recentPress } from '../utils/lastPressed';

/**
 * For a small panel laid over a sheet (`ValueSheet`, Attack detail's editors):
 * attach the returned ref to the `role="dialog"` element.
 *
 * A dialog takes focus when it opens and gives it back to the control that
 * opened it. **Everything else beside it is `inert` and `aria-hidden` while it
 * is open**, for the reason `Sheet` does the same: `aria-modal` alone is not
 * honoured reliably by VoiceOver in a WKWebView.
 */
export function usePanelDialog() {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dlg = dialogRef.current;
    const opener = recentPress() ?? (document.activeElement instanceof HTMLElement && document.activeElement !== document.body && !document.activeElement.closest('[role="dialog"]') ? document.activeElement : null);
    const hidden: { el: HTMLElement; inert: boolean; aria: string | null }[] = [];
    for (const c of Array.from(dlg?.parentElement?.children ?? [])) {
      if (c === dlg || !(c instanceof HTMLElement)) continue;
      hidden.push({ el: c, inert: c.inert, aria: c.getAttribute('aria-hidden') });
      c.inert = true;
      c.setAttribute('aria-hidden', 'true');
    }
    dlg?.focus({ preventScroll: true });
    return () => {
      for (const h of hidden) {
        h.el.inert = h.inert;
        if (h.aria === null) h.el.removeAttribute('aria-hidden'); else h.el.setAttribute('aria-hidden', h.aria);
      }
      opener?.focus({ preventScroll: true });
    };
  }, []);
  return dialogRef;
}
