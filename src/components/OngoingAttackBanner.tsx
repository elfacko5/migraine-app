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
  onAddUpdate: () => void;
  onOpenDetail: () => void;
  /** The attack mode button, pinned to the hero's corner. */
  topAction?: React.ReactNode;
}

export function OngoingAttackBanner({ attack, onEnd, onAddUpdate, onOpenDetail, topAction }: Props) {
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
      {/* **Add an update and End attack, side by side, both secondary**
          (2026-10-28) — which reverses the 2026-10-26 call that left End
          attack alone here. That call was right while the FAB was a direct
          tap to "Add update": the hero's copy of it was the same action in a
          second, louder place. Since the FAB opens a menu, adding an update
          from it costs an extra tap, so the card's own shortcut earns its
          place back — the card is the fast path, the + menu the consistent
          one (Sunny's spec, deliberately duplicated).

          Neither is promoted to `btn-primary`: the FAB is still the one solid
          accent target on Today, and an accent fill here would rebuild the
          competition the earlier change removed. Add an update leads because
          it is what an ongoing attack is usually opened for. */}
      <button type="button" onClick={onAddUpdate} className="btn-secondary btn-compact">
        Add an update
      </button>
      <button type="button" onClick={onEnd} className="btn-secondary btn-compact">
        End attack
      </button>
    </HomeCard>
  );
}
