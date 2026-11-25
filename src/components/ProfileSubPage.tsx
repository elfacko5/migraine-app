import { useEffect, useRef } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Actions pinned above the home indicator, the way the logging wizard and
   *  AttackDetail pin theirs. A primary action that scrolls away with the
   *  content is one the user has to go looking for. */
  footer?: React.ReactNode;
  /** `back` (default): a drill-down entered from the right, back chevron on
   *  the left. `close`: the same page shown in a sheet that rises from the
   *  bottom (Insights → Monthly guides) — close X on the right, since a
   *  bottom sheet with a back chevron says two things at once. */
  dismiss?: 'back' | 'close';
}

// Shared shell for every Profile sub-page (My medications, Accessibility,
// Account & sync, Data). Rendered inside Sheet's `flush bareHeader` mode, so
// it owns the top bar and its own scroll region — the same arrangement
// AttackDetail uses, and the reason a footer or header here doesn't rely on
// `sticky` inside an iOS scroll container.
//
// Leading control is a back chevron, not a close X, and the panel slides in
// from the right (`enterFrom="right"`): these are rows you go one level into
// from a list, not a modal that interrupts what you were doing. AttackDetail
// keeps its X for exactly that contrast — it *is* a detour.
// AttackDetail's header button: 44px, filled bg-raised, primary chevron.
const CIRCLE_BUTTON = 'flex size-target shrink-0 items-center justify-center rounded-full bg-bg-raised text-text-primary transition-colors hover:bg-bg-elevated';

export function ProfileSubPage({ title, onClose, children, footer, dismiss = 'back' }: Props) {
  // A sub-page can replace another inside the same sheet (My medications →
  // Monthly guides), which removes the control that had focus. The title takes
  // it, so VoiceOver starts at the page it has just entered.
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); }, []);
  return (
    // bg-base, not the sheet's own bg-surface: every v4 settings board puts
    // the page on #1B1A18 with its cards one step up, and on the sheet's
    // surface a SettingsList card had nothing to stand out from (2026-11-25).
    <div className="flex flex-col flex-1 min-h-0 bg-bg-base">
      <div
        className="flex items-center gap-3 px-3 py-3"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        {/* No rule under the bar, and a filled circle behind the back
            chevron — AttackDetail's header button, on June's call
            (2026-11-25) over the boards' bare chevron. Title 16/600. */}
        {dismiss === 'back' ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            className={CIRCLE_BUTTON}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        ) : (
          <span className="size-target" aria-hidden="true" />
        )}
        <h2 ref={titleRef} tabIndex={-1} className="flex-1 text-center text-sm font-semibold text-text-primary outline-none">{title}</h2>
        {dismiss === 'close' ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={CIRCLE_BUTTON}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        ) : (
          <span className="size-target" aria-hidden="true" />
        )}
      </div>

      <div
        className="flex-1 overflow-y-auto px-gutter py-5"
        // With a footer below, the inset is that element's job — adding it
        // here too would reserve the home indicator's height twice.
        style={{ paddingBottom: footer ? '1.25rem' : 'calc(1.25rem + env(safe-area-inset-bottom))' }}
      >
        {children}
      </div>

      {/* Page colour with a hairline, as every v4 board draws it (decision 17).
          It was still bg-surface after the page itself moved to bg-base, so a
          disabled button sat on a lighter strip and read as a grey slab. */}
      {footer && (
        <div
          className="border-t border-bg-border bg-bg-base px-gutter py-4"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
