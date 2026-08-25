import type { Attack } from '../types';
import { formatElapsed } from '../utils/format';
import { attackLatestSeverity, attackMaxSeverity } from '../utils/stats';
import { useNowTick } from '../hooks/useNowTick';
import { HomeCard } from './HomeCard';
import cardImage from '../assets/card-ongoing.jpg';

interface Props {
  attack: Attack;
  onEnd: () => void;
  onOpenDetail: () => void;
}

export function OngoingAttackBanner({ attack, onEnd, onOpenDetail }: Props) {
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
      {/* **The only action the hero carries, and the only one it should.**
          "Add update" used to sit here as the primary, which was the FAB's
          action repeated in a second, louder place — two solid-accent targets
          in one viewport on a screen where accent means "press this". Ending
          an attack is the thing the nav can't express, so it is what stays.

          It stays `btn-secondary` rather than being promoted into the vacated
          primary slot: the FAB is now the one accent target on Today, and
          giving the hero an accent fill again would rebuild the competition
          this change exists to remove. */}
      <button
        type="button"
        onClick={onEnd}
        className="btn-secondary btn-compact"
      >
        End attack
      </button>
    </HomeCard>
  );
}
