import type { Attack, Medication } from '../types';
import { formatDate, formatDuration, upToText } from '../utils/format';
import { attackDoseOutcomes, hasKnownDuration } from '../utils/stats';
import { SummaryFooter, SummaryList } from './AttackSummaryParts';
import { useHeadingFocus } from '../hooks/useHeadingFocus';
import { amountText, beforeText, marksOf, outcomeText, worstText, type SummaryRow } from '../utils/attackSummary';

/**
 * The closing screen of "Add a past attack": `MrgPastSavedDark` in
 * `docs/redesign-v4/screens/21-past-attack/` (backlog item 18 in
 * `docs/decisions.md`). Backfilling an older attack changes nothing on Today,
 * so without this the sheet closing was the only sign the save happened. It
 * also reads the entry back while it's fresh, and "Add another past attack"
 * makes entering several from a paper diary one tap each.
 *
 * Reads the **stored** attack `startAttack` returned, not the form, so what it
 * says is what was written. Where the board breaks a settled rule, the rule
 * wins (see `utils/attackSummary.ts` for the shared ones):
 * - no "Stopped you" row — impact is asked only in `EndAttackForm`;
 * - "gone when you woke up" has no length: "ended in sleep", or "up to Xh"
 *   once a wake-up time is given — as on Detail (`upToText`).
 */
export function PastAttackSaved({ attack, medications, onAddAnother, onDone }: {
  attack: Attack;
  medications: Medication[];
  onAddAnother: () => void;
  onDone: () => void;
}) {
  const headingRef = useHeadingFocus();

  const start = attack.snapshots[0].time;
  // Same three cases as Detail's LengthTile: a known length; an unknown end
  // with a wake-up time is a ceiling ("up to 3h", rounded up); without one,
  // "ended in sleep". Past attacks can now carry `wokeAt` from the form.
  const length = hasKnownDuration(attack)
    ? formatDuration(start, attack.end)
    : attack.wokeAt
      ? `up to ${upToText(start, attack.wokeAt)}`
      : 'ended in sleep';
  const quality = attack.painQuality ?? [];
  const symptoms = marksOf(attack, 'symptoms');
  const reliefs = marksOf(attack, 'reliefs');
  const before = beforeText(attack);
  const note = attack.snapshots[0].note;

  const rows: SummaryRow[] = [
    { key: 'worst', label: 'Worst', value: worstText(attack) },
    ...(attack.wokeWithMigraine ? [{ key: 'woke', label: 'Woke up with it', value: 'Yes' }] : []),
    ...(quality.length ? [{ key: 'quality', label: 'Felt like', value: quality.join(', ') }] : []),
    // "Sumatriptan · 1 tablet · helped a bit"
    ...attackDoseOutcomes(attack).map((o, i) => ({
      key: `dose-${i}`, label: i === 0 ? 'Taken' : '', srLabel: 'Taken',
      value: [o.name, amountText(o, attack, medications), outcomeText(o)].filter(Boolean).join(' · '),
    })),
    ...(symptoms.length ? [{ key: 'symptoms', label: 'Also had', value: symptoms.join(', ') }] : []),
    ...(reliefs.length ? [{ key: 'reliefs', label: 'Tried', value: reliefs.join(', ') }] : []),
    ...(before ? [{ key: 'before', label: 'Two days before', value: before }] : []),
    ...(note ? [{ key: 'note', label: 'Note', value: note }] : []),
  ];

  return (
    // The page colour, not the sheet's own `bg-surface`: the board draws this
    // on the page, and the list is a card on it — on `bg-surface` the card
    // would vanish. Same as `FeedbackHandedOff`, the other "done" screen.
    <div className="flex min-h-0 w-full flex-1 flex-col bg-bg-base">
      <div
        className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-5 overflow-y-auto px-gutter pb-4 sm:px-gutter-wide"
        style={{ paddingTop: 'calc(4.25rem + env(safe-area-inset-top))' }}
      >
        <div className="flex flex-col items-center gap-3.5 text-center">
          <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-full bg-selected-fill ring-1 ring-inset ring-accent">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="size-[1.875rem] text-accent">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <h1 ref={headingRef} tabIndex={-1} className="text-[1.625rem] font-semibold leading-tight text-text-strong outline-none">
            Added to your log
          </h1>
          <p className="text-sm text-text-secondary">{formatDate(start)} · {length}</p>
        </div>
        <SummaryList rows={rows} />
      </div>
      <SummaryFooter secondary="Add another past attack" onSecondary={onAddAnother} onDone={onDone} />
    </div>
  );
}
