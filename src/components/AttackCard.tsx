import type { Attack } from '../types';
import { formatDateShort, formatTime, formatDuration } from '../utils/format';
import { attackDoseOutcomes, attackMaxSeverity, type DoseOutcome } from '../utils/stats';
import { attackSide, SIDE_LABELS } from '../utils/laterality';
import { SideGlyph } from './drawnIcons';

// A Logs row, v3 (2026-10-26, rebuilt to the v3.1 design on Sunny's ask). It
// answers four questions, each in one place, and nothing else:
//
//   - **How long** — the title, after the start time. ICHD-3 1.1 defines
//     migraine as attacks of 4–72 hours untreated, so length is diagnostic.
//   - **How bad at worst** — the badge. Peak is what ICHD's "moderate or
//     severe intensity" speaks to; the time-weighted average the row used to
//     lead with stays on Insights and in the detail's breakdown.
//   - **Which side** — the head, with its side named again in the subtitle so
//     it is never a picture alone. Unilateral is half an ICHD-3 criterion.
//   - **Did it help** — the first drug's two-hour reading (`attackDoseOutcomes`,
//     the same rule Insights scores by). The most actionable fact about acute
//     treatment, and the one a scanned history never showed.
//
// What went: symptom and medication chips, impact, the sparkline and the
// waking mark. All of it is still on Attack detail; a row that tried to carry
// it was being read rather than scanned.
//
// **The badge is not severity-coloured.** On the v3 row it is a neutral tile,
// like the hero's plain-text figures; the number carries the value, and a
// screen reader gets "peak 7".

interface Props {
  attack: Attack;
  onClick: () => void;
  isOngoing?: boolean;
  /** The list isn't grouped under date headers (a non-date sort), so the row
   *  has to say its own date. */
  showDate?: boolean;
}

/** "Did it help", in a few words. A missing reading is stated as missing —
 *  never as "didn't help", which would be a claim about the drug. */
function verdictText(o: DoseOutcome): string {
  switch (o.verdict) {
    case 'helped': return `${o.name} helped`;
    case 'not-helped': return `${o.name} didn't help`;
    case 'pending': return `${o.name} · 2-hour reading to come`;
    case 'no-reading': return `${o.name} · no 2-hour reading`;
  }
}

export function AttackCard({ attack, onClick, isOngoing, showDate = false }: Props) {
  const peak = attackMaxSeverity(attack);
  const side = attackSide(attack);
  const start = attack.snapshots[0];
  const outcomes = attackDoseOutcomes(attack);

  const title = [
    showDate ? formatDateShort(start.time) : null,
    formatTime(start.time),
    // No running length while ongoing: it would have to tick to stay honest,
    // and a tick per row re-renders the whole list for a figure Today shows.
    isOngoing ? 'ongoing' : formatDuration(start.time, attack.end),
  ].filter(Boolean).join(' · ');

  const help = outcomes.length === 0
    ? 'No medication'
    : verdictText(outcomes[0]) + (outcomes.length > 1 ? ` +${outcomes.length - 1}` : '');

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-[1.25rem] bg-bg-surface px-3.5 py-3 text-left transition-colors hover:bg-bg-raised ${
        isOngoing ? 'ring-1 ring-inset ring-accent/40' : ''
      }`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-bg-raised text-[1.125rem] font-semibold tabular-nums text-text-primary">
        <span className="sr-only">Peak </span>{peak}
      </span>
      {/* Always the same width, so every title starts at one x whether or not
          a side was recorded. `null` draws nothing — an empty head would read
          as "neither side". */}
      <span aria-hidden="true" className="flex w-7 shrink-0 justify-center text-text-secondary">
        {side && <SideGlyph side={side} className="h-[2.125rem] w-auto" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-text-primary">{title}</span>
        <span className="block text-xs text-text-secondary">
          {[side ? SIDE_LABELS[side] : null, help].filter(Boolean).join(' · ')}
        </span>
      </span>
    </button>
  );
}
