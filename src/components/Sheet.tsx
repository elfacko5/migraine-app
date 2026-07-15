import { useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  // When true, the body is a non-scrolling flex column — the child manages its
  // own scroll region and can flex-pin a footer (more reliable than `sticky`
  // inside a scroll container on iOS PWAs).
  flush?: boolean;
  // Optional control rendered on the right of the header (e.g. text-size stepper).
  headerRight?: React.ReactNode;
  // When true, Sheet renders no header/close of its own — the child owns the
  // full-height area and provides its own top bar (used by the log flow, whose
  // header shows a live step count + contextual actions).
  bareHeader?: boolean;
}

export function Sheet({ open, onClose, title, children, flush = false, headerRight, bareHeader = false }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-bg-base/70 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute inset-x-0 bottom-0 top-0 flex flex-col bg-bg-surface transition-transform duration-300 ease-out ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {!bareHeader && (
          <div
            className="relative flex items-center border-b border-border-subtle px-3 py-3 sm:px-4"
            style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
          >
            {/* Close — left */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-2 text-text-secondary hover:bg-bg-raised hover:text-text-primary transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            {/* Title — centered */}
            <h2 className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-base font-semibold text-text-primary">
              {title}
            </h2>

            {/* Optional control — right */}
            <div className="ml-auto flex items-center">{headerRight}</div>
          </div>
        )}
        {flush ? (
          <div className="flex flex-col flex-1 min-h-0">
            {open && children}
          </div>
        ) : (
          <div
            className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 py-5 sm:px-6"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
          >
            {open && children}
          </div>
        )}
      </div>
    </div>
  );
}
