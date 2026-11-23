import { formatSinceLong, greeting } from '../utils/format';
import { useNowTick } from '../hooks/useNowTick';
import { HomeCard } from './HomeCard';
import { AttackFreeArt } from './heroArt';

interface Props {
  lastEnd: string;
  /** The attack mode button, pinned to the hero's corner. */
  topAction?: React.ReactNode;
}

/**
 * Shown on the Today tab when no attack is ongoing — how long since the last
 * one ended.
 *
 * **It carries no action, deliberately.** It used to hold a "Log an attack"
 * button, which was the same action as the nav's FAB in a second, louder
 * place: two solid-accent targets in one viewport, on a screen where accent
 * means "this is the thing to press". The FAB is the one that survives,
 * because it is also reachable from the other three tabs. The first-run empty
 * state keeps its own labelled button — a bare plus is a weak first
 * affordance, and someone with no history needs the words once.
 *
 * **The headline is a statement, not the figure** (v4, 2026-11-23, on June's
 * call). It used to be "Good evening / 4 days / since your last attack" —
 * the three lines read as one sentence, and that's recorded rather than
 * refuted: "4 days" as the big, bold figure is what the greeting-is-kicker
 * version was built to avoid framing as a score (replacing "Attack-free for",
 * which read as a run to protect). "No attack today" makes the same claim
 * ("nothing ongoing right now" — true by construction, since this card only
 * renders when there's no ongoing attack) without putting a count in the
 * position that reads as the hero's one headline number. The figure moves to
 * the detail line, still from `formatSinceLong`, just no longer the thing in
 * 32px bold.
 *
 * Still no date in the detail. "Since Thu 20 Aug, 10:40" under the figure was
 * the same fact twice; the exact end time is on the attack in `AttackDetail`.
 */
export function AttackFreeCard({ lastEnd, topAction }: Props) {
  // Every minute, and on every return to the foreground — an interval alone
  // leaves "14 days" reading whatever it said before the app was backgrounded.
  useNowTick();

  return (
    <HomeCard
      art={<AttackFreeArt />}
      label={greeting()}
      headline="No attack today"
      // 32px/1.2 (v4 board) — the design gives this state a smaller headline
      // than the ongoing one, since a statement needs less weight than the
      // active-attack figure someone would want to read first mid-migraine.
      // No whitespace-nowrap, unlike the ongoing headline's short figure:
      // "No attack today" is long enough that nowrap ran it off the screen
      // edge at the larger text-size settings — found at XL, where the
      // phrase is wider than the 64% text column has room for on one line.
      headlineSize="text-[2rem] leading-[1.2]"
      // The caption floor (14px, never lower) overrides the board's literal
      // 13px for this line — `text-xs` here, not an arbitrary smaller value.
      // Nested span, not a HomeCard prop: its own classes win over the
      // wrapping `<p>`'s default text-base/text-primary the same way the
      // ongoing label's own classes do.
      detail={<span className="text-xs text-text-secondary">{formatSinceLong(lastEnd)} since your last attack</span>}
      topAction={topAction}
    />
  );
}
