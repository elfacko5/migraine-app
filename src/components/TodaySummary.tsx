import type { Attack, Medication } from '../types';
import { useNowTick } from '../hooks/useNowTick';
import { migraineDaysByMonth, medicationDaysByMonth } from '../utils/stats';
import { formatTime } from '../utils/format';
import { MedIcon } from './drawnIcons';
import {
  checkDose, doseUnits, findMedication, lastDoseSnapshot, mohDaysFor, unitsInWindow, unitsLabel,
} from '../utils/medGuardrails';

// What belongs under the hero card on Today: figures that need no
// interpretation, and one warning that has to arrive before it's too late to
// act on. Anything that needs reading rather than glancing stays on Insights.
interface Props {
  attacks: Attack[];
  ongoing: Attack | null;
  /** The library — for each drug's overuse reference point and its own
   *  per-intake / per-day / minimum-gap limits. */
  medications?: Medication[];
  /** Attack mode strips this down to what's actionable — see below. */
  attackMode?: boolean;
}

// Warn at 70% of whichever overuse reference point applies to *that* drug, not
// at it. The number is only useful while there's still room to change course;
// at 10 of 10 it's a fact about the past.
//
// The threshold is now per medication rather than a module constant: it used
// to be 70% of 10 for everything, because nothing knew a drug's class, so a
// simple analgesic was warned about five days early.
const warnAt = (threshold: number) => Math.ceil(threshold * 0.7);

// **The two medication rows are one shape.** They carry the same kind of
// content — a drug, a figure about it, and a line of supporting detail — and
// were drawn two different ways: one had the form icon and an emphasised name,
// the other had neither, so two adjacent cards saying comparable things looked
// like unrelated components. The only difference that means anything is that
// one of them is a warning, so that is the only difference left: an amber ring
// and tint. Everything else — the icon column, the name's weight, the figure
// on the headline, the detail underneath — is shared.
//
// **The headline is `text-base`, not `text-sm`** (2026-09-24, Sunny's call —
// line 1 and line 2 read as the same weight of information when they carry
// different ones: what was taken, versus the supporting facts about it).
// `detail` is `React.ReactNode` rather than a bare string for the same
// reason: the last-dose row now has two things to say below the headline —
// the 24h position and when it was taken, then optionally the next-dose
// gap — and forcing both into one joined string was what pushed everything
// onto line 1 in the first place.
//
// **The resting state now carries the same border as the two tiles below it**
// (2026-09-23, Sunny's call) — `bg-bg-raised/60 border border-bg-border/60`,
// not the flat borderless `bg-bg-surface` it shipped with. Before the tiles
// picked up their own border (see the note on them below), the row and the
// tiles matched by accident; once they diverged, this row was the one thing
// on the page that still looked like the old flat style. It also does what
// the comment above already claimed and the code didn't: warning and
// resting differed by more than colour — only the warning state had a
// border at all — so a border was the one structural difference hiding
// behind "everything else is shared".
function MedRow({ name, icon, figure, detail, warning = false }: {
  name: string;
  icon: React.ReactNode;
  figure: string;
  detail?: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border px-4 py-3 ${
        warning ? 'border-severity-mid/40 bg-severity-mid/10' : 'border-bg-border/60 bg-bg-raised/60'
      }`}
    >
      <span className="mt-0.5 shrink-0 text-text-secondary">{icon}</span>
      <div className="min-w-0">
        <p className="text-base text-text-primary">
          <span className="font-medium">{name}</span> {figure}
        </p>
        {detail && <div className="mt-0.5 space-y-0.5 text-xs text-text-secondary">{detail}</div>}
      </div>
    </div>
  );
}

// In attack mode the page keeps only what changes what you do in the next
// hour, which the dossier's "fewer elements per screen" asks for and which
// nothing else in the app has yet acted on (§8.3, and CLAUDE.md has recorded
// it as the spec's one unimplemented half). Concretely:
//
//   - **The two month tiles go.** Migraine days and medication days this
//     month are figures you read and think about; mid-attack there is nothing
//     to do with either, and they're the largest, brightest text on the page.
//     They are still on Insights, and attack mode is one tap to leave.
//   - **The overuse warning stays, minus its explanation.** It's the one
//     figure here that bears on a decision being made right now — whether to
//     take another dose — so removing it would be removing the one thing
//     worth the screen. Its second paragraph, three lines about ICHD
//     thresholds sustained over three months, is exactly the reading this
//     mode exists to avoid; the count and the drug name carry the point.
//   - **The last dose stays as-is.** One line, and it's the question people
//     actually open the app mid-attack to answer.
export function TodaySummary({ attacks, ongoing, medications = [], attackMode = false }: Props) {
  const months = migraineDaysByMonth(attacks, 1);
  const migraineDays = months[months.length - 1]?.days ?? 0;

  const meds = medicationDaysByMonth(attacks);
  const totalMedDays = meds.reduce((n, m) => Math.max(n, m.thisMonth), 0);
  const nearing = meds
    .map((m) => ({ ...m, threshold: mohDaysFor(m.name, medications) }))
    .filter((m) => m.thisMonth >= warnAt(m.threshold));

  // Mid-attack, the question is "when did I last take something" — the one
  // thing here that changes what you do in the next hour. It now carries the
  // running 24-hour total beside it, which is the same question asked one step
  // further on: not just when, but how much is already in.
  const lastDose = ongoing ? lastDoseSnapshot(ongoing) : null;
  const lastName = lastDose?.medication?.name ?? '';
  const lastLibrary = findMedication(medications, lastName);
  // The 24-hour figure is a rolling window, so it goes stale on its own as
  // doses age out of it — the same reason every live duration in the app ticks
  // rather than trusting the last render. Cheap here: Today already re-renders
  // on this cadence for the hero card's elapsed time. Both helpers read the
  // clock themselves, which is also what keeps `Date.now()` out of this render.
  useNowTick(60_000);
  const takenIn24h = lastDose ? unitsInWindow(attacks, lastName) : 0;
  // Asked with zero further units, so this reports where the *last* dose left
  // things rather than pre-judging a dose nobody has said they're taking.
  const position = lastDose ? checkDose(lastLibrary, attacks, lastName, 0) : null;

  if (migraineDays === 0 && meds.length === 0 && !lastDose) return null;
  // Attack mode drops everything but these two, so with neither of them there
  // is nothing left to draw — and an empty wrapper would still cost the gap
  // above it.
  if (attackMode && nearing.length === 0 && !lastDose) return null;

  return (
    <div className="space-y-3">
      {nearing.map((m) => (
        <MedRow
          key={m.name}
          name={m.name}
          icon={<MedIcon name={m.name} className="h-4 w-4" />}
          figure={`on ${m.thisMonth} days this month`}
          warning
          /* States the number and the guideline, and stops. Deciding what it
             means is a conversation with a doctor — and when the user entered
             a limit of their own, that is the number quoted back, not a
             guideline they didn't ask about.

             **Plainer than the Insights caption, deliberately.** Today is
             read at a glance and mid-attack, so it says what frequent use can
             do in everyday words; Insights keeps the clinical term
             "medication-overuse headache", which is what a doctor will call
             it and that page is the one you read carefully. §9.5 — the deeper
             into an attack, the simpler the copy. */
          detail={!attackMode
            ? `${findMedication(medications, m.name)?.maxDaysPerMonth
                ? `You entered a limit of ${m.threshold} days a month for this one.`
                : `Taking acute medication often can itself lead to more headaches — guidelines put that at around ${m.threshold} days a month for this type, sustained over three months.`
              } Worth raising at your next appointment.`
            : null}
        />
      ))}

      {lastDose?.medication && (
        <MedRow
          name={lastDose.medication.name}
          icon={<MedIcon name={lastDose.medication.name} dose={lastDose.medication.dose} className="h-4 w-4" />}
          // **Line 1 is just the dose's own amount now** (2026-09-24, Sunny's
          // call) — "Sumatriptan 2 tablets", matching how a chip in the
          // wizard's own medication step reads. Everything else it used to
          // carry on one line — the 24h position and the clock time — moved
          // to `detail`, which is why that prop had to stop being a single
          // string. `unitsLabel` is the same helper the wizard's quantity
          // picker uses, so "tablet"/"spray"/... always matches the
          // medication's own `unitLabel`.
          figure={unitsLabel(doseUnits(lastDose.medication), lastLibrary)}
          detail={
            <>
              {/* "Treo at 20:51" reads as a label with a timestamp — it could
                  as easily mean a reminder due then, or when it was logged.
                  The verb is what makes it a statement about a dose that was
                  taken. */}
              <p>
                {[
                  lastLibrary?.maxPerDay ? `${takenIn24h} of ${lastLibrary.maxPerDay} in the last 24h` : null,
                  `${takenIn24h > doseUnits(lastDose.medication) ? 'last taken' : 'taken'} at ${formatTime(lastDose.time)}`,
                ].filter(Boolean).join(' · ')}
              </p>
              {/* Only when a minimum gap was entered and it hasn't elapsed. A
                  statement of the user's own number, never an instruction. */}
              {position?.tooSoon && position.nextAllowedAt && (
                <p>Next dose from {formatTime(position.nextAllowedAt)}, by the gap you entered.</p>
              )}
            </>
          }
        />
      )}

      {!attackMode && (
      <div className="grid grid-cols-2 gap-3">
        {/* **Both tiles are label = the subject, value = the unit and the
            period.** The left one used to label the *period* ("This month")
            and put the subject in the value ("9 migraine days"), so two tiles
            side by side were built the opposite way round from each other and
            neither could be read against the other. Now it's Migraine days ·
            8 · this month, Medication days · 0 · this month.

            **The label carries "days", not the unit line** (2026-09-23,
            Sunny's call) — matching the stat tiles just above it on Insights
            ("Days in a row" / 0 / "with a migraine", "Days since" / 27 /
            "last attack"), which lead with the countable unit and leave the
            sub-line for context. It used to be the other way round — bare
            "Migraine"/"Medication" as the label, "days this month" as the
            unit — on the reasoning that "days" shouldn't appear twice; moving
            it to the label keeps that (it still only appears once) and gets
            the term the app actually uses, "migraine days" (see
            MigraineDaysChart in CLAUDE.md), onto one line instead of split
            across two. No more singular/plural on the unit line either — like
            "Days in a row", the label doesn't bend to the count.

            **Now the same shape as Insights' `StatCard`** — border, value on
            its own line with the unit stacked beneath (2026-09-23, Sunny's
            call). The figure was already `text-2xl` (28px) in both places,
            identical to Insights' tiles — but on Today the number shared a
            baseline row with its unit and sat in a borderless `bg-bg-surface`
            card, which cost it definition it didn't need to lose. That reads
            fine on Insights, packed between charts and captions with plenty
            else to set the scale against; on Today, alone under the hero
            with a page's worth of empty space around it, the same tile read
            as small.

            **The unit line and the tile's own height needed a second pass,
            found on device** (2026-09-23): "days this month" is
            `text-[0.75rem]` — 12px, under this app's own 14px caption floor.
            The label above it (MIGRAINE/MEDICATION) is the one documented
            exception to that floor, because it's a name for a 28px figure
            that carries the tile on its own — the unit line is body text
            someone actually has to read, so it doesn't get the same pass and
            goes to `text-xs` (14px, the floor). The tile also went from
            `p-4` to `px-4 py-5` with a bit more space between its three
            lines, for the "more air" Sunny asked for alongside it. */}
        <div className="rounded-xl bg-bg-raised/60 border border-bg-border/60 px-4 py-5">
          <p className="text-[0.75rem] uppercase tracking-wider font-medium text-text-secondary">Migraine days</p>
          <p className="mt-1.5 text-2xl font-bold text-text-primary leading-none">{migraineDays}</p>
          <p className="mt-1 text-xs text-text-secondary">this month</p>
        </div>
        <div className="rounded-xl bg-bg-raised/60 border border-bg-border/60 px-4 py-5">
          <p className="text-[0.75rem] uppercase tracking-wider font-medium text-text-secondary">Medication days</p>
          <p className="mt-1.5 text-2xl font-bold text-text-primary leading-none">{totalMedDays}</p>
          <p className="mt-1 text-xs text-text-secondary">this month</p>
        </div>
      </div>
      )}
    </div>
  );
}
