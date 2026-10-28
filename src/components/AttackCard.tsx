import type { Attack, Medication } from '../types';
import { formatDate, formatTime, formatDuration } from '../utils/format';
import { attackDoseOutcomes, attackMaxSeverity, type DoseOutcome } from '../utils/stats';
import { attackSide, SIDE_LABELS } from '../utils/laterality';
import { findMedication } from '../utils/medGuardrails';
import { classLetter } from '../utils/medClasses';
import { peakShade } from '../utils/severity';
import { isRetired } from '../utils/retired';
import { SideGlyph, SymptomIcon } from './drawnIcons';
import { ClassBadge } from './ClassBadge';
import { VerdictMark } from './VerdictMark';

// A Logs row — the v3.10 design (docs/redesign-v3, "Logs list and attack
// detail"), 2026-10-26: what matters at a glance, in the order it's asked.
//
//   1. **How long** — the headline. ICHD-3 1.1 defines migraine as attacks of
//      4–72 hours untreated, so length is diagnostic, not just context.
//   2. **How bad at worst** — the peak as a shaded number (`peakShade`), with
//      "peak" beside it; the side as a head on the right, which is half an
//      ICHD-3 criterion (unilateral).
//   3. **When** — day and start time.
//   4. **What was taken, and whether it helped** — one badge per drug with ✓
//      helped, – didn't help, or ? no 2-hour reading, by the same rule
//      Insights scores with. A missing reading is never "didn't help".
//   5. **The ICHD symptoms** — nausea/vomiting and light/sound sensitivity,
//      as icons at the right: criterion C, part of what makes an attack
//      migraine. Other symptoms, triggers and the average are not on the row.
//
// The whole row is one button whose label says all of it in words, so the
// marks are `aria-hidden`.

interface Props {
  attack: Attack;
  onClick: () => void;
  isOngoing?: boolean;
  /** The library — for each drug's type letter. */
  medications?: Medication[];
}

const ICHD_SYMPTOM = /nausea|queasy|vomit|sick\b|light|photophobia|glare|bright|sound|noise|phonophobia/i;

const VERDICT_WORDS: Record<DoseOutcome['verdict'], string> = {
  helped: 'helped',
  'not-helped': "didn't help",
  pending: '2-hour reading to come',
  'no-reading': 'no 2-hour reading',
};

export function AttackCard({ attack, onClick, isOngoing, medications = [] }: Props) {
  const peak = attackMaxSeverity(attack);
  const side = attackSide(attack);
  const start = attack.snapshots[0].time;
  const outcomes = attackDoseOutcomes(attack);
  const symptoms = [...new Set(attack.snapshots.flatMap((s) => s.symptoms ?? []))]
    .filter((x) => !isRetired(x) && ICHD_SYMPTOM.test(x));

  // No running length while ongoing: it would have to tick to stay honest,
  // and a tick per row re-renders the whole list for a figure Today shows.
  const headline = isOngoing ? 'Ongoing' : formatDuration(start, attack.end);
  const when = `${formatDate(start)} · ${formatTime(start)}`;
  const label = [
    headline,
    `peak ${peak}`,
    side ? SIDE_LABELS[side].toLowerCase() : null,
    when,
  ].filter(Boolean).join(', ') + '. ' + (outcomes.length
    ? outcomes.map((o) => `${o.name} ${VERDICT_WORDS[o.verdict]}`).join(', ')
    : 'No medication') + (symptoms.length ? `. ${symptoms.join(', ')}` : '');

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex w-full flex-col gap-1.5 rounded-card bg-bg-surface px-4 py-3.5 text-left transition-colors hover:bg-bg-raised ${
        isOngoing ? 'ring-1 ring-inset ring-accent/40' : ''
      }`}
    >
      <span aria-hidden="true" className="flex items-center gap-2">
        <span className="text-[1.5rem] font-semibold leading-tight tabular-nums text-text-primary">{headline}</span>
        <span
          className="ml-1.5 inline-flex h-[1.875rem] min-w-[1.875rem] items-center justify-center rounded-[0.5625rem] px-1 font-bold tabular-nums text-text-primary ring-1 ring-inset ring-bg-border"
          style={{ background: peakShade(peak) }}
        >
          {peak}
        </span>
        <span className="text-xs text-text-secondary">peak</span>
        <span className="flex-1" />
        {/* `null` draws nothing — an empty head would read as "neither side". */}
        {side && <SideGlyph side={side} className="h-[2.125rem] w-auto text-text-secondary" />}
      </span>
      <span aria-hidden="true" className="block text-xs text-text-secondary">{when}</span>
      {(outcomes.length > 0 || symptoms.length > 0) && (
        <span aria-hidden="true" className="flex min-h-[1.875rem] flex-wrap items-center gap-2">
          {outcomes.map((o) => (
            <span key={o.name} className="inline-flex items-center gap-1 rounded-badge bg-bg-base py-0.5 pl-0.5 pr-2 text-text-primary">
              <ClassBadge small>{classLetter(findMedication(medications, o.name)?.class) ?? '–'}</ClassBadge>
              <VerdictMark verdict={o.verdict} />
            </span>
          ))}
          <span className="flex-1" />
          {symptoms.map((s) => (
            <SymptomIcon key={s} name={s} className="h-6 w-6 text-text-secondary" />
          ))}
        </span>
      )}
    </button>
  );
}
