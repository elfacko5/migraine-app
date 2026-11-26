import type { ReactNode } from 'react';

// Something that didn't work, said calmly (2026-11-26, the error states).
// The warning surface and amber mark of Today's overuse banner and Detail's
// under-5-minutes card: never the alarm colour, because in every case it's
// used for nothing has been lost. A headline that states what happened, one
// line on what's still true or what happens next, and at most one action.
//
// `role="status"`, and the wrapper stays mounted by its caller only while
// there's something to say — each caller renders it conditionally, so a
// screen reader hears it once when it appears.
export function StatusNotice({ icon, title, children, action }: {
  /** A Lucide-style mark in currentColor, drawn amber. */
  icon: ReactNode;
  title: string;
  children: ReactNode;
  /** One `btn-secondary btn-compact` button, or nothing. */
  action?: { label: string; onClick: () => void; busy?: boolean; busyLabel?: string };
}) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-control bg-warning-surface p-card">
      <span aria-hidden="true" className="mt-px shrink-0 text-warning [&>svg]:size-5">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-text-primary">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-text-secondary">{children}</p>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            disabled={action.busy}
            className="btn-secondary btn-compact mt-3"
          >
            {action.busy ? action.busyLabel ?? action.label : action.label}
          </button>
        )}
      </div>
    </div>
  );
}

const glyph = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

// Lucide `file-warning`, `cloud-off`, `user-x`, `refresh-cw-off` — UI
// affordances, inlined (component rules: Lucide for affordances).
export function FileWarningMark() {
  return glyph(<>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </>);
}
export function CloudOffMark() {
  return glyph(<>
    <path d="m2 2 20 20" />
    <path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193" />
    <path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07" />
  </>);
}
export function UserOffMark() {
  return glyph(<>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="m17 8 5 5" />
    <path d="m22 8-5 5" />
  </>);
}
export function UpdateMark() {
  return glyph(<>
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l3 2" />
  </>);
}
