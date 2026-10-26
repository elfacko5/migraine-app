import type { Attack } from '../types';
import { formatElapsed } from '../utils/format';
import { attackLatestSeverity, attackMaxSeverity } from '../utils/stats';
import { attackSide, SIDE_LABELS } from '../utils/laterality';
import { useNowTick } from '../hooks/useNowTick';
import { HomeCard } from './HomeCard';
import { HeroSparkline } from './HeroSparkline';
import { OngoingArt } from './heroArt';

interface Props {
  attack: Attack;
  onEnd: () => void;
  onOpenDetail: () => void;
  /** The attack mode button, pinned to the hero's corner. */
  topAction?: React.ReactNode;
}

export function OngoingAttackBanner({ attack, onEnd, onOpenDetail, topAction }: Props) {
  // Keeps the elapsed headline honest — every minute, and on every return to the
  // foreground, which is the case a bare interval silently got wrong.
  useNowTick();

  const nowSev = attackLatestSeverity(attack);
  const peakSev = attackMaxSeverity(attack);
  const start = attack.snapshots[0].time;

  const side = attackSide(attack);

  return (
    <HomeCard
      art={<OngoingArt />}
      label="Ongoing attack"
      // **Elapsed time alone** (v3, 2026-10-26). "Started 2h 14m" said
      // "started" under a label that already says the attack is ongoing; the
      // headline answers "how long" and nothing else.
      headline={formatElapsed(start)}
      // The trajectory answers the other question — is it easing? — which the
      // old detail line could only hint at with two numbers and no direction.
      figure={attack.snapshots.length > 1 ? <HeroSparkline attack={attack} /> : undefined}
      // Stated plainly rather than colour-coded: the hero sits on artwork,
      // where a severity-tinted number would read as part of the picture.
      // "now" and "peak" are both named, never a bare number, so an attack that
      // has eased from 9 to 3 doesn't announce a 9 in the present tense; peak
      // is dropped on a single reading, where it is the same figure twice.
      // Side is the ICHD-relevant summary of location (unilateral is half a
      // criterion) and is left out when nothing recorded says — `null` must
      // never render as "both".
      detail={[
        `${nowSev} now`,
        attack.snapshots.length > 1 ? `peak ${peakSev}` : null,
        side ? SIDE_LABELS[side].toLowerCase() : null,
      ].filter(Boolean).join(' · ')}
      onOpenDetail={onOpenDetail}
      topAction={topAction}
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
