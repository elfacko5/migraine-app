import type { Attack } from '../types';
import { formatDatetime, formatDuration, formatTime } from '../utils/format';
import { attackDoseOutcomes, hasKnownDuration } from '../utils/stats';
import { END_IMPACT_LABELS } from '../utils/impact';
import { SummaryFooter, SummaryList } from './AttackSummaryParts';
import { useHeadingFocus } from '../hooks/useHeadingFocus';
import { beforeText, capitalise, marksOf, outcomeText, worstText, type SummaryRow } from '../utils/attackSummary';

const DAY_MS = 24 * 60 * 60 * 1000;
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** "today 20:25" / "yesterday 20:25" / "Mon 23 Nov, 20:25". */
function startedAt(iso: string, now: Date): string {
  const d = new Date(iso);
  if (sameDay(d, now)) return `today ${formatTime(iso)}`;
  if (sameDay(d, new Date(now.getTime() - DAY_MS))) return `yesterday ${formatTime(iso)}`;
  return formatDatetime(iso);
}

/**
 * The closing screen of "End attack": `End24SummaryDark` in
 * `docs/redesign-v4/screens/24-end/` (backlog item 18 in `docs/decisions.md`).
 * The one place the whole attack is read back together, with "Open the entry"
 * leading straight into Detail while its edit windows are open.
 *
 * Reads the attack **as stored** after `endAttack`. Where the board breaks a
 * settled rule, the rule wins (shared ones in `utils/attackSummary.ts`):
 * - "gone when you woke up" is never a length — the board's "About 11 h" is
 *   dropped, the sub-line says only when it started, and the Ended row says
 *   how it ended instead of a time;
 * - "Stopped you" shows only when answered (`undefined` is not "carried on").
 */
export function AttackEndedSummary({ attack, onOpenEntry, onDone }: {
  attack: Attack;
  onOpenEntry: () => void;
  onDone: () => void;
}) {
  const headingRef = useHeadingFocus();
  // Read once, when the summary appears; it doesn't tick.
  const now = new Date();

  const start = attack.snapshots[0].time;
  const known = hasKnownDuration(attack);
  const sub = known
    ? `${formatDuration(start, attack.end)} · started ${startedAt(start, now)}`
    : `Started ${startedAt(start, now)}`;
  const ended = !known || !attack.end
    ? 'Gone when you woke up'
    : sameDay(new Date(start), new Date(attack.end)) ? formatTime(attack.end) : formatDatetime(attack.end);

  const doses = attackDoseOutcomes(attack);
  // A drug taken more than once gets its time, or its rows read the same.
  const repeated = new Set(doses.map((o) => o.name).filter((n, i, all) => all.indexOf(n) !== i));
  const quality = attack.painQuality ?? [];
  const symptoms = marksOf(attack, 'symptoms');
  const reliefs = marksOf(attack, 'reliefs');
  const before = beforeText(attack);

  const rows: SummaryRow[] = [
    { key: 'ended', label: 'Ended', value: ended },
    { key: 'worst', label: 'Worst', value: worstText(attack) },
    // "Sumatriptan 50 mg" → "Helped a bit"; "Treo 500/50 mg × 2" → …
    ...doses.map((o, i) => ({
      key: `dose-${i}`,
      label: [
        `${o.name}${o.dose ? ` ${o.dose}` : ''}${o.amount && o.amount > 1 ? ` × ${o.amount}` : ''}`,
        repeated.has(o.name) ? formatTime(o.time) : null,
      ].filter(Boolean).join(', '),
      value: capitalise(outcomeText(o)),
    })),
    ...(attack.impact !== undefined ? [{ key: 'impact', label: 'Stopped you', value: END_IMPACT_LABELS[attack.impact] }] : []),
    ...(quality.length ? [{ key: 'quality', label: 'Felt like', value: quality.join(', ') }] : []),
    ...(symptoms.length ? [{ key: 'symptoms', label: 'Also had', value: symptoms.join(', ') }] : []),
    ...(reliefs.length ? [{ key: 'reliefs', label: 'Tried', value: reliefs.join(', ') }] : []),
    ...(before ? [{ key: 'before', label: 'Two days before', value: before }] : []),
  ];

  return (
    // Page colour, not the sheet's `bg-surface` — see `PastAttackSaved`.
    <div className="flex min-h-0 w-full flex-1 flex-col bg-bg-base">
      <div
        className="mx-auto flex w-full max-w-2xl items-center justify-end px-3.5 pt-3.5"
        style={{ paddingTop: 'calc(0.875rem + env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={onDone}
          aria-label="Close"
          className="tap-44 flex size-target items-center justify-center rounded-full bg-bg-raised text-text-primary transition-colors hover:bg-bg-elevated"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
            <path d="M7 7l10 10M17 7 7 17" />
          </svg>
        </button>
      </div>
      <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-5 overflow-y-auto px-gutter pb-4 pt-5 sm:px-gutter-wide">
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="text-[1.625rem] font-semibold leading-tight text-text-strong outline-none">
            Attack ended
          </h1>
          <p className="mt-1.5 text-sm text-text-secondary">{sub}</p>
        </div>
        <SummaryList rows={rows} />
      </div>
      <SummaryFooter secondary="Open the entry" onSecondary={onOpenEntry} onDone={onDone} />
    </div>
  );
}
