import { formatSinceLong, greeting } from '../utils/format';
import { useNowTick } from '../hooks/useNowTick';
import { HomeCard } from './HomeCard';
import cardImage from '../assets/card-attack-free.jpg';

interface Props {
  lastEnd: string;
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
 * **No detail line, and a greeting instead.** It read "Since Thu 20 Aug,
 * 10:40" under "8 minutes" — the same fact twice, on the largest piece of
 * real estate in the app, where what a person wants is how long it has been
 * and not the timestamp it is measured from. The exact end time is still on
 * the attack itself in `AttackDetail`. The line it freed goes to a time-of-day
 * greeting, which is also where the "Hello" that `TopBar` used to carry on
 * Today ended up.
 */
export function AttackFreeCard({ lastEnd }: Props) {
  // Every minute, and on every return to the foreground — an interval alone
  // leaves "14 days" reading whatever it said before the app was backgrounded.
  useNowTick();

  return (
    <HomeCard
      image={cardImage}
      // Full square with the moon left of centre — keeping the left edge is what carries it into the visible strip.
      imageAnchor="left"
      greeting={greeting()}
      label="Attack-free for"
      headline={formatSinceLong(lastEnd)}
    />
  );
}
