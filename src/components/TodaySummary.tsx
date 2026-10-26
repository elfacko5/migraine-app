import type { Attack, Medication } from '../types';
import { useNowTick } from '../hooks/useNowTick';
import {
  attacksInWindow, classDaysInWindow, medicationDaysLastWindow, migraineDaysInWindow, MOH_DAYS_MIXED,
} from '../utils/stats';
import { formatTime } from '../utils/format';
import { classLetter, COUNTED_CLASSES, type CountedClass } from '../utils/medClasses';
import { TODAY_CARD } from '../utils/todayCard';
import { MedIcon } from './drawnIcons';
import { ClassBadge } from './ClassBadge';
import { WarningIcon } from './icons';
import {
  checkDose, doseUnits, findMedication, lastDoseSnapshot, mohDaysFor, unitsInWindow, unitsLabel,
} from '../utils/medGuardrails';

// What belongs under the hero on Today: figures that need no interpretation,
// and one warning that has to arrive before it's too late to act on. Anything
// that needs reading rather than glancing stays on Insights.
//
// **Every figure here is "last 30 days"** (v3, 2026-10-26). They were "this
// month", which read 1 on the 1st after a bad 31st and reset to zero for no
// reason anyone could see. A rolling window says the same thing every day.
interface Props {
  attacks: Attack[];
  ongoing: Attack | null;
  /** The library — for each drug's class, its overuse reference point, and
   *  its own per-intake / per-day / minimum-gap limits. */
  medications?: Medication[];
  /** Attack mode strips this down to what's actionable — see below. */
  attackMode?: boolean;
  /** The tiles and the medication card open Insights. */
  onOpenInsights?: () => void;
  /** "Set type" on an untyped medication opens My medications. */
  onOpenMedications?: () => void;
}

// Warn at 70% of whichever overuse reference point applies, not at it. The
// number is only useful while there's still room to change course; at 10 of
// 10 it's a fact about the past.
const warnAt = (threshold: number) => Math.ceil(threshold * 0.7);

const CLASS_NOUN: Record<CountedClass, string> = {
  triptan: 'triptan',
  combination: 'combination painkiller',
  simple: 'simple painkiller',
};

// The plain sentence that follows a guideline count. §9.5: Today is read at a
// glance and mid-attack, so it says what frequent use can do in everyday
// words; Insights keeps the clinical term, "medication-overuse headache".
// States the number and the guideline, and stops — never dosing advice.
const GUIDELINE_NOTE = 'Frequent use can sometimes lead to more headaches. Maybe worth a chat with your doctor.';

/** One overuse warning: a bold count, then the sentence that explains it. */
interface Warning {
  key: string;
  count: string;
  note: string;
  /** The drug it belongs to, when the ongoing dose card can carry it instead. */
  drug?: string;
  cls?: CountedClass;
}

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
      className={`rounded-xl border px-4 py-3 ${
        warning ? 'border-severity-mid/40 bg-severity-mid/10' : 'border-bg-border/60 bg-bg-raised/60'
      }`}
    >
      {/* `items-center` on the headline row alone, not on the whole card —
          centering against the full multi-line block (name + detail) is what
          sat the icon high; centering against just this line is what matches
          it to the text beside it, the same fix `MedicationInsights` already
          made. `figure` de-emphasised to `text-xs`/secondary/normal-weight so
          it reads as a modifier on the name, not a second headline — matching
          the "· N doses" caveat on the Insights row.

          `detail` is flush with the icon's own left edge, not indented under
          the name — it's supporting text about the row, not a continuation
          of what the name says, so there's nothing for it to nest under. */}
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-text-secondary">{icon}</span>
        <p className="min-w-0 text-base text-text-primary">
          <span className="font-medium">{name}</span>{' '}
          <span className="text-xs font-normal text-text-secondary">{figure}</span>
        </p>
      </div>
      {detail && <div className="mt-0.5 space-y-0.5 text-xs text-text-secondary">{detail}</div>}
    </div>
  );
}

// In attack mode the page keeps only what changes what you do in the next
// hour, which the dossier's "fewer elements per screen" asks for and which
// nothing else in the app has yet acted on (§8.3, and CLAUDE.md has recorded
// it as the spec's one unimplemented half). Concretely:
//
//   - **The tiles and the medication card go.** Migraine days and medication
//     days are figures you read and think about; mid-attack there is nothing
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
export function TodaySummary({
  attacks, ongoing, medications = [], attackMode = false, onOpenInsights, onOpenMedications,
}: Props) {
  // The 24-hour figure and the rolling 30 days both go stale on their own as
  // doses age out — the same reason every live duration in the app ticks. All
  // of the helpers below read the clock themselves, which keeps `Date.now()`
  // out of this render.
  useNowTick(60_000);

  const perDrug = medicationDaysLastWindow(attacks);
  const classOf = (name: string) => findMedication(medications, name)?.class;

  // Mid-attack, the question is "when did I last take something" — the one
  // thing here that changes what you do in the next hour — with the running
  // 24-hour total beside it: not just when, but how much is already in.
  const lastDose = ongoing ? lastDoseSnapshot(ongoing) : null;
  const lastName = lastDose?.medication?.name ?? '';
  const lastLibrary = findMedication(medications, lastName);
  const takenIn24h = lastDose ? unitsInWindow(attacks, lastName) : 0;
  // Asked with zero further units, so this reports where the *last* dose left
  // things rather than pre-judging a dose nobody has said they're taking.
  const position = lastDose ? checkDose(lastLibrary, attacks, lastName, 0) : null;

  if (attackMode) {
    // Per drug, against each drug's own reference point — the attack-mode
    // branch is unchanged apart from the window (its redesign is separate).
    const nearing = perDrug
      .map((m) => ({ ...m, threshold: mohDaysFor(m.name, medications) }))
      .filter((m) => m.threshold !== null && m.days >= warnAt(m.threshold));
    if (nearing.length === 0 && !lastDose) return null;
    return (
      <div className="space-y-3">
        {nearing.map((m) => (
          <MedRow
            key={m.name}
            name={m.name}
            icon={<MedIcon name={m.name} className="h-4 w-4" />}
            figure={`on ${m.days} days in the last 30 days`}
            warning
          />
        ))}
        {lastDose?.medication && (
          <MedRow
            name={lastDose.medication.name}
            icon={<MedIcon name={lastDose.medication.name} dose={lastDose.medication.dose} className="h-4 w-4" />}
            figure={unitsLabel(doseUnits(lastDose.medication), lastLibrary)}
            detail={lastDoseDetail(false)}
          />
        )}
      </div>
    );
  }

  // ── The class bars ─────────────────────────────────────────────────────
  const cd = classDaysInWindow(attacks, classOf);
  // A row per class the user actually has: an acute medication of that class
  // in the library, or a dose of one in the window. A class nobody takes is
  // an empty bar that says nothing.
  const rows = COUNTED_CLASSES.filter((c) =>
    cd[c.value] > 0 || medications.some((m) => m.kind === 'acute' && m.class === c.value));
  // The mixed-use line only when two or more classes were taken: with one, it
  // would repeat that class's own row.
  const showMixed = COUNTED_CLASSES.filter((c) => cd[c.value] > 0).length >= 2;

  // ── Warnings ───────────────────────────────────────────────────────────
  // **From the class bars, naming the class**, since the bars are what the
  // threshold is about. A drug's own entered limit is the exception: it is
  // the user's number, about that drug, so its warning names the drug and
  // quotes the limit back rather than a guideline. An untyped drug is in no
  // bar, so it keeps a per-drug warning against the default reference point.
  const warnings: Warning[] = [];
  for (const c of rows) {
    const days = cd[c.value];
    if (days >= warnAt(c.limit)) {
      warnings.push({ key: c.value, cls: c.value, count: `${days} of ${c.limit} ${CLASS_NOUN[c.value]} days in the last 30 days.`, note: GUIDELINE_NOTE });
    }
  }
  if (showMixed && cd.any >= warnAt(MOH_DAYS_MIXED)) {
    warnings.push({ key: 'mixed', count: `${cd.any} of ${MOH_DAYS_MIXED} acute medication days in the last 30 days.`, note: GUIDELINE_NOTE });
  }
  for (const m of perDrug) {
    const lib = findMedication(medications, m.name);
    const own = lib?.maxDaysPerMonth && lib.maxDaysPerMonth > 0 ? lib.maxDaysPerMonth : null;
    // A gepant has a type but no overuse guideline, so it counts as typed
    // here and draws no default warning.
    const typed = lib?.class === 'triptan' || lib?.class === 'combination' || lib?.class === 'simple' || lib?.class === 'gepant';
    if (own !== null) {
      if (m.days >= warnAt(own)) {
        warnings.push({
          key: `drug:${m.name}`, drug: m.name,
          count: `${m.name} on ${m.days} days in the last 30 days.`,
          note: `You entered a limit of ${own} days a month for this one. Worth raising at your next appointment.`,
        });
      }
    } else if (!typed) {
      const threshold = mohDaysFor(m.name, medications);
      if (threshold !== null && m.days >= warnAt(threshold)) {
        warnings.push({ key: `drug:${m.name}`, drug: m.name, count: `${m.name} on ${m.days} days in the last 30 days.`, note: GUIDELINE_NOTE });
      }
    }
  }

  // The warning that belongs to the drug being taken now rides inside its
  // card, under a divider, rather than repeating above it: the drug's own
  // limit first, else its class's.
  const lastClass = lastLibrary?.class;
  const lastWarning = lastDose
    ? warnings.find((w) => w.drug && w.drug.toLowerCase() === lastName.trim().toLowerCase())
      ?? warnings.find((w) => w.cls && w.cls === lastClass)
    : undefined;
  const banners = warnings.filter((w) => w !== lastWarning);

  const migraineDays = migraineDaysInWindow(attacks);
  const attackCount = attacksInWindow(attacks);
  const lastLetter = classLetter(lastClass);

  return (
    <div className="space-y-3.5">
      {lastDose?.medication && (
        // The ongoing dose card. Same data as the old last-dose row: what was
        // taken, when, the 24-hour position against the user's own limit and,
        // when a minimum gap was entered, when that gap ends — a statement of
        // the user's own number, never an instruction.
        <div className={TODAY_CARD}>
          <div className="flex items-center gap-3">
            <ClassBadge large>
              {lastLetter ?? <MedIcon name={lastDose.medication.name} dose={lastDose.medication.dose} className="h-4 w-4" />}
            </ClassBadge>
            <div className="min-w-0">
              <p className="text-base font-semibold text-text-primary">{lastDose.medication.name}</p>
              <div className="text-xs text-text-secondary">{lastDoseDetail(true)}</div>
            </div>
          </div>
          {lastWarning && (
            <p className="mt-3 flex items-start gap-2 border-t border-bg-border pt-3 text-[0.9375rem] font-semibold text-text-primary">
              <WarningIcon className="mt-0.5 h-5 w-5 shrink-0 text-severity-mid" />
              {lastWarning.count}
            </p>
          )}
        </div>
      )}

      {banners.map((w) => (
        <div key={w.key} className="flex items-start gap-2.5 rounded-[0.875rem] bg-severity-mid/15 p-3 text-[0.9375rem] text-text-primary">
          <WarningIcon className="h-6 w-6 shrink-0 text-severity-mid [&>path]:[stroke-width:2]" />
          <p><span className="font-semibold">{w.count}</span> {w.note}</p>
        </div>
      ))}

      {/* **Two number tiles: migraine days, and attacks.** The v3 prototype
          pairs migraine days with headache days, but the app has no
          headache-day record and nothing to count, so the second slot is the
          other figure Today can state plainly (Sunny, 2026-10-26). "Attack"
          is the episode and "migraine day" the calendar day — one attack can
          be two of them, which is why both are worth showing side by side.
          The label is a single 14px line under the figure, with the unit and
          the window together; no uppercase kicker. Both open Insights. */}
      <div className="grid grid-cols-2 gap-3.5">
        <NumberTile value={migraineDays} label="migraine days · last 30 days" onClick={onOpenInsights} />
        <NumberTile value={attackCount} label={`${attackCount === 1 ? 'attack' : 'attacks'} · last 30 days`} onClick={onOpenInsights} />
      </div>

      {rows.length > 0 && (
        // **Days per class, not per drug** — the threshold is about how often a
        // class is taken, so two triptans on one day are one triptan day. The
        // card replaced the single "Medication days · this month" tile, which
        // summed every drug into one number with no threshold to read it by.
        <div className={`${TODAY_CARD} space-y-2.5`}>
          <button type="button" onClick={onOpenInsights} className="block w-full space-y-2.5 text-left">
            <p className="text-xs text-text-secondary">Last 30 days</p>
            {rows.map((c) => (
              <ClassBar key={c.value} letter={c.letter} label={`${c.label} days`} days={cd[c.value]} limit={c.limit} />
            ))}
            {showMixed && <ClassBar letter="+" label="Any of these" days={cd.any} limit={MOH_DAYS_MIXED} />}
          </button>
          {/* Outside the button: "Set type" is its own action, and a button
              can't hold another. Only names logged in the window count —
              an untyped drug nobody took is nothing to fix today. */}
          {cd.untyped.length > 0 && (
            <p className="text-xs text-text-secondary">
              {cd.untyped.length === 1
                ? `${cd.untyped[0]} has no type set, so it isn't counted here.`
                : `${cd.untyped.slice(0, -1).join(', ')} and ${cd.untyped[cd.untyped.length - 1]} have no type set, so they aren't counted here.`}{' '}
              <button type="button" onClick={onOpenMedications} className="font-medium text-accent-light underline-offset-2 hover:underline">
                Set type
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );

  // Shared by both modes: the 24-hour position and when it was taken, then
  // the next-dose line when a minimum gap was entered and hasn't elapsed.
  // `withUnits` leads with the amount for the v3 card, whose name line carries
  // only the name; attack mode's row already shows it beside the name.
  function lastDoseDetail(withUnits: boolean) {
    if (!lastDose?.medication) return null;
    const units = doseUnits(lastDose.medication);
    return (
      <>
        {/* "Treo at 20:51" reads as a label with a timestamp — the verb is
            what makes it a statement about a dose that was taken. */}
        <p>
          {[
            withUnits ? unitsLabel(units, lastLibrary) : null,
            `${takenIn24h > units ? 'last taken' : 'taken'} ${formatTime(lastDose.time)}`,
            lastLibrary?.maxPerDay ? `${takenIn24h} of ${lastLibrary.maxPerDay} in the last 24h` : null,
          ].filter(Boolean).join(' · ')}
        </p>
        {position?.tooSoon && position.nextAllowedAt && (
          <p>Next dose from {formatTime(position.nextAllowedAt)}, by the gap you entered.</p>
        )}
      </>
    );
  }
}

/** A figure over its one-line label — the v3 number tile. */
function NumberTile({ value, label, onClick }: { value: number; label: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${TODAY_CARD} block w-full text-left`}>
      <span className="block text-[2.125rem] font-semibold leading-[1.1] text-text-primary">{value}</span>
      <span className="mt-1 block text-xs text-text-secondary">{label}</span>
    </button>
  );
}

/**
 * One class row: badge, label, "4 of 10", and an 8px bar under it. At 70% of
 * the limit the fill turns amber **and** a triangle sits before the figure —
 * never colour alone, since FL-41 lenses shift exactly the hues that would
 * carry it. The bar is `aria-hidden`; the figure and an `sr-only` phrase carry
 * the same facts as text.
 */
function ClassBar({ letter, label, days, limit }: { letter: string; label: string; days: number; limit: number }) {
  const warn = days >= warnAt(limit);
  return (
    <span className="block">
      <span className="flex items-center gap-2.5">
        <ClassBadge>{letter}</ClassBadge>
        <span className="min-w-0 flex-1 text-sm text-text-primary">
          {label}<span className="sr-only">,</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs text-text-secondary">
          {warn && <WarningIcon className="h-4 w-4 text-severity-mid" />}
          {days} of {limit}
          {warn && <span className="sr-only">, {days >= limit ? 'at or over the guideline' : 'close to the guideline'}</span>}
        </span>
      </span>
      <span aria-hidden="true" className="mt-2 block h-2 overflow-hidden rounded bg-bg-raised">
        <span
          className={`block h-full rounded ${warn ? 'bg-severity-mid' : 'bg-accent'}`}
          style={{ width: `${Math.min(100, (days / limit) * 100)}%` }}
        />
      </span>
    </span>
  );
}
