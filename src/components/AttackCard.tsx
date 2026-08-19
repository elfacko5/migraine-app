import type { Attack } from '../types';
import { formatDate, formatTime, formatDuration } from '../utils/format';
import { attackAvgSeverity, attackMaxSeverity } from '../utils/stats';
import { attackSide, SIDE_LABELS } from '../utils/laterality';
import { SymptomIcon, SideGlyph, MedIcon } from './drawnIcons';
import { isRetired } from '../utils/retired';
import { attackFirstDoses } from '../utils/medDisplay';
import { IMPACT_SHORT } from '../utils/impact';
import { sevTextClass } from '../utils/severity';
import { SeveritySparkline } from './SeverityChart';
import { SunriseIcon } from './icons';

// What a row carries, and why — the page is scanned, so the order is the
// order the questions get asked, and anything that can't be read at a glance
// belongs in AttackDetail instead.
//
// **Symptoms are on the card and triggers are not**, which is the reverse of
// how this started. Nausea/vomiting and photophobia + phonophobia are ICHD-3
// criterion C — part of what makes an attack migraine rather than a headache
// — while the dossier's §4 is a warning about triggers specifically: many
// can't be confirmed, some are premonitory symptoms mistaken for causes, and
// surfacing them prominently invites exactly the false-pattern-hunting it
// says to avoid. Giving triggers the chips and symptoms nothing promoted the
// speculative field over the diagnostic one. Triggers are still recorded and
// still shown in AttackDetail; they're just not what a history is scanned for.
//
// **Impact earns a line of its own.** It's the disability axis — the thing
// MIDAS and HIT-6 exist to measure, and the field that most changes how a
// headache history reads — and it was being collected at the end of every
// attack and then shown nowhere but the detail sheet. Severity and impact are
// different questions: a 9 you slept off and a 6 that cost you a workday are
// not the same attack, and only one of those numbers was on this card.
//
// **Reading order.** Everything here is load-bearing, which is exactly why it
// needs a hierarchy: with five kinds of thing at one visual weight, none of
// them answers "what happened here". The order is the order the questions get
// asked about a past attack:
//
//   1. **How long, and how bad on average** — one line, the largest text on
//      the row. Duration is not just useful, it is diagnostic: ICHD-3 1.1
//      defines migraine as attacks of 4–72 hours untreated. Average severity
//      is the "how bad was it overall" figure, and it is time-weighted (see
//      `attackAvgSeverity`) so it describes the attack rather than how often
//      the diary happened to be answered. Peak sits beside it, smaller and
//      labelled — it is what ICHD's "moderate or severe intensity" speaks to,
//      so it shouldn't vanish, but it is no longer the headline.
//   2. **When** — the date and time. Not equally important, but it is the
//      differentiator: it's how you find the row you're thinking of.
//   3. **Medication.**
//   4. **Symptoms.** Nausea/vomiting and photophobia + phonophobia are ICHD-3
//      criterion C, part of what makes an attack migraine rather than a
//      headache.
//   5. **Side, readings, impact** — the quiet line.
//
// **Both severity numbers are labelled, and neither is a badge any more.** The
// badge was an unlabelled figure, which works while there is exactly one; two
// numbers need to say which is which, and once they are labelled they read
// better as text than as a pill. Colour still carries magnitude — each number
// takes the shared ramp — so the row is scannable without it.
//
// **Location is a side, not a list of zones.** ICHD-3 criterion B wants ≥2 of
// four pain features and one of them is *unilateral*, so left/right/both is
// half a criterion; a list of zones, or a count of them, is neither scannable
// nor diagnostic. See `attackSide`. The zones are still drawn per-area in
// `SeverityBreakdown` and aggregated in the Insights heatmap, which are the
// places with room to tell 17 of them apart.
const MAX_SYMPTOM_CHIPS = 3;

interface Props {
  attack: Attack;
  onClick: () => void;
  isOngoing?: boolean;
}

export function AttackCard({ attack, onClick, isOngoing }: Props) {
  const peak = attackMaxSeverity(attack);
  const avg = attackAvgSeverity(attack);
  const side = attackSide(attack);
  const start = attack.snapshots[0];

  const symptoms = [
    ...new Set(attack.snapshots.flatMap((s) => s.symptoms ?? [])),
  ].filter((x) => !isRetired(x));

  // Names only. The timing from onset lives on AttackDetail: it's a real
  // clinical fact (§5 — "taken early" is the most actionable thing about acute
  // treatment) but it's read, not glanced at, and a duration in a chip on a
  // scanned row is a question nobody asked here.
  const meds = attackFirstDoses(attack, isRetired, formatDuration);

  // The quiet last line, joined rather than concatenated so a missing part
  // never leaves a stray separator. "snapshots" is the data model's word for
  // these; in the UI they are readings.
  // **No reading count and no side in the text.** Both became pictures: the
  // sparkline on the right already shows that there was more than one reading
  // (and roughly how many), and the glyph beneath it says which side. The row
  // was carrying a lot of text, and these were the two parts that could be
  // shown instead of said without losing anything.

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition-colors hover:bg-bg-raised/70 ${
        isOngoing ? 'border-accent/40 bg-accent/10' : 'border-bg-border/60 bg-bg-raised/40'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          {/* ONGOING sits on its own line *above* the headline, not inline
              before it. Inline, it shunted everything rightward, so an ongoing
              row started at a different x from every other row and the column
              stopped being a column. */}
          {isOngoing && (
            <p className="text-xs font-medium text-accent-light uppercase tracking-wider">Ongoing</p>
          )}

          {/* 1. How long, and how bad. **No duration while ongoing** — it
              would have to tick to stay honest, and a useNowTick per row
              re-renders the whole list every minute for a figure the Today
              card already shows; the ONGOING label above says it instead. */}
          <div className="flex items-baseline gap-x-2 gap-y-0.5 flex-wrap">
            {!isOngoing && (
              <span className="text-base font-medium text-text-primary tabular-nums">
                {formatDuration(start.time, attack.end)}
              </span>
            )}
            <span className="text-xs text-text-secondary">
              avg <span className={`tabular-nums ${sevTextClass(avg)}`}>{avg}</span>
              {' · '}peak <span className={`tabular-nums ${sevTextClass(peak)}`}>{peak}</span>
            </span>
          </div>

          {/* 2. When — the differentiator. */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-text-secondary">{formatDate(start.time)}</span>
            <span className="text-xs text-text-secondary">{formatTime(start.time)}</span>
            {/* An onset pattern, and a run of these down the list is the only
                way it's ever going to be noticed. A drawn icon in
                currentColor, not the 🌅 emoji — see SunriseIcon. */}
            {attack.wokeWithMigraine && (
              <span className="inline-flex items-center text-text-secondary" title="Woke up with this migraine">
                <SunriseIcon className="h-4 w-4" />
                <span className="sr-only">Woke up with this migraine</span>
              </span>
            )}
          </div>

          {/* 3 and 4. Medication first, then symptoms — that is the order they
              rank in, and the two fills keep them apart at a glance. */}
          {(meds.length > 0 || symptoms.length > 0) && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {/* **Not accent-tinted.** These were sage while the symptom
                  chips were neutral, which was how the two were told apart
                  before either had an icon. The icons do that job now, and
                  accent means *action or selection* everywhere else in the
                  app — on a row you only read, it was claiming a meaning it
                  didn't have. Both sets are neutral; the marks differ. */}
              {meds.map((m) => (
                <span key={m.name} className="inline-flex items-center gap-1 text-xs bg-bg-border/40 text-text-secondary rounded-full px-2 py-0.5">
                  <MedIcon name={m.name} dose={m.dose} />
                  {m.name}
                </span>
              ))}
              {/* Each symptom leads with its own drawn mark, so the chips
                  scan the way the medication ones do. `currentColor`, never an
                  emoji: a full-colour glyph would make the least important
                  thing on the row the brightest. */}
              {symptoms.slice(0, MAX_SYMPTOM_CHIPS).map((s) => (
                <span key={s} className="inline-flex items-center gap-1 text-xs bg-bg-border/40 text-text-secondary rounded-full px-2 py-0.5">
                  <SymptomIcon name={s} />
                  {s}
                </span>
              ))}
              {symptoms.length > MAX_SYMPTOM_CHIPS && (
                <span className="text-xs text-text-secondary px-1 py-0.5">
                  +{symptoms.length - MAX_SYMPTOM_CHIPS}
                </span>
              )}
            </div>
          )}

          {/* 5. The quiet line. Impact renders only when answered — it is
              deliberately absent rather than 0 when skipped, and "not
              answered" must never read as "no impact". */}
          {attack.impact !== undefined && (
            <p className="text-xs text-text-secondary whitespace-nowrap">
              Impact: <span className="text-text-primary">{IMPACT_SHORT[attack.impact]}</span>
            </p>
          )}
        </div>

        {/* The shape of the attack. It plots peak severity across all areas
            once per reading — deliberately not any single area's trend, since
            `maxSeverity` takes the worst area at each reading and the worst
            area can change between them. Per-area trends are what
            SeverityBreakdown draws on the detail sheet, where 17 zones have
            the room to be told apart. */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <SeveritySparkline attack={attack} />
          {/* The side, as a picture. It carries the accessible name the text
              line used to, so nothing is lost to a screen reader — and it is
              omitted entirely when no laterality was recorded, rather than
              drawing an empty head that would read as "neither side". */}
          {side && (
            <span className="inline-flex items-center text-text-secondary" title={SIDE_LABELS[side]}>
              <SideGlyph side={side} />
              <span className="sr-only">{SIDE_LABELS[side]}</span>
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
