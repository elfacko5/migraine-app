import { formatSinceLong, formatDatetime } from '../utils/format';
import { useNowTick } from '../hooks/useNowTick';
import { HomeCard } from './HomeCard';
import cardImage from '../assets/card-attack-free.jpg';

interface Props {
  lastEnd: string;
  onStart: () => void;
}

/** Shown on the Today tab when no attack is ongoing — how long since the last one ended. */
export function AttackFreeCard({ lastEnd, onStart }: Props) {
  // Every minute, and on every return to the foreground — an interval alone
  // leaves "14 days" reading whatever it said before the app was backgrounded.
  useNowTick();

  return (
    <HomeCard
      image={cardImage}
      label="Attack-free for"
      headline={formatSinceLong(lastEnd)}
      detail={<>Since {formatDatetime(lastEnd)}</>}
    >
      <button
        type="button"
        onClick={onStart}
        className="btn-primary rounded-full px-5 py-2.5 text-sm font-semibold transition-colors"
      >
        Log an attack
      </button>
    </HomeCard>
  );
}
