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
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-raised text-text-secondary transition-colors hover:text-text-primary"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
            <path d="M18 6 6 18M6 6l12 12" />
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
