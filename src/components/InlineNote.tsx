import type { ReactNode } from 'react';
import { WarningIcon } from './icons';

// An inline message inside a screen: the neutral "here is context" note and the
// amber "worth a look" note the add wizard uses (already added, a form that
// repeats, a usual dose above the limit). Built from the box QuickUpdateForm's
// last-entry caption already draws, in a second tone.
//
// **Neither tone is an alarm and neither blocks anything on its own** — the
// copy states what is true and stops. The amber one is told apart by its mark
// (the triangle), not by colour alone, and its text stays `text-secondary`:
// only the icon is amber, so a third coloured line never competes with the
// real warnings. `role="status"` so a note that appears after a tap is read
// out without taking focus.
export function InlineNote({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'amber';
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-field border border-bg-border bg-bg-raised/50 px-3 py-2.5"
    >
      {tone === 'amber' ? (
        <WarningIcon className="mt-px h-3.5 w-3.5 shrink-0 text-severity-mid" />
      ) : (
        <svg
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round"
          className="mt-px h-3.5 w-3.5 shrink-0 text-text-secondary" aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      )}
      <p className="text-xs leading-relaxed text-text-secondary">{children}</p>
    </div>
  );
}
