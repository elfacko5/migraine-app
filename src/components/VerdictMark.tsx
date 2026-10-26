import type { DoseVerdict } from '../utils/stats';

// The mark beside a dose — ✓ helped, – didn't help, ? no two-hour reading
// (yet, or at all). Shapes, not colours, so the verdict survives FL-41 lenses
// and a screen reader gets the words from the row's own label. Lucide-style
// strokes in currentColor, to the app's icon contract.
const PATH: Record<DoseVerdict, string> = {
  helped: 'M5 12l5 5 9-10',
  'not-helped': 'M6 12h12',
  pending: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5h.01',
  'no-reading': 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5h.01',
};

export function VerdictMark({ verdict, className = 'h-4 w-4' }: { verdict: DoseVerdict; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATH[verdict]} />
    </svg>
  );
}
