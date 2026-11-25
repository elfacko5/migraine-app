import type { Attack } from '../types';
import { formatDuration } from '../utils/format';
import { attackMaxSeverity, hasKnownDuration, maxSeverity } from '../utils/stats';
import { sevFillClass } from '../utils/severity';
import { cardSymptoms, type CardSymptom } from '../utils/cardSymptoms';
import { useNowTick } from '../hooks/useNowTick';
import { LightIcon, NauseaIcon, SoundIcon, SymptomIcon, TabletIcon } from './drawnIcons';

// A Logs row — option "D2" of the 2026-11-25 exploration (docs/decisions.md),
// replacing the v3.10 row. What it carries, and what it deliberately doesn't:
//
//   - **Date block, length, and the worst pain as a coloured number.** No start
//     or end time and no "peak" label: the times were noise beside the length,
//     and a label repeated on every row says nothing. The ongoing row keeps
//     "now", because there the number means something different.
//   - **One row of small marks:** a tablet and the number of doses, and the
//     symptoms (rules in `utils/cardSymptoms.ts`).
//   - **Not the side.** Drawn as a head it couldn't be read without a label
//     (mirrored like the picker, so a left attack shades the right half), and
//     one attack's side says little: what matters is a pattern, which Insights'
//     Where it hurt shows and the Side filter can ask for. Detail keeps it.
//   - **Not whether a medicine helped.** That's a question about a pattern,
//     which Insights answers per drug, or about one dose, which the attack's
//     page answers. A ✓/– per row answered neither and made the row busy.
//
// The whole row is one button whose label says it in words; the marks are
// `aria-hidden`.

interface Props {
  attack: Attack;
  onClick: () => void;
  isOngoing?: boolean;
  /** Off a date-sorted list there are no month headers, so the date block
   *  names the month in place of the weekday. */
  showMonth?: boolean;
}

const SYMPTOM_ICON: Record<CardSymptom, typeof NauseaIcon> = { nausea: NauseaIcon, light: LightIcon, sound: SoundIcon };

// The chips sit one surface *up* from the card, not recessed into it: on the
// phone the `bg-base` recess read as dark holes in the card (2026-11-25).
const TOKEN = 'inline-flex h-6 items-center gap-1.5 rounded-lg px-1.5 text-xs text-text-secondary';

export function AttackCard({ attack, onClick, isOngoing, showMonth = false }: Props) {
  const start = new Date(attack.snapshots[0].time);
  const severity = isOngoing ? maxSeverity(attack.snapshots[attack.snapshots.length - 1]) : attackMaxSeverity(attack);
  const doses = attack.snapshots.filter((s) => s.medication?.name?.trim()).length;
  const { marks: symptoms, more } = cardSymptoms(attack.snapshots.flatMap((s) => s.symptoms ?? []));
  const marks = doses > 0 || symptoms.length > 0;
  const chip = `${TOKEN} ${isOngoing ? 'bg-bg-elevated' : 'bg-bg-raised'}`;
  const length = !hasKnownDuration(attack) && !isOngoing ? 'Length not recorded' : null;
  const day = start.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  const label = [
    isOngoing ? `Ongoing, pain ${severity} now` : `${day}, ${length ?? formatDuration(attack.snapshots[0].time, attack.end)}, worst pain ${severity}`,
    doses ? `${doses} ${doses === 1 ? 'dose' : 'doses'}` : 'no medication',
    ...symptoms.map((m) => m.name.toLowerCase()),
    more ? `${more} more ${more === 1 ? 'symptom' : 'symptoms'}` : null,
  ].filter(Boolean).join(', ');

  return (
    // A grid rather than a flex row so the marks can take the full width when
    // the card runs short of room (large text): below 20rem — about 112% text
    // on a 375pt phone — the number and chevron give up their second row and
    // the marks run under them, instead of stacking one per line in a column
    // too narrow to hold "2h 13m". In that layout the number shares the
    // first row with the length, so the length centres on it rather than
    // sitting at the row's foot — the taller number box set the row's
    // height and left the length sunk below it (large text, 2026-11-25).
    // The chevron goes in that layout: at XL its column left the length too
    // little room and it ran under the number. The whole card is the button,
    // so the chevron was a hint, not the target.
    <div className="@container">
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] @max-[20rem]:grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1.5 rounded-card min-h-[4.75rem] py-3.5 pl-4 pr-3.5 text-left transition-colors ${
        // The v4 board's row: 76px, 14/14/14/16 padding, 14px gaps. The
        // ongoing row is outlined as well as lifted (its `.live`), so it
        // reads as a different kind of row, not just a lighter one. The
        // outline is decoration, not a control edge — "Ongoing ·" and the dot
        // say what the row is — so it takes the board's faint border-subtle
        // (about 1.4:1), not the 3:1 border-control (Sunny, 2026-11-25).
        isOngoing ? 'bg-bg-raised ring-1 ring-inset ring-border-subtle hover:bg-bg-elevated' : 'bg-bg-surface hover:bg-bg-raised'
      }`}
    >
      <span aria-hidden="true" className="row-span-2 flex w-10 flex-col items-center">
        {isOngoing ? (
          <span className="h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-accent/25" />
        ) : (
          <>
            <span className="text-lg font-semibold leading-none tabular-nums text-text-strong">{start.getDate()}</span>
            <span className="mt-0.5 text-xs font-medium uppercase tracking-[0.04em] text-text-secondary">
              {start.toLocaleDateString(undefined, showMonth ? { month: 'short' } : { weekday: 'short' })}
            </span>
          </>
        )}
      </span>

      <span aria-hidden="true" className={`col-start-2 text-base font-semibold leading-snug tabular-nums text-text-strong ${marks ? 'self-end @max-[20rem]:self-center' : 'row-span-2'}`}>
        {isOngoing ? <>Ongoing · <span className="whitespace-nowrap"><OngoingLength start={attack.snapshots[0].time} /></span></> : length ?? <span className="whitespace-nowrap">{formatDuration(attack.snapshots[0].time, attack.end)}</span>}
      </span>

      {marks && (
          <span aria-hidden="true" className="col-start-2 row-start-2 flex flex-wrap gap-1.5 self-start @max-[20rem]:col-end-4">
            {doses > 0 && (
              <span className={`${chip} tabular-nums`}>
                <TabletIcon className="h-[0.875rem] w-[0.875rem]" />
                {doses}
              </span>
            )}
            {symptoms.length > 0 && (
              <span className={chip}>
                {symptoms.map((m) => {
                  if (m.kind === null) return <SymptomIcon key={m.name} name={m.name} className="h-4 w-4" />;
                  const Icon = SYMPTOM_ICON[m.kind];
                  return <Icon key={m.kind} className="h-4 w-4" />;
                })}
                {more > 0 && <span className="tabular-nums">+{more}</span>}
              </span>
            )}
          </span>
      )}

      <span aria-hidden="true" className={`col-start-3 row-start-1 row-span-2 flex flex-col items-center gap-0.5 ${marks ? '@max-[20rem]:row-span-1' : ''}`}>
        <span className={`flex h-9 min-w-9 items-center justify-center rounded-segment px-1.5 text-sm font-semibold tabular-nums text-bg-base ${sevFillClass(severity)}`}>
          {severity}
        </span>
        {isOngoing && <span className="text-xs text-text-secondary">now</span>}
      </span>

      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="col-start-4 row-start-1 row-span-2 h-4 w-4 text-text-secondary @max-[20rem]:hidden">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
    </div>
  );
}

/** The one live figure in the list, ticking on its own so the rest don't. */
function OngoingLength({ start }: { start: string }) {
  useNowTick();
  return <>{formatDuration(start, null)}</>;
}
