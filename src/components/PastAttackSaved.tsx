import { useEffect, useRef } from 'react';
import type { Attack, Medication } from '../types';
import { NOTHING_UNUSUAL } from '../types';
import { formatDate, formatDuration } from '../utils/format';
import { attackDoseOutcomes, attackMaxSeverity, doseOutcomeWord, hasKnownDuration, type DoseOutcome } from '../utils/stats';
import { attackSide, SIDE_LABELS } from '../utils/laterality';
import { unitsLabel } from '../utils/medGuardrails';
import { resolveDose } from '../utils/medResolve';
import { isRetired } from '../utils/retired';

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
 * wins:
 * - no "Stopped you" row — impact is asked only in `EndAttackForm`;
 * - location is a side ("left side"), never a zone ("left temple");
 * - "gone when you woke up" has no length: "ended in sleep", as on Detail;
 * - a dose's outcome is `doseOutcomeWord` from its 2 h reading (A1), and a
 *   dose without one says so rather than being left out or called "no help".
 */
export function PastAttackSaved({ attack, medications, onAddAnother, onDone }: {
  attack: Attack;
  medications: Medication[];
  onAddAnother: () => void;
  onDone: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Focus moves to the heading so a screen reader announces the save; the
  // step content it replaced no longer exists.
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, []);

  const start = attack.snapshots[0].time;
  const length = hasKnownDuration(attack) ? formatDuration(start, attack.end) : 'ended in sleep';
  const worst = attackMaxSeverity(attack);
  const side = attackSide(attack);
  const opening = attack.snapshots[0];
  const quality = attack.painQuality ?? [];
  const symptoms = opening.symptoms.filter((s) => !isRetired(s));
  const reliefs = opening.reliefs.filter((r) => !isRetired(r));
  const before = attack.triggers.filter((t) => t !== NOTHING_UNUSUAL && !isRetired(t)).join(', ')
    || (attack.triggers.includes(NOTHING_UNUSUAL) ? 'Nothing unusual' : '');
  const doses = attackDoseOutcomes(attack);

  const rows: Array<{ key: string; label: string; value: string }> = [
    { key: 'worst', label: 'Worst', value: side ? `${worst} · ${SIDE_LABELS[side].toLowerCase()}` : String(worst) },
    ...(attack.wokeWithMigraine ? [{ key: 'woke', label: 'Woke up with it', value: 'Yes' }] : []),
    ...(quality.length ? [{ key: 'quality', label: 'Felt like', value: quality.join(', ') }] : []),
    ...doses.map((o, i) => ({ key: `dose-${i}`, label: i === 0 ? 'Taken' : '', value: doseText(o, attack, medications) })),
    ...(symptoms.length ? [{ key: 'symptoms', label: 'Also had', value: symptoms.join(', ') }] : []),
    ...(reliefs.length ? [{ key: 'reliefs', label: 'Tried', value: reliefs.join(', ') }] : []),
    ...(before ? [{ key: 'before', label: 'Two days before', value: before }] : []),
    ...(opening.note ? [{ key: 'note', label: 'Note', value: opening.note }] : []),
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

        <dl className="overflow-hidden rounded-card bg-bg-surface [&>*+*]:border-t [&>*+*]:border-bg-border">
          {rows.map((r) => (
            <div key={r.key} className="flex min-h-14 items-center gap-3 px-4 py-3">
              {/* An empty label is a second dose under "Taken"; it still needs
                  a term for the list to read in order. */}
              <dt className="max-w-[40%] shrink-0 text-sm text-text-secondary">{r.label || <span className="sr-only">Taken</span>}</dt>
              <dd className="min-w-0 flex-1 text-right text-base font-semibold text-text-primary [overflow-wrap:anywhere]">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div
        className="mx-auto flex w-full max-w-2xl flex-col gap-2.5 px-gutter pt-3 sm:px-gutter-wide"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <button type="button" onClick={onAddAnother} className="btn-secondary btn-cta w-full">Add another past attack</button>
        <button type="button" onClick={onDone} className="btn-primary btn-cta w-full">Done</button>
      </div>
    </div>
  );
}

/** "Sumatriptan · 1 tablet · helped a bit". The words are `doseOutcomeWord`'s
 *  three, read off the 2 h reading; with no reading, that is said instead. */
function doseText(o: DoseOutcome, attack: Attack, medications: Medication[]): string {
  const snap = attack.snapshots.find((s) => s.time === o.time && s.medication?.name?.trim() === o.name);
  const lib = resolveDose(snap?.medication, medications).med;
  const amount = o.amount ? unitsLabel(o.amount, lib) : o.dose;
  const outcome = o.after === null
    ? 'no 2 h reading'
    : { Helped: 'helped', 'A bit': 'helped a bit', No: 'didn’t help' }[doseOutcomeWord(o.before, o.after)];
  return [o.name, amount, outcome].filter(Boolean).join(' · ');
}
