import type { Attack } from '../types';
import { doseCheckIn } from '../utils/stats';
import { useNowTick } from '../hooks/useNowTick';
import { TODAY_CARD } from '../utils/todayCard';
import { CircleCheckIcon, ClockIcon } from './icons';

// The two-hour check-in after a dose, on Today (v3, 2026-10-26). Two hours is
// the standard trial endpoint for acute treatment, and a reading near it is
// what `medicationResponse` on Insights later scores the dose by — so this is
// the one question on Today whose answer is worth more for being given on
// time.
//
// **It and the reminder ask the same question, and whichever is answered
// first ends both.** The card reads the snapshots, so a reading from any path
// — this card, an ordinary update, the reminder's own buttons — replaces it
// with the answered line. The reminder side is `medCheckInDelay`, which stops
// re-timing a reminder at the check-in once `doseCheckIn` says it's answered.
//
// **A tint, never the solid accent.** Solid accent means *press this* and is
// the FAB's alone on Today; the selected-state tint plus a 2px accent ring
// marks this as the card that wants attention without becoming a second FAB.
// Shown in attack mode too: it bears on the next hour, the same reason
// `ImpactPrompt` shows there.
export function CheckInCard({ attack, onOpen }: { attack: Attack; onOpen: () => void }) {
  // The window opens and closes on the clock, not on any state change.
  useNowTick(60_000);
  const checkIn = doseCheckIn(attack);
  if (!checkIn) return null;

  if (checkIn.state === 'answered') {
    // Kept while the attack runs, as a plain fact rather than a card: it is
    // the answer to a question already asked, and nothing to press.
    return (
      <p className="flex items-center gap-2 px-1 text-[0.9375rem] text-text-secondary">
        <CircleCheckIcon className="h-5 w-5 shrink-0" />
        At 2 hours: pain {checkIn.severity}
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${TODAY_CARD} flex w-full items-center gap-3.5 bg-accent/20 text-left ring-2 ring-inset ring-accent transition-colors hover:bg-accent/25`}
    >
      <ClockIcon className="h-[1.875rem] w-[1.875rem] shrink-0 text-accent" />
      <span className="min-w-0">
        <span className="block text-[1.125rem] font-semibold text-text-primary">2-hour check-in</span>
        <span className="block text-xs text-text-secondary">How is it after {checkIn.name}?</span>
      </span>
    </button>
  );
}
