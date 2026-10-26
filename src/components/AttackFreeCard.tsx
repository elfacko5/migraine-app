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
 * **The greeting is the kicker, and the three lines read as one sentence**
 * (v3, 2026-10-26): "Good evening / 4 days / since your last attack". It used
 * to be a greeting *and* a label — "Attack-free for" — and "attack-free" read
 * as a score to keep up, the thing §9.2 says a tracker must never build. The
 * phrasing now follows the Insights tile's "Days since · last attack": a plain
 * count from an event, not a run to protect.
 *
 * Still no date. "Since Thu 20 Aug, 10:40" under "8 minutes" was the
 * headline's own figure said a second way; the exact end time is on the
 * attack in `AttackDetail`.
 */
export function AttackFreeCard({ lastEnd, topAction }: Props) {
  // Every minute, and on every return to the foreground — an interval alone
  // leaves "14 days" reading whatever it said before the app was backgrounded.
  useNowTick();

  return (
    <HomeCard
      art={<AttackFreeArt />}
      label={greeting()}
      headline={formatSinceLong(lastEnd)}
      detail="since your last attack"
      topAction={topAction}
    />
  );
}
