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
      // Dot + uppercase eyebrow (v4, 2026-11-23) — the stat tiles' own
      // "DAYS IN A ROW" treatment, reused here, since the active-attack state
      // reads as more urgent than a plain greeting and the design marks it
      // that way: accent, not muted, and a small static dot (no pulse —
      // attack mode cuts all animation, and this has to render the same
      // whichever theme is on). `text-xs`, not the board's literal 13px: the
      // caption floor never goes below 14px. These classes win over
      // HomeCard's own default label styling by specificity.
      label={
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent-light">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
          Attack ongoing
        </span>
      }
      // **Elapsed time alone** (v3, 2026-10-26). "Started 2h 14m" said
      // "started" under a label that already says the attack is ongoing; the
      // headline answers "how long" and nothing else.
      headline={formatElapsed(start)}
      // 40px/1.1 (v4 board) — larger than the attack-free state's 32px: the
      // design gives the active-attack figure more weight than a statement,
      // and it is the number someone mid-attack would read first.
      // whitespace-nowrap kept here, unlike the attack-free headline: this
      // one is always a short elapsed-time figure ("2h 15m"), which running
      // over the artwork costs nothing — the reason nowrap existed in the
      // first place.
      headlineSize="text-[2.5rem] leading-[1.1] whitespace-nowrap"
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
      {/* **Add an update and End attack, side by side** (2026-10-28) — which
          reverses the 2026-10-26 call that left End attack alone here. That
          call was right while the FAB was a direct tap to "Add update": the
          hero's copy of it was the same action in a second, louder place.
          Since the FAB opens a menu, adding an update from it costs an extra
          tap, so the card's own shortcut earns its place back — the card is
          the fast path, the + menu the consistent one (Sunny's spec,
          deliberately duplicated).

          **Add an update promoted to `btn-primary`** (v4 hero pass,
          2026-11-24) — confirmed against `docs/redesign-v4/screens/01-today`
          (`TodayOngoingDark.html`'s `.btn.pri`/`.btn.sec`). This reverses the
          2026-10-28 reasoning that kept both secondary so the FAB stayed the
          one accent target on Today; the board makes the hero's own shortcut
          the accent one instead; see `docs/decisions.md`. */}
      <button type="button" onClick={onAddUpdate} className="btn-primary btn-compact">
        Add an update
      </button>
      <button type="button" onClick={onEnd} className="btn-secondary btn-compact">
        End attack
      </button>
    </HomeCard>
  );
}
