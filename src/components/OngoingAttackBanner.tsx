import type { Attack } from '../types';
import { formatElapsed } from '../utils/format';
import { attackLatestSeverity, attackMaxSeverity } from '../utils/stats';
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

  // **Now and peak, not one number labelled ambiguously.** This line read
  // "Pain severity: 9" off `attackMaxSeverity`, which is the worst the attack
  // has *been* — so an attack that had eased from 9 to 3 still announced a 9
  // in the present tense, which is the one thing a live card must not do.
  //
  // Not the time-weighted average the Logs row carries, either: that figure
  // summarises a finished episode, and mid-attack it is a partial number that
  // keeps moving as the attack sits. Live, the useful pair is where it is now
  // and how bad it got.
  const nowSev = attackLatestSeverity(attack);
  const peakSev = attackMaxSeverity(attack);
  const start = attack.snapshots[0].time;

  return (
    <HomeCard
      image={cardImage}
      // Pre-trimmed tight to the swirl, so its right edge is the one to keep.
      imageAnchor="right"
      label="Ongoing attack"
      headline={`Started ${formatElapsed(start)}`}
      // Stated plainly rather than colour-coded: the card sits on artwork,
      // where a severity-tinted number would read as part of the picture, and
      // the detail line keeps the same shape as the attack-free card's.
      // Peak is dropped when it equals now — on a single-reading attack the
      // two are the same number said twice.
      // **The line always says where the attack sits, never just a number.**
      // Collapsing to a bare "Severity 9" when now and peak agree looked
      // identical to the old copy, so a card that had in fact changed read as
      // one that hadn't — twice. "At its peak" is also the more useful
      // sentence: it is as bad as it has been, which a repeated "9 · peak 9"
      // states without saying.
      //
      // One reading is the exception: there is nothing to have peaked
      // *against* yet, so the number stands alone.
      detail={
        nowSev !== peakSev
          ? <>Severity now {nowSev} · peak {peakSev}</>
          : attack.snapshots.length > 1
            ? <>Severity {nowSev} · at its peak</>
            : <>Severity {nowSev}</>
      }
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
