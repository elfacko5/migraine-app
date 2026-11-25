import type { SummaryRow } from '../utils/attackSummary';

// The card and footer `PastAttackSaved` and `AttackEndedSummary` share; the
// readings behind their rows are in `utils/attackSummary.ts`.

/** The label/value card. A row with an empty label continues the one above
 *  (a second dose under "Taken"); `srLabel` gives it a term to read. */
export function SummaryList({ rows }: { rows: SummaryRow[] }) {
  return (
    <dl className="overflow-hidden rounded-card bg-bg-surface [&>*+*]:border-t [&>*+*]:border-bg-border">
      {rows.map((r) => (
        <div key={r.key} className="flex min-h-14 items-center gap-3 px-4 py-3">
          <dt className="max-w-[45%] shrink-0 text-sm text-text-secondary [overflow-wrap:anywhere]">
            {r.label || <span className="sr-only">{r.srLabel ?? ''}</span>}
          </dt>
          <dd className="min-w-0 flex-1 text-right text-base font-semibold text-text-primary [overflow-wrap:anywhere]">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Secondary above primary, both the wizards' CTA size, on the page colour. */
export function SummaryFooter({ secondary, onSecondary, onDone }: { secondary: string; onSecondary: () => void; onDone: () => void }) {
  return (
    <div
      className="mx-auto flex w-full max-w-2xl flex-col gap-2.5 px-gutter pt-3 sm:px-gutter-wide"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      <button type="button" onClick={onSecondary} className="btn-secondary btn-cta w-full">{secondary}</button>
      <button type="button" onClick={onDone} className="btn-primary btn-cta w-full">Done</button>
    </div>
  );
}
