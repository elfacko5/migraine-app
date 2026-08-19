interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
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
export function ProfileSubPage({ title, onClose, children }: Props) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div
        className="flex items-center gap-3 border-b border-border-subtle px-3 py-3"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="tap-44 flex h-9 w-9 items-center justify-center rounded-full bg-bg-raised text-text-secondary transition-colors hover:text-text-primary"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h2 className="flex-1 text-center text-base font-medium text-text-primary">{title}</h2>
        <span className="h-9 w-9" aria-hidden="true" />
      </div>

      <div
        className="flex-1 overflow-y-auto px-4 py-5"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
      >
        {children}
      </div>
    </div>
  );
}
