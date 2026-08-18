import type { Attack } from '../types';
import { formatDate, formatTime, formatDuration } from '../utils/format';
import { attackMaxSeverity } from '../utils/stats';
import { isRetired } from '../utils/retired';
import { medIcon, attackFirstDoses } from '../utils/medDisplay';
import { IMPACT_SHORT } from '../utils/impact';
import { sevBadgeClass } from '../utils/severity';
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
// **Reading order, and what carries the weight.** Everything on the card is
// load-bearing, which is exactly why it needs a hierarchy: with five kinds of
// thing at one visual weight, none of them is the answer to "what happened
// here". So, in order of prominence:
//
//   1. the date, and the pain areas — who/where, both at `text-sm` in
//      `text-primary`. Areas were the *quietest* thing on the card despite
//      being its clinical subject; they now match the date, which makes the
//      pair the first thing read.
//   2. the peak severity badge, and its trend line beneath.
//   3. duration, readings, impact — `text-xs`, secondary. Facts you want
//      once the row has your attention.
//   4. the chips. They're still chips, but toned down: at full strength they
//      outweighed the pain areas, because a filled pill beats plain text
//      whatever the type size.
//
// The badge digit is `font-medium`, not `font-bold`. The house rule reserves
// bold for headline numbers — the Insights stat tiles, where a 28px figure
// *is* the content — and a 17px badge in a list row isn't that. At bold it
// was the heaviest mark on the page, out of all proportion to a row you're
// skimming past.
const MAX_SYMPTOM_CHIPS = 3;

interface Props {
  attack: Attack;
  onClick: () => void;
  isOngoing?: boolean;
}

export function AttackCard({ attack, onClick, isOngoing }: Props) {
  const maxSev = attackMaxSeverity(attack);
  const start = attack.snapshots[0];

  const peakAreas = Object.keys(
    attack.snapshots.reduce<Record<string, number>>((acc, s) => {
      for (const [k, v] of Object.entries(s.areas)) {
        if ((acc[k] ?? 0) < v) acc[k] = v;
      }
      return acc;
    }, {})
  );

  const symptoms = [
    ...new Set(attack.snapshots.flatMap((s) => s.symptoms ?? [])),
  ].filter((x) => !isRetired(x));

  // Names only. The timing from onset lives on AttackDetail: it's a real
  // clinical fact (§5 — "taken early" is the most actionable thing about acute
  // treatment) but it's read, not glanced at, and a duration in a chip on a
  // scanned row is a question nobody asked here.
  const meds = attackFirstDoses(attack, isRetired, formatDuration);

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
          {/* ONGOING sits on its own line *above* the date, not inline before
              it. Inline, it shunted the date and time rightward, so an ongoing
              row's header started at a different x from every other row's and
              the column of dates stopped being a column. Stacked, it's an
              annotation on a layout that never moves. */}
          {isOngoing && (
            <p className="text-xs font-medium text-accent-light uppercase tracking-wider">Ongoing</p>
          )}

          {/* When */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-text-primary">{formatDate(start.time)}</span>
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

          {/* Where. Promoted to the date's size and colour: it's the clinical
              subject of the row, and at text-xs/secondary it was losing to
              every chip underneath it. */}
          {peakAreas.length > 0 && (
            <p className="text-sm text-text-primary truncate">{peakAreas.join(', ')}</p>
          )}

          {/* How long, and how much of it was actually observed.
              **No "In progress" for an ongoing attack** — the ONGOING label
              above already says exactly that, and saying it twice on one card
              in two different registers made the row look like it carried two
              facts where it had one. A duration isn't shown in its place
              either: it would have to tick to stay honest, and a `useNowTick`
              per row is a re-render of the whole list every minute for a
              figure the Today card already shows. The parts are joined rather
              than concatenated so an ongoing attack with one reading renders
              nothing instead of a stray separator.
              "snapshots" is the data model's word for these; in the UI they're
              readings. */}
          {(() => {
            const parts = [
              isOngoing ? null : formatDuration(start.time, attack.end),
              attack.snapshots.length > 1 ? `${attack.snapshots.length} readings` : null,
            ].filter(Boolean);
            return parts.length > 0 ? (
              <p className="text-xs text-text-secondary">{parts.join(' · ')}</p>
            ) : null;
          })()}

          {/* Disability. Only when answered — `impact` is deliberately absent
              rather than 0 when the question was skipped, and "not answered"
              must never render as "no impact". */}
          {attack.impact !== undefined && (
            <p className="text-xs text-text-secondary">
              Impact: <span className="text-text-primary">{IMPACT_SHORT[attack.impact]}</span>
            </p>
          )}

          {/* Both chip sets are a step quieter than they were — /40 and /10
              fills instead of /60 and /20. The fills still separate symptom
              from medication at a glance, which is the job; they just no
              longer outrank the pain areas above them. */}
          {(symptoms.length > 0 || meds.length > 0) && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {symptoms.slice(0, MAX_SYMPTOM_CHIPS).map((s) => (
                <span key={s} className="text-xs bg-bg-border/40 text-text-secondary rounded-full px-2 py-0.5">{s}</span>
              ))}
              {symptoms.length > MAX_SYMPTOM_CHIPS && (
                <span className="text-xs text-text-secondary px-1 py-0.5">
                  +{symptoms.length - MAX_SYMPTOM_CHIPS}
                </span>
              )}
              {meds.map((m) => (
                <span key={m.name} className="text-xs bg-accent/10 text-accent-light rounded-full px-2 py-0.5">
                  {/* medIcon, not a hardcoded 💊 — the same drug has to carry
                      the same glyph here, on the timeline and in the library. */}
                  <span aria-hidden="true">{medIcon(m.name, m.dose)}</span> {m.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Badge and line are one idea, so they sit tight together: the line
            plots the *same* figure the badge shows — peak severity across all
            areas — once per reading. It is deliberately not any single area's
            trend. `maxSeverity` takes the worst area at each reading, and the
            worst area can change between readings, so a per-area reading of
            this line would be wrong; per-area trends are what
            SeverityBreakdown draws on the detail sheet, where 17 zones have
            the room to be told apart. Peak-now over peak-over-time is one
            claim the card can actually support. */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`rounded-lg border px-2 py-1 text-lg font-medium tabular-nums ${sevBadgeClass(maxSev)}`}>
            {maxSev}
          </span>
          <SeveritySparkline attack={attack} />
        </div>
      </div>
    </button>
  );
}
