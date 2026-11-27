import { useEffect, useRef, useState } from 'react';
import { type Attack, type Medication, type Snapshot } from '../types';
import { isoToLocalInput, localInputToIso, formatTime, formatDuration } from '../utils/format';
import { attackMaxSeverity, FOLLOW_UP_TARGET_MS } from '../utils/stats';
import { doseEntryMs, followUpApplies, type SelectedMedication } from '../utils/doseEntries';
import { peakArea, doseHelpRows, rowEligible, placeDoseOutcomeEvents, type HelpRow } from '../utils/doseOutcomes';
import { chipClass } from '../utils/chipStyles';
import { RadioDot } from './RadioDot';
import { AreaSeverityPicker } from './AreaSeverityPicker';
import { MedicationEntry } from './MedicationEntry';
import { DoseOutcomeRow } from './DoseOutcomeRow';
import { DateTimeField, type DateTimeFieldHandle } from './DateTimeField';
import { MoreQuestionsFields, OFFER_TITLE, OFFER_SUBHEAD, EXTRAS_TITLE } from './MoreQuestions';
import { DiscardDraftDialog } from './DiscardDraftDialog';
import { lastReading } from '../utils/readings';
import { editWindows } from '../utils/editWindow';

interface Props {
  attack: Attack;
  symptoms: string[];
  reliefs: string[];
  recentMeds: Array<{ name: string; dose: string }>;
  medications?: Medication[];
  attacks?: Attack[];
  onAddSymptom: (s: string) => void;
  onAddRelief: (r: string) => void;
  onClose: () => void;
  /** `painQuality`: the attack's whole "Felt like" answer, only when it
   *  changed here — `undefined` leaves the stored one alone. */
  onSave: (snapshot: Omit<Snapshot, 'source'>, extraSnapshots: Array<Omit<Snapshot, 'source'>>, painQuality?: string[]) => void;
}

interface FormState {
  timeMode: 'now' | 'manual';
  time: string;
  areas: Record<string, number>;
  meds: SelectedMedication[];
  symptoms: string[];
  reliefs: string[];
  /** Attack-level, not part of the reading: starts from what's already
   *  stored (one answer per attack, as End and Detail treat it), unlike the
   *  reading's own fields, which start blank. */
  painQuality: string[];
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

/** The areas actually on record at `ms` — whichever existing scored
 *  snapshot is the nearest one at or before it, taken whole — read from the
 *  attack's *existing* history only, never from this update's own new "how
 *  bad now" reading, which didn't exist yet at any time before it's saved.
 *  A new dose entry backdated earlier than the attack's latest existing
 *  reading (e.g. "When it started") must be given the state that was really
 *  true back then, not today's current severities.
 *
 *  Deliberately *not* `lastKnownAreas`'s per-area lookback here: that would
 *  reconstruct this dose's "before" state as of `ms` by walking each area
 *  back to wherever it was last mentioned, which can resurrect an area that
 *  had already been dropped (stopped being re-rated) by the time of `ms` —
 *  the same ambiguity A2 leaves open ("how areas not re-rated are
 *  recorded"). Taking one snapshot's areas wholesale can itself be a one-area
 *  follow-up reading; that's an accepted, pre-existing shape already
 *  possible from Past/Live's own follow-up events, not a new one.
 *
 *  **Does skip a reading with no areas at all**, unlike the one-area case
 *  above — that isn't a smaller version of a real reading, it's not a
 *  severity reading at all (EndAttackForm's own closing "what was it like"
 *  snapshot). Backdating a new dose to land just after one — reachable once
 *  Edit pushes an attack's end past its own closing reading — would
 *  otherwise hand that dose an empty "before" state that becomes a
 *  permanent, unrewritable part of its record. */
function areasAsOf(snapshots: Snapshot[], ms: number): Record<string, number> {
  let result: Record<string, number> = {};
  for (const s of snapshots) {
    if (new Date(s.time).getTime() > ms) break;
    if (Object.keys(s.areas).length > 0) result = s.areas;
  }
  return result;
}

function blank(defaultTime: string, painQuality: string[] = []): FormState {
  return { timeMode: 'now', time: defaultTime, areas: {}, meds: [], symptoms: [], reliefs: [], painQuality };
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/**
 * "Add update" (v4 redesign) — When → How bad now → Did it help → Taken
 * since, then an offer of a few more questions (`MoreQuestions.tsx`), matching `docs/redesign-v4/screens/25-update/`, except that
 * the update time is its own first step (2026-11-27, Sunny's call — A2 kept
 * the step; it no longer shares a screen with the head diagram).
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
 * **No "Nothing changed" shortcut** (removed 2026-11-27, Sunny's call): the
 * v4 Update board has none, and a no-change reading stays reachable from the
 * reminder's own quick reply (`notification_no_change`).
 */
export function UpdateAttackForm({ attack, symptoms, reliefs, recentMeds, medications = [], attacks = [], onAddSymptom, onAddRelief, onClose, onSave }: Props) {
  // Not simply the last snapshot: one that only says what the attack was like
  // is stamped at the end, and would force every new update onto it.
  const prev = lastReading(attack);
  const minTime = prev.time;
  const maxTime = attack.end ?? new Date().toISOString();
  // The last reading that actually rated an area — not simply `prev`, which
  // can itself carry none (EndAttackForm's own closing "what was it like"
  // reading, symptoms/reliefs only). Carrying *that* forward into a
  // no-change reading would state a severity nobody gave; `minTime`/
  // `maxTime` above still bound against `prev` itself, unchanged.
  const lastScored = [...attack.snapshots].reverse().find((s) => Object.keys(s.areas).length > 0) ?? prev;
  const attackStartMs = new Date(attack.snapshots[0].time).getTime();
  const attackEndMs = attack.end ? new Date(attack.end).getTime() : null;

  const [openedAt] = useState(() => Date.now());
  // What the Felt like chips started from. The save compares against this,
  // not the live `attack` prop: a sync pull can change that prop while the
  // sheet is open, and comparing against it would write this sheet's stale
  // seed back over the newer answer with a fresh `updatedAt` (review,
  // 2026-11-27).
  const [seedQuality] = useState(() => attack.painQuality ?? []);
  // Felt like is offered while the attack is ongoing, and on an ended one
  // only inside Detail's own 48-hour answers window (`editWindow.ts`), so a
  // backfilled update can't change it later than Detail could. Settled once
  // when the sheet opens, so the step doesn't change under the user.
  const [feltLikeOpen] = useState(() => attack.end === null || (editWindows(attack)?.answersOpen ?? false));
  const [form, setForm] = useState<FormState>(() => {
    const opened = new Date().toISOString();
    const initialTime = opened < minTime ? minTime : opened > maxTime ? maxTime : opened;
    return blank(isoToLocalInput(initialTime), seedQuality);
  });
  const [helpAnswers, setHelpAnswers] = useState<Record<string, number>>({});
  const [discardOpen, setDiscardOpen] = useState(false);
  const timeInputRef = useRef<DateTimeFieldHandle>(null);

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  useEffect(() => {
    if (form.timeMode === 'manual') timeInputRef.current?.open();
  }, [form.timeMode]);

  // Computed once, when the sheet opens — a step disappearing mid-flow
  // because the clock ticked past FOLLOW_UP_TARGET_MS would be a worse
  // surprise than the (rare) case of answering a dose a few minutes before
  // the window technically opened.
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

  const STEPS = ['when', 'now', ...(helpRows.length > 0 ? ['help'] : []), 'meds', 'offer', 'else'] as const;
  const [stepIndex, setStepIndex] = useState(0);
  const kind = STEPS[stepIndex];
  const totalSteps = STEPS.length;
  // The counter covers the core reading only; the offer and its questions
  // sit outside it, so "Step 4 of 4" never turns into "of 6".
  const coreSteps = STEPS.indexOf('offer');

  const updateMs = form.timeMode === 'manual' ? new Date(localInputToIso(form.time)).getTime() : openedAt;
  const resolvedUpdateMs = Math.min(Math.max(updateMs, new Date(minTime).getTime()), new Date(maxTime).getTime());
  const peakSeverityNow = Math.max(0, ...Object.values(form.areas));

  const nextDisabled = kind === 'now' && Object.keys(form.areas).length === 0;

  function goNext() {
    if (nextDisabled) return;
    if (kind === 'offer' || stepIndex === totalSteps - 1) submit();
    else setStepIndex((s) => s + 1);
  }

  function goBack() {
    setStepIndex((s) => s - 1);
  }

  function requestClose() {
    if (Object.keys(form.areas).length > 0) setDiscardOpen(true);
    else onClose();
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
    // `placeDoseOutcomeEvents` (doseOutcomes.ts) keeps every answered row
    // strictly before the primary reading — see its own doc comment for why.
    for (const he of placeDoseOutcomeEvents(helpRows, helpAnswers, resolvedUpdateMs)) {
      events.push({ ms: he.ms, kind: 'followUp', area: he.area, value: he.value });
    }

    events.sort((a, b) => a.ms - b.ms);

    // Never actually read before the primary event overwrites it (every
    // `dose`/`followUp` event before the primary resolves through
    // `areasAsOf` instead) — kept as `lastScored.areas` rather than
    // `lastKnownAreas`: per-area lookback would resurrect an area the user had
    // since stopped re-rating (severity has no zero, so dropping an area is
    // how "this one eased" gets said — A2 leaves that question open).
    let runningAreas = { ...lastScored.areas };
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
      !feltLikeOpen || sameSet(form.painQuality, seedQuality) ? undefined : form.painQuality,
    );
  }

  const elapsed = formatDuration(attack.snapshots[0].time, new Date(resolvedUpdateMs).toISOString());
  const worst = attackMaxSeverity(attack);

  const STEP_TITLES: Record<string, string> = {
    when: 'When is this update from?',
    now: 'How bad is it now?',
    help: 'Did it help?',
    meds: 'Taken anything since?',
    offer: OFFER_TITLE,
    else: EXTRAS_TITLE,
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
      {/* Circle fill `bg-bg-raised`, not `bg-bg-surface` — see the note in
          `LiveAttackForm`'s own flow header. */}
      <div
        className="relative flex items-center gap-2 px-3.5 pb-0 pt-3.5"
        style={{ paddingTop: 'calc(0.875rem + env(safe-area-inset-top))' }}
      >
        {stepIndex > 0 ? (
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            className="tap-44 flex size-target items-center justify-center rounded-full bg-bg-raised text-text-primary transition-colors hover:bg-bg-elevated"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        ) : (
          <span className="size-target shrink-0" aria-hidden="true" />
        )}
        <span className="flex-1 text-center text-sm font-medium text-text-primary">{stepIndex < coreSteps ? `Step ${stepIndex + 1} of ${coreSteps}` : ''}</span>
        <button
          type="button"
          onClick={requestClose}
          aria-label="Close"
          className="tap-44 flex size-target items-center justify-center rounded-full bg-bg-raised text-text-primary transition-colors hover:bg-bg-elevated"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
            <path d="M7 7l10 10M17 7 7 17" />
          </svg>
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-gutter sm:px-gutter-wide pt-5 pb-4 flex flex-col">
        <div className="mb-5 shrink-0">
          <div className="min-w-0">
            <h1 className="text-[1.625rem] font-semibold leading-tight text-text-primary">{STEP_TITLES[kind]}</h1>
            {kind !== 'when' && <p className="mt-1.5 text-sm text-text-secondary">
              {kind === 'now' && <>Required<span className="text-severity-high ml-0.5">*</span> · {elapsed} in · worst {worst}</>}
              {kind === 'help' && 'Optional · for doses already logged this attack'}
              {kind === 'meds' && (lastDose ? `Optional · ${lastDose.name} at ${formatTime(lastDose.time)} is already logged` : 'Optional')}
              {kind === 'offer' && OFFER_SUBHEAD}
              {kind === 'else' && 'Optional'}
            </p>}
          </div>
        </div>

        {kind === 'when' && (
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
          </div>
        )}

        {kind === 'now' && (
          <AreaSeverityPicker value={form.areas} onChange={(v) => set('areas', v)} previousValue={lastKnownAreas(attack.snapshots)} />
        )}

        {kind === 'help' && (
          <div className="space-y-3">
            {helpRows.map((row) => (
              <DoseOutcomeRow
                key={row.name}
                // Downgraded to "too soon" the moment this update's own
                // time no longer leaves two hours between the dose and it
                // — answering before that point would store a reading
                // that loses `followUpReading`'s match to the primary
                // "how bad now" reading, so the row stops offering to
                // collect one rather than take an answer that silently
                // never counts.
                row={row.state === 'ask' && !rowEligible(row, resolvedUpdateMs, helpRows.length) ? { ...row, state: 'too-soon' } : row}
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
          // "Felt like" during the attack too (2026-11-27): once "Throbbing"
          // left the symptom list, End and Detail were the only places to
          // say it. Pre-filled from the attack — one answer per attack.
          <MoreQuestionsFields
            idPrefix="upd"
            showFeltLike={feltLikeOpen}
            painQuality={form.painQuality} onPainQuality={(v) => set('painQuality', v)}
            symptomOptions={symptoms} symptoms={form.symptoms} onSymptoms={(v) => set('symptoms', v)} onAddSymptom={onAddSymptom}
            reliefOptions={reliefs} reliefs={form.reliefs} onReliefs={(v) => set('reliefs', v)} onAddRelief={onAddRelief}
          />
        )}
      </div>

      <div
        className="flex gap-3 border-t border-bg-border bg-bg-surface px-gutter sm:px-gutter-wide py-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        {kind === 'offer' && (
          <button type="button" onClick={() => setStepIndex((s) => s + 1)} className="btn-secondary btn-cta flex-1 transition-colors">
            A few more
          </button>
        )}
        <button
          type="button"
          onClick={goNext}
          disabled={nextDisabled}
          title={nextDisabled ? 'Rate at least one pain area first' : undefined}
          className={`btn-primary btn-cta flex-1 transition-all ${nextDisabled ? '' : 'active:scale-[.99]'}`}
        >
          {kind === 'offer' || stepIndex === totalSteps - 1 ? 'Save' : 'Next'}
        </button>
      </div>

      <DiscardDraftDialog
        open={discardOpen}
        discardLabel="Discard this update"
        onKeepGoing={() => setDiscardOpen(false)}
        onSave={submit}
        onDiscard={onClose}
      />
    </div>
  );
}
