import type { Attack } from '../types';
import { IMPACT_OPTIONS } from '../utils/impact';

// The predicate deciding *whether* to show this — `attackAwaitingImpact` — is
// in utils/impact.ts, not here: a component file that also exports a plain
// function loses fast refresh.

interface Props {
  onAnswer: (impact: NonNullable<Attack['impact']>) => void;
  onDismiss: () => void;
}

// Deliberately not part of the hero card: that card owns artwork, a gradient
// and a width-limited text block (see docs/today-cards.md), and four pills
// don't belong inside it. Its own card, below the hero, above TodaySummary.
//
// One tap answers and it's gone — no Cancel/Confirm pair, because there is
// nothing to confirm and no state to lose. That's the whole reason this beat
// asking inside the end-attack dialog, where the question had to be answered
// in the same breath as closing the attack down.
export function ImpactPrompt({ onAnswer, onDismiss }: Props) {
  return (
    <div className="relative rounded-xl bg-bg-surface p-4">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-bg-raised hover:text-text-primary"
      >
        <span aria-hidden="true">✕</span>
      </button>

      {/* The full question, not a short label: IMPACT_OPTIONS are bare degrees
          ("A little") that only mean something under a question supplying the
          context, and here there's no dialog title to lean on. */}
      <p className="pr-8 text-sm text-text-primary">
        How much did your last attack stop you doing things?
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {IMPACT_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onAnswer(value)}
            className="rounded-full bg-bg-raised px-3 py-1.5 text-sm text-text-primary ring-1 ring-inset ring-bg-border transition-colors hover:bg-bg-border"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
