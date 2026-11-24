import { useEffect, useRef, useState } from 'react';
import type { Attack, Medication, Snapshot } from '../types';
import { isoToLocalInput, localInputToIso, formatTime, formatDuration } from '../utils/format';
import { maxSeverity, attackMaxSeverity, followUpReading, doseOutcomeWord, FOLLOW_UP_MIN_MS, FOLLOW_UP_MAX_MS, FOLLOW_UP_TARGET_MS, type DoseOutcomeWord } from '../utils/stats';
import { isRetired } from '../utils/retired';
import { doseEntryMs, followUpApplies, type SelectedMedication } from '../utils/doseEntries';
import { sevTextClass } from '../utils/severity';
import { chipClass } from '../utils/chipStyles';
import { RadioDot } from './RadioDot';
import { AreaSeverityPicker } from './AreaSeverityPicker';
import { MedicationEntry } from './MedicationEntry';
import { ChipSelector } from './ChipSelector';
import { DateTimeField, type DateTimeFieldHandle } from './DateTimeField';
import { TextScaleControl } from './TextScaleControl';
import type { TextScale } from '../hooks/useSettings';
import { SymptomIcon, ReliefIcon } from './drawnIcons';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  attack: Attack;
  symptoms: string[];
  reliefs: string[];
  recentMeds: Array<{ name: string; dose: string }>;
  medications?: Medication[];
  attacks?: Attack[];
  textScale: TextScale;
  onTextScale: (s: TextScale) => void;
  onAddSymptom: (s: string) => void;
  onAddRelief: (r: string) => void;
  onClose: () => void;
  onSave: (snapshot: Omit<Snapshot, 'source'>, extraSnapshots: Array<Omit<Snapshot, 'source'>>) => void;
  // Carries the previous reading's severities forward, marked `notification_no_change`
  // — `QuickUpdateForm`'s own "Finish now" path, kept reachable from the new
  // flow too (see this file's doc comment).
  onNoChange: (snapshot: Omit<Snapshot, 'source'>) => void;
}

interface FormState {
  timeMode: 'now' | 'manual';
  time: string;
  areas: Record<string, number>;
  meds: SelectedMedication[];
  symptoms: string[];
  reliefs: string[];
}

/** The area a dose's own "about 2 hours after?" reading is recorded
 *  against — the worst one *at the time of that dose*, same rule
 *  `PastAttackForm`/`LogForm` use for their own follow-up area. Not the same
 *  area as this update's own "how bad now" peak: a dose logged earlier in
 *  the attack is scored against the state it was actually taken into. */
function peakArea(areas: Record<string, number>): string | null {
  let best: string | null = null;
  for (const [k, v] of Object.entries(areas)) if (best === null || v > areas[best]) best = k;
  return best;
}

/** How each area stood at its own most recent reading — not just the
 *  attack's single latest snapshot, which can itself be a one-area
 *  follow-up reading and so say nothing about every other area that was
 *  genuinely logged more recently than never. This is what A2's "the
 *  severity control shows how *that area* was last logged" means read
 *  literally: per area, not per snapshot. */
function lastKnownAreas(snapshots: Snapshot[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (let i = snapshots.length - 1; i >= 0; i--) {
    for (const [area, sev] of Object.entries(snapshots[i].areas)) {
      if (!(area in result)) result[area] = sev;
    }
  }
  return result;
}

/** The areas actually on record at `ms` — whichever existing snapshot is
 *  the nearest one at or before it, taken whole — read from the attack's
 *  *existing* history only, never from this update's own new "how bad now"
 *  reading, which didn't exist yet at any time before it's saved. A new
 *  dose entry backdated earlier than the attack's latest existing reading
 *  (e.g. "When it started") must be given the state that was really true
 *  back then, not today's current severities.
 *
 *  Deliberately *not* `lastKnownAreas`'s per-area lookback here: that would
 *  reconstruct this dose's "before" state as of `ms` by walking each area
 *  back to wherever it was last mentioned, which can resurrect an area that
 *  had already been dropped (stopped being re-rated) by the time of `ms` —
 *  the same ambiguity `submitNoChange` backed away from, for the same
 *  reason. Taking one snapshot's areas wholesale can itself be a one-area
 *  follow-up reading; that's an accepted, pre-existing shape already
 *  possible from Past/Live's own follow-up events, not a new one. */
function areasAsOf(snapshots: Snapshot[], ms: number): Record<string, number> {
  let result: Record<string, number> = {};
  for (const s of snapshots) {
    if (new Date(s.time).getTime() > ms) break;
    result = s.areas;
  }
  return result;
}

type HelpRowState = 'answered' | 'ask' | 'too-soon';

interface HelpRow {
  name: string;
  dose: string;
  amount?: number;
  doseTimeIso: string;
  state: HelpRowState;
  word?: DoseOutcomeWord;
  peakArea: string | null;
}

/**
 * Doses already logged earlier in this attack that a "did it help?" reading
 * could still apply to — the first dose of each (unretired) drug, same scope
 * as `attackDoseOutcomes` (stats.ts), but windowed against `nowMs` directly
 * rather than that function's ongoing-attack-only `pending` gate: a past
 * attack being backfilled here can still take a reading for a dose that's
 * old enough and inside the window, which `attackDoseOutcomes` never offers
 * for an attack that already has an `end`.
 */
function doseHelpRows(attack: Attack, nowMs: number): HelpRow[] {
  const out: HelpRow[] = [];
  const snaps = attack.snapshots;
  for (let i = 0; i < snaps.length; i++) {
    const med = snaps[i].medication;
    const name = med?.name?.trim();
    if (!med || !name || isRetired(name) || out.some((o) => o.name === name)) continue;
    const before = maxSeverity(snaps[i]);
    const follow = followUpReading(snaps, i);
    const doseMs = new Date(snaps[i].time).getTime();
    const area = peakArea(snaps[i].areas);
    if (follow) {
      out.push({ name, dose: med.dose, amount: med.amount, doseTimeIso: snaps[i].time, state: 'answered', word: doseOutcomeWord(before, maxSeverity(follow)), peakArea: area });
      continue;
    }
    const age = nowMs - doseMs;
    if (age >= FOLLOW_UP_MAX_MS) continue; // window closed — nothing to ask
    // An attack that already ended too soon after this dose for a reading
    // to ever land past the 1h floor has nothing to wait for — left out
    // entirely rather than shown as "too soon to tell", which would read as
    // temporary when it never becomes answerable.
    if (attack.end && new Date(attack.end).getTime() - doseMs < FOLLOW_UP_MIN_MS) continue;
    out.push({ name, dose: med.dose, amount: med.amount, doseTimeIso: snaps[i].time, state: age < FOLLOW_UP_MIN_MS ? 'too-soon' : 'ask', peakArea: area });
  }
  return out;
}

function blank(defaultTime: string): FormState {
  return { timeMode: 'now', time: defaultTime, areas: {}, meds: [], symptoms: [], reliefs: [] };
}

/**
 * "Add update" (v4 redesign) — 4 steps (How bad now → Did it help → Taken
 * since → Anything else), matching `docs/redesign-v4/screens/25-update/`.
 * Replaces `QuickUpdateForm`'s **manual-entry** case only — a voice draft
 * still opens `QuickUpdateForm`, same reasoning `LiveAttackForm`/
 * `PastAttackForm` give for their own voice carve-out.
 *
 * **Step 2 ("Did it help?") shows no stored verdict** — `docs/redesign-v4-diff.md`
 * A1 rejected that option. What it shows is `doseOutcomeWord`, computed from
 * a before/after severity pair; where no after-reading exists yet and one
 * could still apply, the step asks for that *reading* (a 0–10 slider, the
 * same mechanic `MedicationEntry`'s own follow-up row already uses for a
 * brand-new dose), never a Yes/A bit/No tap. The step itself is left out of
 * the count entirely when this attack has no medication old enough to ask
 * about yet.
 *
 * **"Nothing changed" survives as a header link on step 1 only**, not a
 * "Finish now" reachable from every step — this flow's first step is
 * itself the required pain-area entry, so the old "form left entirely
 * blank" trigger no longer exists, but CLAUDE.md's Quick-update rule still
 * promises the shortcut and `notification_no_change` is still a real,
 * first-class plateau-analytics source worth keeping reachable from inside
 * the app, not only from a reminder's own quick reply.
 */
export function UpdateAttackForm({ attack, symptoms, reliefs, recentMeds, medications = [], attacks = [], textScale, onTextScale, onAddSymptom, onAddRelief, onClose, onSave, onNoChange }: Props) {
  const prev = attack.snapshots[attack.snapshots.length - 1];
  const minTime = prev.time;
  const maxTime = attack.end ?? new Date().toISOString();
  const attackStartMs = new Date(attack.snapshots[0].time).getTime();
  const attackEndMs = attack.end ? new Date(attack.end).getTime() : null;

  const [openedAt] = useState(() => Date.now());
  const [form, setForm] = useState<FormState>(() => {
    const opened = new Date().toISOString();
    const initialTime = opened < minTime ? minTime : opened > maxTime ? maxTime : opened;
    return blank(isoToLocalInput(initialTime));
  });
  const [helpAnswers, setHelpAnswers] = useState<Record<string, number>>({});
  const [discardOpen, setDiscardOpen] = useState(false);
  const [confirmNoChange, setConfirmNoChange] = useState(false);
  const timeInputRef = useRef<DateTimeFieldHandle>(null);

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  useEffect(() => {
    if (form.timeMode === 'manual') timeInputRef.current?.open();
  }, [form.timeMode]);

  // Computed once, when the sheet opens — a step disappearing mid-flow
  // because the clock ticked past FOLLOW_UP_MIN_MS would be a worse surprise
  // than the (rare) case of answering a dose a few minutes before the
  // window technically opened.
  const [helpRows] = useState<HelpRow[]>(() => doseHelpRows(attack, openedAt));

  // Most recently logged dose, if any — the "Taken anything since?" step's
  // own reference caption (`lastEntryCaption`'s step-3 case, trimmed to just
  // the one line the v4 board shows).
  const lastDose = (() => {
    for (let i = attack.snapshots.length - 1; i >= 0; i--) {
      const m = attack.snapshots[i].medication;
      if (m) return { name: m.name, dose: m.dose, time: attack.snapshots[i].time };
    }
    return null;
  })();

  const STEPS = ['now', ...(helpRows.length > 0 ? ['help'] : []), 'meds', 'else'] as const;
  const [stepIndex, setStepIndex] = useState(0);
  const kind = STEPS[stepIndex];
  const totalSteps = STEPS.length;

  const updateMs = form.timeMode === 'manual' ? new Date(localInputToIso(form.time)).getTime() : openedAt;
  const resolvedUpdateMs = Math.min(Math.max(updateMs, new Date(minTime).getTime()), new Date(maxTime).getTime());
  const peakSeverityNow = Math.max(0, ...Object.values(form.areas));

  // Whether a "did it help?" answer for `row` would land far enough past
  // its dose to actually register with `followUpReading` once this update
  // saves at `resolvedUpdateMs` — `helpRows`' own `state` was decided
  // against the clock when the sheet opened (deliberately, so the step
  // doesn't vanish mid-flow), but the update's own time can since move
  // earlier, including all the way down to `minTime` on a just-ended
  // attack whose own end fell inside the dose's 1h dead zone. Answering
  // anyway would store a reading `followUpReading` skips outright — worse
  // than just not offering it, since it looks saved but never counts.
  //
  // Padded by `helpRows.length` seconds, not just the bare 1h floor: `submit`
  // staggers every answered row a further second or so earlier to keep each
  // one strictly before the primary reading, so a gap only barely over 1h
  // can still land under the floor once that stagger is applied. One second
  // per row in `helpRows` (never just the answered ones, which can't be
  // known yet while this is only deciding what to show) is already more
  // headroom than `submit` can ever actually use.
  const rowEligible = (row: HelpRow) =>
    resolvedUpdateMs - new Date(row.doseTimeIso).getTime() >= FOLLOW_UP_MIN_MS + 1000 * helpRows.length;

  const nextDisabled = kind === 'now' && Object.keys(form.areas).length === 0;

  function goNext() {
    if (nextDisabled) return;
    if (stepIndex < totalSteps - 1) setStepIndex((s) => s + 1);
    else submit();
  }

  function goBack() {
    setStepIndex((s) => s - 1);
  }

  function requestClose() {
    if (Object.keys(form.areas).length > 0) setDiscardOpen(true);
    else onClose();
  }

  // Same record `QuickUpdateForm`'s own no-change path writes: the previous
  // reading's severities, carried forward at this reading's own time,
  // tagged `notification_no_change` rather than `manual` so the plateau
  // analytics count it as "held", not as a gap.
  // `prev.areas`, not `lastKnownAreas` — matching the other two writers of
  // this same source (the notification's own no-change reply, and
  // QuickUpdateForm's). Per-area lookback would resurrect an area the user
  // had since stopped re-rating: severity has no zero, so dropping an area
  // from a later full reading *is* how "this one eased" gets said, and A2
  // leaves "how areas not re-rated are recorded" an open question — not
  // something to settle differently in just one of three call sites.
  function submitNoChange() {
    onNoChange({ time: new Date(resolvedUpdateMs).toISOString(), areas: { ...prev.areas }, symptoms: [], reliefs: [], medication: null, note: null });
  }

  function submit() {
    const nowMs = Date.now();
    const nowArea = peakArea(form.areas);

    type Ev =
      | { ms: number; kind: 'primary' }
      | { ms: number; kind: 'dose'; medication: Omit<Snapshot, 'source'>['medication'] }
      | { ms: number; kind: 'followUp'; area: string; value: number };
    const events: Ev[] = [{ ms: resolvedUpdateMs, kind: 'primary' }];

    for (const med of form.meds) {
      for (const dose of med.doses) {
        const doseMs = doseEntryMs(dose, attackStartMs, attackEndMs, nowMs);
        const medication = { name: med.name, dose: med.dose, ...(dose.amount ? { amount: dose.amount } : {}) };
        events.push({ ms: doseMs, kind: 'dose', medication });
        if (dose.followUp !== null && nowArea && followUpApplies(doseMs, attackEndMs)) {
          events.push({ ms: doseMs + FOLLOW_UP_TARGET_MS, kind: 'followUp', area: nowArea, value: dose.followUp });
        }
      }
    }
    // Aimed at `doseTime + 2h` (the real mark `followUpReading` measures
    // against) but always kept *before* the primary reading, never at or
    // after it. The "ask" state only requires the dose be an hour old, so
    // the literal +2h mark can still be in the future relative to right now
    // — landing it on the primary reading's own moment would make this
    // single-area reading the attack's newest snapshot, which every "last
    // reading = current state" reader (a later no-change copy, the
    // reminder body, the next update's own `prev`) would then take as the
    // whole picture. Floored at `doseTime + 1h` for the same reason as the
    // ceiling: a manually backdated update time could otherwise push it
    // under `followUpReading`'s own 1h dead zone, where it's skipped rather
    // than matched, even though the eligibility check above already
    // guaranteed this dose is really that old. Staggered a second apart so
    // two answered rows in one update don't collide on the same timestamp.
    const answeredHelpRows = helpRows.filter((row) => helpAnswers[row.name] !== undefined && row.peakArea && rowEligible(row));
    answeredHelpRows.forEach((row, i) => {
      const doseMs = new Date(row.doseTimeIso).getTime();
      const floor = doseMs + FOLLOW_UP_MIN_MS;
      // One whole second reserved per answered row, nearest the primary
      // reading last — keeps every one of them strictly before it even
      // when `floor` would otherwise land past the ceiling (a manually
      // backdated update time, picked earlier than this dose's own +1h
      // mark): the ceiling always wins that clash, trading a few minutes
      // off the nominal 1h floor for never landing on or after "now".
      const ceiling = resolvedUpdateMs - 1000 * (answeredHelpRows.length - i);
      const target = Math.min(doseMs + FOLLOW_UP_TARGET_MS, ceiling);
      events.push({ ms: Math.min(Math.max(floor, target), ceiling), kind: 'followUp', area: row.peakArea!, value: helpAnswers[row.name] });
    });

    events.sort((a, b) => a.ms - b.ms);

    // Never actually read before the primary event overwrites it (every
    // `dose`/`followUp` event before the primary resolves through
    // `areasAsOf` instead) — kept as `prev.areas` rather than
    // `lastKnownAreas` only so this starting value doesn't quietly imply a
    // different "no change" policy than `submitNoChange` just settled on.
    let runningAreas = { ...prev.areas };
    let openingMedication: Omit<Snapshot, 'source'>['medication'] = null;
    let openingClaimed = false;
    const extraSnapshots: Array<Omit<Snapshot, 'source'>> = [];

    for (const ev of events) {
      if (ev.kind === 'primary') {
        runningAreas = { ...form.areas };
        continue;
      }
      if (ev.kind === 'followUp') {
        runningAreas = { ...runningAreas, [ev.area]: ev.value };
        extraSnapshots.push({ time: new Date(ev.ms).toISOString(), areas: { [ev.area]: ev.value }, symptoms: [], reliefs: [], medication: null, note: null });
        continue;
      }
      if (!openingClaimed && Math.abs(ev.ms - resolvedUpdateMs) < 60_000) {
        openingMedication = ev.medication;
        openingClaimed = true;
      } else {
        // A dose dated before this update's own reading (e.g. "When it
        // started", or any manual time earlier than `prev.time`) gets the
        // state that was actually on record *at its own moment* — never
        // `runningAreas`, which by this point can already reflect today's
        // "how bad now" answer and would otherwise assert a severity this
        // dose was never really logged against. One at or after the
        // primary reading correctly keeps using `runningAreas`, which by
        // then *is* that reading (refreshed by any dose-outcome answers
        // processed since).
        const areas = ev.ms < resolvedUpdateMs ? areasAsOf(attack.snapshots, ev.ms) : runningAreas;
        extraSnapshots.push({ time: new Date(ev.ms).toISOString(), areas: { ...areas }, symptoms: [], reliefs: [], medication: ev.medication, note: null });
      }
    }

    onSave(
      {
        time: new Date(resolvedUpdateMs).toISOString(),
        areas: form.areas,
        symptoms: form.symptoms,
        reliefs: form.reliefs,
        medication: openingMedication,
        note: null,
      },
      extraSnapshots,
    );
  }

  const elapsed = formatDuration(attack.snapshots[0].time, new Date(resolvedUpdateMs).toISOString());
  const worst = attackMaxSeverity(attack);

  const STEP_TITLES: Record<string, string> = {
    now: 'How bad is it now?',
    help: 'Did it help?',
    meds: 'Taken anything since?',
    else: 'Anything else right now?',
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
      <div
        className="relative flex items-center gap-2 px-3.5 pb-0 pt-3.5"
        style={{ paddingTop: 'calc(0.875rem + env(safe-area-inset-top))' }}
      >
        {stepIndex > 0 ? (
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            className="tap-44 flex size-target items-center justify-center rounded-full bg-bg-surface text-text-primary transition-colors hover:bg-bg-raised"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        ) : (
          <span className="size-target shrink-0" aria-hidden="true" />
        )}
        <span className="flex-1 text-center text-sm font-medium text-text-primary">Step {stepIndex + 1} of {totalSteps}</span>
        <button
          type="button"
          onClick={requestClose}
          aria-label="Close"
          className="tap-44 flex size-target items-center justify-center rounded-full bg-bg-surface text-text-primary transition-colors hover:bg-bg-raised"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
            <path d="M7 7l10 10M17 7 7 17" />
          </svg>
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-gutter sm:px-gutter-wide pt-5 pb-4 flex flex-col">
        <div className="mb-5 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h1 className="text-[1.625rem] font-semibold leading-tight text-text-primary">{STEP_TITLES[kind]}</h1>
            <p className="mt-1.5 text-sm text-text-secondary">
              {kind === 'now' && <>Required<span className="text-severity-high ml-0.5">*</span> · {elapsed} in · worst {worst}</>}
              {kind === 'help' && 'Optional · for doses already logged this attack'}
              {kind === 'meds' && (lastDose ? `Optional · ${lastDose.name} at ${formatTime(lastDose.time)} is already logged` : 'Optional')}
              {kind === 'else' && 'Optional · pick any'}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <TextScaleControl scale={textScale} onScale={onTextScale} />
            {kind === 'now' && (
              <button
                type="button"
                onClick={() => setConfirmNoChange(true)}
                className="tap-44-y px-1 py-1 text-sm font-medium text-accent-light transition-colors hover:text-accent"
              >
                Nothing changed
              </button>
            )}
          </div>
        </div>

        {kind === 'now' && (
          <div className="space-y-4">
            <div role="radiogroup" aria-label="When this reading is from" className="flex flex-wrap gap-2">
              <button
                type="button"
                role="radio"
                aria-checked={form.timeMode === 'now'}
                onClick={() => set('timeMode', 'now')}
                className={`tap-44-y inline-flex items-center gap-1.5 rounded-chip px-4 py-2 text-sm font-medium transition-colors ${chipClass(form.timeMode === 'now')}`}
              >
                <RadioDot selected={form.timeMode === 'now'} />
                Just now
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={form.timeMode === 'manual'}
                onClick={() => set('timeMode', 'manual')}
                className={`tap-44-y inline-flex items-center gap-1.5 rounded-chip px-4 py-2 text-sm font-medium transition-colors ${chipClass(form.timeMode === 'manual')}`}
              >
                <RadioDot selected={form.timeMode === 'manual'} />
                Pick a time…
              </button>
            </div>
            {form.timeMode === 'manual' && (
              <DateTimeField
                label="Time of this reading"
                value={form.time}
                min={isoToLocalInput(minTime)}
                max={isoToLocalInput(maxTime)}
                onChange={(v) => set('time', v)}
                openRef={timeInputRef}
              />
            )}
            <AreaSeverityPicker value={form.areas} onChange={(v) => set('areas', v)} previousValue={lastKnownAreas(attack.snapshots)} />
          </div>
        )}

        {kind === 'help' && (
          <div className="space-y-3">
            {helpRows.map((row) => (
              <DoseHelpRow
                key={row.name}
                // Downgraded to "too soon" the moment this update's own
                // time no longer leaves an hour between the dose and it —
                // answering past that point would store a reading
                // `followUpReading` skips outright, so the row stops
                // offering to collect one rather than take an answer that
                // silently never counts.
                row={row.state === 'ask' && !rowEligible(row) ? { ...row, state: 'too-soon' } : row}
                value={helpAnswers[row.name] ?? null}
                onChange={(v) => setHelpAnswers((a) => {
                  const next = { ...a };
                  if (v === null) delete next[row.name]; else next[row.name] = v;
                  return next;
                })}
              />
            ))}
          </div>
        )}

        {kind === 'meds' && (
          <MedicationEntry
            value={form.meds}
            onChange={(v) => set('meds', v)}
            recentMeds={recentMeds}
            medications={medications}
            attacks={attacks}
            startMs={attackStartMs}
            endMs={attackEndMs}
            nowMs={Date.now()}
            followUpStart={attackEndMs !== null ? peakSeverityNow : undefined}
          />
        )}

        {kind === 'else' && (
          <div className="space-y-6">
            <section className="space-y-2" aria-labelledby="upd-symptoms-label">
              <h3 id="upd-symptoms-label" className="text-sm font-medium text-text-primary">
                Also had <span className="font-normal text-text-secondary">— pick any</span>
              </h3>
              <ChipSelector options={symptoms} selected={form.symptoms}
                onChange={(v) => set('symptoms', v)} onAddCustom={onAddSymptom}
                renderIcon={(s) => <SymptomIcon name={s} className="h-4 w-4" />} />
            </section>
            <section className="space-y-2" aria-labelledby="upd-reliefs-label">
              <h3 id="upd-reliefs-label" className="text-sm font-medium text-text-primary">
                What have you tried? <span className="font-normal text-text-secondary">— pick any</span>
              </h3>
              <ChipSelector options={reliefs} selected={form.reliefs}
                onChange={(v) => set('reliefs', v)} onAddCustom={onAddRelief}
                renderIcon={(r) => <ReliefIcon name={r} className="h-4 w-4" />} />
            </section>
          </div>
        )}
      </div>

      <div
        className="flex gap-3 border-t border-bg-border bg-bg-surface px-gutter sm:px-gutter-wide py-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={goNext}
          disabled={nextDisabled}
          title={nextDisabled ? 'Rate at least one pain area first' : undefined}
          className={`btn-primary flex-1 transition-all ${nextDisabled ? '' : 'active:scale-[.99]'}`}
        >
          {stepIndex === totalSteps - 1 ? 'Save update' : 'Next'}
        </button>
      </div>

      <DiscardDialog
        open={discardOpen}
        onKeepGoing={() => setDiscardOpen(false)}
        onSaveAndClose={submit}
        onDiscard={onClose}
      />

      <ConfirmDialog
        open={confirmNoChange}
        title="Log that nothing has changed?"
        message={`This saves a reading at ${formatTime(new Date(resolvedUpdateMs).toISOString())} carrying your last entry forward — same pain areas and severities. Go back if you want to record something different.`}
        confirmLabel="Log no change"
        cancelLabel="Go back"
        onConfirm={() => { setConfirmNoChange(false); submitNoChange(); }}
        onCancel={() => setConfirmNoChange(false)}
      />
    </div>
  );
}

/**
 * One already-logged dose's "did it help?" row. `answered` just reads back
 * `doseOutcomeWord`; `too-soon` is informational, not a choice; `ask` reuses
 * `MedicationEntry`'s own follow-up slider shape so the two mechanisms read
 * as one thing, not two — see this file's own doc comment on why there is
 * no Yes/A bit/No tap here.
 */
function DoseHelpRow({ row, value, onChange }: {
  row: HelpRow;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const atText = formatTime(row.doseTimeIso);
  const label = `${row.name}${row.dose ? ` · ${row.dose}` : ''} · ${atText}`;

  if (row.state === 'answered') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-control bg-bg-raised p-3">
        <span className="text-sm text-text-primary">{label}</span>
        <span className="text-sm font-medium text-accent-light">{row.word}</span>
      </div>
    );
  }

  if (row.state === 'too-soon') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-control bg-bg-raised p-3">
        <span className="text-sm text-text-primary">{label}</span>
        <span className="text-sm text-text-secondary">Too soon to tell</span>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 rounded-control bg-bg-raised p-3">
      <p className="text-sm text-text-primary">{label}</p>
      {value === null ? (
        <button type="button" onClick={() => onChange(5)} className="btn-secondary btn-compact">
          Add how bad it was
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">How bad, about 2h after</span>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold tabular-nums ${sevTextClass(value)}`}>{value}</span>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="text-text-secondary hover:text-text-primary transition-colors"
                aria-label="Remove this reading"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <line x1="4" y1="4" x2="12" y2="12" />
                  <line x1="12" y1="4" x2="4" y2="12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-7">None</span>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={value}
              aria-label={`Severity about 2 hours after ${row.name}`}
              onChange={(e) => onChange(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-text-secondary w-12 text-right">Severe</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Same discard-draft mechanism as `PastAttackForm`'s own `DiscardDialog` —
 *  copied rather than shared, per this app's "copy the mechanism, don't
 *  write a simplified version" rule for a hand-rolled dialog beyond
 *  `ConfirmDialog`'s own confirm/cancel pair. Its own doc comment there
 *  explains the known Escape-key gap, unchanged here. */
function DiscardDialog({ open, onKeepGoing, onSaveAndClose, onDiscard }: {
  open: boolean;
  onKeepGoing: () => void;
  onSaveAndClose: () => void;
  onDiscard: () => void;
}) {
  const keepGoingRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onKeepGoing(); };
    window.addEventListener('keydown', onKey);
    keepGoingRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onKeepGoing]);

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-end justify-center ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
      inert={!open}
      style={{ visibility: open ? 'visible' : 'hidden', transition: `visibility 0s linear ${open ? '0s' : '200ms'}` }}
    >
      <div className="absolute inset-0 bg-bg-base/70" onClick={onKeepGoing} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Discard this update?"
        className="relative w-full max-w-2xl space-y-3 rounded-t-sheet border border-bg-border bg-bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <h2 className="text-lg font-medium text-text-primary">Discard this update?</h2>
        <p className="text-sm text-text-secondary">
          Nothing is saved yet. Save what you've entered so far, or discard the whole thing.
        </p>
        <div className="space-y-2 pt-1">
          <button ref={keepGoingRef} type="button" onClick={onKeepGoing} className="btn-primary w-full">
            Keep going
          </button>
          <button type="button" onClick={onSaveAndClose} className="btn-secondary w-full rounded-control py-control-y text-sm font-medium transition-colors">
            Save and close
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="w-full rounded-control px-control-x py-2.5 text-sm font-medium text-bg-base transition-colors bg-severity-high hover:opacity-90"
          >
            Discard this update
          </button>
        </div>
      </div>
    </div>
  );
}
