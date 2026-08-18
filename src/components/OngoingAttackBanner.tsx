import type { Attack } from '../types';
import { formatElapsed } from '../utils/format';
import { attackMaxSeverity } from '../utils/stats';
import { useNowTick } from '../hooks/useNowTick';
import { HomeCard } from './HomeCard';
import cardImage from '../assets/card-ongoing.jpg';

interface Props {
  attack: Attack;
  onAddUpdate: () => void;
  onEnd: () => void;
  onOpenDetail: () => void;
}

export function OngoingAttackBanner({ attack, onAddUpdate, onEnd, onOpenDetail }: Props) {
  // Keeps "Started 3m" honest — every minute, and on every return to the
  // foreground, which is the case a bare interval silently got wrong.
  useNowTick();

  const maxSev = attackMaxSeverity(attack);
  const start = attack.snapshots[0].time;

  return (
    <HomeCard
      image={cardImage}
      // Pre-trimmed tight to the swirl, so its right edge is the one to keep.
      imageAnchor="right"
      label="Ongoing attack"
      headline={`Started ${formatElapsed(start)}`}
      // The worst area's severity, stated plainly rather than colour-coded.
      // The card sits on artwork, where a severity-tinted number would read as
      // part of the picture; the detail line is the same shape as the
      // attack-free card's, which keeps the two interchangeable at a glance.
      detail={<>Pain severity: {maxSev}</>}
      onOpenDetail={onOpenDetail}
    >
      <button
        type="button"
        onClick={onAddUpdate}
        className="btn-primary rounded-xl px-5 py-2.5 text-sm font-medium transition-colors"
      >
        Add update
      </button>
      <button
        type="button"
        onClick={onEnd}
        className="btn-secondary rounded-xl px-5 py-2.5 text-sm font-medium transition-colors"
      >
        End attack
      </button>
    </HomeCard>
  );
}
