import { useEffect, useRef, useState } from 'react';
import { DiscardDraftDialog } from './DiscardDraftDialog';
import type { Attack, Medication, NotificationConfig, Snapshot } from '../types';
import { PAIN_QUALITY_OPTIONS, NOTHING_UNUSUAL } from '../types';
import { isoToLocalInput, localInputToIso } from '../utils/format';
import { doseEntryMs, followUpApplies, type SelectedMedication } from '../utils/doseEntries';
import { FOLLOW_UP_TARGET_MS } from '../utils/stats';
import { chipClass } from '../utils/chipStyles';
import { AreaSeverityPicker } from './AreaSeverityPicker';
import { MedicationEntry } from './MedicationEntry';
import { ChipSelector } from './ChipSelector';
import { NothingUnusualChip } from './NothingUnusualChip';
import { DateTimeField, type DateTimeFieldHandle } from './DateTimeField';
import { SymptomIcon, ReliefIcon, TriggerIcon } from './drawnIcons';
import { SunriseIcon } from './icons';
import { ChipCheck } from './ChipCheck';
import { PastAttackSaved } from './PastAttackSaved';

interface Props {
  symptoms: string[];
  reliefs: string[];
  triggers: string[];
  recentMeds: Array<{ name: string; dose: string }>;
  medications?: Medication[];
  attacks?: Attack[];
  defaultNotifConfig: NotificationConfig;
  onAddSymptom: (s: string) => void;
  onAddRelief: (r: string) => void;
  onAddTrigger: (t: string) => void;
  onClose: () => void;
  /** Starts a fresh form from the summary screen — the parent remounts this
   *  component, so every field and the step go back to blank. */
  onAddAnother: () => void;
  /** Resolves to the attack as stored, which the summary screen reads back. */
  onSave: (
    snapshot: Omit<Snapshot, 'source'>,
    triggers: string[],
    notifConfig: NotificationConfig,
    end: string | null,
    wokeWithMigraine: boolean,
    doseReadings: Array<Omit<Snapshot, 'source'>>,
    endUnknown?: boolean,
    painQuality?: string[],
    wokeAt?: string,
  ) => Promise<Attack>;
}

interface FormState {
  startTime: string;
  wokeWithMigraine: boolean;
  endTime: string;
  /** "Woke up without it" — the end is unknown. With a time in `endTime`,
   *  that time is when they woke (`wokeAt`, an upper bound), never an end:
   *  turning the chip on used to blank a time already picked (June,
   *  2026-11-25 — "it shouldn't"). */
  endUnknownFlag: boolean;
  /** Whether the end time was picked by hand. Untouched, it's only the
   *  form's default ("now"), which must never become a wake-up time. */
  endTouched: boolean;
  areas: Record<string, number>;
  meds: SelectedMedication[];
  painQuality: string[];
  symptoms: string[];
  reliefs: string[];
  triggers: string[];
  note: string;
}

function blank(): FormState {
  return {
    startTime: isoToLocalInput(),
    wokeWithMigraine: false,
    endTime: isoToLocalInput(),
    endUnknownFlag: false,
    endTouched: false,
    areas: {},
    meds: [],
    painQuality: [],
    symptoms: [],
    reliefs: [],
    triggers: [],
    note: '',
  };
}

// Six steps, one topic each (2026-11-27, Sunny's call). The board's five put
// pain quality, symptoms and reliefs on one screen and the two days before
// with a note on the next; on the phone both read as too much to ask at once.
// Felt like and Also had stay together — both describe the pain itself.
const STEP_LABELS = ['When was it?', 'Where does it hurt?', 'Did you take anything?', 'What was it like?', 'What did you try?', 'The two days before'];
const STEP_SUBHEADS = [
  'Required: fill out date and time.',
  'Tap an area, then rate it. Required.',
  // Plain "Optional" on every optional step (June, 2026-11-25): "pick any"
  // already sits on the medication list's own label, and the chip checks
  // say it.
  'Optional',
  'Optional',
  'Optional',
  'Optional',
];

/** The area the two-hour follow-up answer is recorded against: the worst
 *  one, same rule as `LogForm`'s own `peakArea`. */
function peakArea(areas: Record<string, number>): string | null {
  let best: string | null = null;
  for (const [k, v] of Object.entries(areas)) if (best === null || v > areas[best]) best = k;
  return best;
}

/**
 * "Add a past attack" (v4 redesign) — 6 steps (When → Where → Medication →
 * What it was like → What you tried → The two days before), from
 * `docs/redesign-v4/screens/21-past-attack/` with its last two steps split
 * into three (2026-11-27). Replaces `LogForm`'s
 * `past={true}` case for **manual** entry — a voice draft still opens
 * `LogForm`, same reasoning as `LiveAttackForm`.
 *
 * Deliberately asks nothing about impact (how much the attack stopped the
 * user) — `docs/redesign-v4-diff.md` A5 holds the line on `impact.ts`'s own
 * recall-bias reasoning, which the board's "How much did it stop you?" step
 * would reopen for an attack that, by construction, is already being logged
 * after the fact. Impact is only ever asked live, as a step of
 * `EndAttackForm` (the 2026-11-25 removal of the Today fallback dropped the
 * one other path); a backfilled past attack stays unanswered.
 */
export function PastAttackForm({ symptoms, reliefs, triggers, recentMeds, medications = [], attacks = [], defaultNotifConfig, onAddSymptom, onAddRelief, onAddTrigger, onClose, onAddAnother, onSave }: Props) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(blank);
  const [discardOpen, setDiscardOpen] = useState(false);
  // The note sits behind "+ Add a note" on the last step, as the board draws
  // it; it stays open once there's text in it.
  const [noteOpen, setNoteOpen] = useState(false);
  // The stored attack once saved — swaps the steps for the summary screen.
  const [saved, setSaved] = useState<Attack | null>(null);
  // One save per form: a second tap while the first is still in flight would
  // log the attack twice.
  const savingRef = useRef(false);
  const startInputRef = useRef<DateTimeFieldHandle>(null);
  const endInputRef = useRef<DateTimeFieldHandle>(null);

  useEffect(() => { startInputRef.current?.open(); }, []);

  const totalSteps = STEP_LABELS.length;

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  const startMs = new Date(localInputToIso(form.startTime)).getTime();
  const hasEndTime = form.endTime.trim() !== '';
  // Bounds doses/follow-ups while the form is open. An unknown end is
  // treated like "ongoing" here (null) — relative presets bound to now,
  // without asserting a real end that isn't known. `nextDisabled` already
  // guarantees one of the two is true by the time step 3 is reachable.
  const endMsForBounds = hasEndTime ? new Date(localInputToIso(form.endTime)).getTime() : null;

  const nextDisabled =
    (step === 1 && (!form.startTime || !(hasEndTime || form.endUnknownFlag))) ||
    (step === 2 && Object.keys(form.areas).length === 0);

  function goNext() {
    if (nextDisabled) return;
    if (step < totalSteps) setStep((s) => s + 1);
    else submit();
  }

  function goBack() {
    setStep((s) => s - 1);
  }

  function requestClose() {
    // Nothing worth confirming until the one required step (pain areas) is
    // filled — before that there's no draft to lose.
    if (Object.keys(form.areas).length > 0) setDiscardOpen(true);
    else onClose();
  }

  /** `thenClose`: from the discard dialog's Save, where the user was already
   *  leaving — no summary, the sheet just closes. */
  function submit(thenClose = false) {
    if (savingRef.current) return;
    savingRef.current = true;
    const nowMs = Date.now();
    const resolvedStartMs = new Date(localInputToIso(form.startTime)).getTime();
    const hasTime = form.endTime.trim() !== '';
    // With the chip on, a time is when they woke — not an end.
    const endKnown = hasTime && !form.endUnknownFlag;
    const endUnknown = form.endUnknownFlag;
    // Never before the start: the start can be moved past a time already
    // picked, and nothing re-clamps the end field. A known end is clamped
    // below (`clampedEndMs`); a wake-up time gets the same rule Detail's
    // editor applies (review of db053be — Detail showed "up to -45m").
    const pickedIso = hasTime ? localInputToIso(form.endTime) : null;
    const wokeAtIso = endUnknown && pickedIso
      ? new Date(Math.max(new Date(pickedIso).getTime(), resolvedStartMs)).toISOString()
      : undefined;
    // While resolving dose/follow-up times, an unknown end is bounded like
    // "ongoing" (null) rather than asserted as a real end. The *stored* end
    // is derived below from whatever times this attack actually ends up
    // with — never "now": for a backfilled attack "now" can be days or weeks
    // after it really ended, which would wildly overcount ICHD attack-days
    // (attackDayKeys counts every day from start to end). Caught in review
    // before this ever reached a phone.
    // A wake-up time bounds doses too: nothing was taken after it ended.
    const boundEndMs = pickedIso ? Math.max(new Date(pickedIso).getTime(), resolvedStartMs) : null;

    // Every dose and follow-up, resolved to a real timestamp and sorted into
    // time order — not grouped by medicine — because a later dose's own
    // "full state" reading has to reflect whatever was most recently
    // reported, not the original opening severities. Processing medicine by
    // medicine would let a second medicine's dose, entered after an earlier
    // follow-up already reported a lower number, restate the original
    // (higher) severity as if nothing had changed.
    const peak = peakArea(form.areas);
    interface Ev { ms: number; medication: Omit<Snapshot, 'source'>['medication']; followUpArea?: string; followUpValue?: number }
    const events: Ev[] = [];
    for (const med of form.meds) {
      for (const dose of med.doses) {
        const doseMs = doseEntryMs(dose, resolvedStartMs, boundEndMs, nowMs);
        const medication = { name: med.name, dose: med.dose, ...(dose.amount ? { amount: dose.amount } : {}) };
        events.push({ ms: doseMs, medication });
        if (dose.followUp !== null && peak && followUpApplies(doseMs, boundEndMs)) {
          events.push({ ms: doseMs + FOLLOW_UP_TARGET_MS, medication: null, followUpArea: peak, followUpValue: dose.followUp });
        }
      }
    }
    events.sort((a, b) => a.ms - b.ms);

    let runningAreas = { ...form.areas };
    let openingMedication: Omit<Snapshot, 'source'>['medication'] = null;
    let openingClaimed = false;
    const extraSnapshots: Array<Omit<Snapshot, 'source'>> = [];

    for (const ev of events) {
      if (ev.followUpArea) {
        // The follow-up reading itself still reports only the one area
        // asked about — same "not recorded" rule as LogForm's own follow-up
        // — but it updates the running state a later dose's full-state
        // reading will carry forward.
        runningAreas = { ...runningAreas, [ev.followUpArea]: ev.followUpValue! };
        extraSnapshots.push({
          time: new Date(ev.ms).toISOString(), areas: { [ev.followUpArea]: ev.followUpValue! }, symptoms: [], reliefs: [], medication: null, note: null,
        });
        continue;
      }
      if (!openingClaimed && Math.abs(ev.ms - resolvedStartMs) < 60_000) {
        openingMedication = ev.medication;
        openingClaimed = true;
      } else {
        extraSnapshots.push({
          time: new Date(ev.ms).toISOString(), areas: { ...runningAreas }, symptoms: [], reliefs: [], medication: ev.medication, note: null,
        });
      }
    }

    // For an unknown end, the placeholder is the start — never the latest
    // dose/follow-up time. A dose entry defaults to "Just now"
    // (`newDoseEntry`), so a placeholder derived from dose times is `nowMs`
    // again the moment any dose is added without its time being changed —
    // the exact bug this was meant to fix, just reachable through a second
    // path review caught ("no dose at all" wasn't the only way to hit it).
    // `endUnknown` already tells every duration-reading caller not to trust
    // this value, so anchoring it to the one timestamp the user gave on
    // purpose (the start) is the safest placeholder, even though a dose can
    // now carry its own (separately honest) recorded time past it.
    const resolvedEndMs = endKnown ? boundEndMs! : resolvedStartMs;
    const clampedEndMs = Math.max(resolvedEndMs, resolvedStartMs);

    void onSave(
      {
        time: new Date(resolvedStartMs).toISOString(),
        areas: form.areas,
        symptoms: form.symptoms,
        reliefs: form.reliefs,
        medication: openingMedication,
        note: form.note.trim() || null,
      },
      form.triggers,
      defaultNotifConfig,
      new Date(clampedEndMs).toISOString(),
      form.wokeWithMigraine,
      extraSnapshots,
      endUnknown,
      form.painQuality,
      wokeAtIso,
    ).then((attack) => {
      if (thenClose) onClose();
      else setSaved(attack);
    });
  }

  const peakSeverity = Math.max(0, ...Object.values(form.areas));

  if (saved) {
    return <PastAttackSaved attack={saved} medications={medications} onAddAnother={onAddAnother} onDone={onClose} />;
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
      {/* Circle fill `bg-bg-raised`, not `bg-bg-surface` — see the note in
          `LiveAttackForm`'s own flow header. */}
      <div
        className="relative flex items-center gap-2 px-3.5 pb-0 pt-3.5"
        style={{ paddingTop: 'calc(0.875rem + env(safe-area-inset-top))' }}
      >
        {step > 1 ? (
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
        <span className="flex-1 text-center text-sm font-medium text-text-primary">Step {step} of {totalSteps}</span>
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
          <h1 className="text-[1.625rem] font-semibold leading-tight text-text-primary">{STEP_LABELS[step - 1]}</h1>
          <p className="mt-1.5 text-sm text-text-secondary">{STEP_SUBHEADS[step - 1]}</p>
        </div>

        {step === 1 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Started</p>
              <DateTimeField
                label="Attack start"
                value={form.startTime}
                max={isoToLocalInput()}
                onChange={(v) => set('startTime', v)}
                openRef={startInputRef}
              />
              <button
                type="button"
                onClick={() => set('wokeWithMigraine', !form.wokeWithMigraine)}
                aria-pressed={form.wokeWithMigraine}
                className={`tap-44-y inline-flex items-center gap-1.5 rounded-chip px-3.5 py-2 text-sm font-medium transition-colors ${chipClass(form.wokeWithMigraine)}`}
              >
                <SunriseIcon className="h-4 w-4" />
                Woke up with it
                <ChipCheck selected={form.wokeWithMigraine} />
              </button>
            </div>
            <div className="border-t border-bg-border pt-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Ended</p>
              <DateTimeField
                label="Attack end"
                value={form.endTime}
                min={form.startTime}
                max={isoToLocalInput()}
                onChange={(v) => { set('endTime', v); set('endTouched', true); }}
                openRef={endInputRef}
              />
              <button
                type="button"
                onClick={() => {
                  const next = !form.endUnknownFlag;
                  set('endUnknownFlag', next);
                  // Only the untouched default is cleared; a time picked by
                  // hand stays, and becomes the wake-up time.
                  if (next && !form.endTouched) set('endTime', '');
                }}
                aria-pressed={form.endUnknownFlag}
                className={`tap-44-y inline-flex items-center gap-1.5 rounded-chip px-3.5 py-2 text-sm font-medium transition-colors ${chipClass(form.endUnknownFlag)}`}
              >
                Woke up without it
              </button>
              {form.endUnknownFlag && (
                <p className="text-xs text-text-secondary">
                  {hasEndTime
                    ? 'Saved as gone when you woke up, at this time.'
                    : 'Saved as "gone when you woke up." Add the time you woke if you know it.'}
                </p>
              )}
            </div>
          </div>
        )}

        {step === 2 && <AreaSeverityPicker value={form.areas} onChange={(v) => set('areas', v)} />}

        {step === 3 && (
          <MedicationEntry
            value={form.meds}
            onChange={(v) => set('meds', v)}
            recentMeds={recentMeds}
            medications={medications}
            attacks={attacks}
            startMs={startMs}
            endMs={endMsForBounds}
            nowMs={Date.now()}
            followUpStart={peakSeverity}
          />
        )}

        {step === 4 && (
          <div className="space-y-6">
            <section className="space-y-2" aria-labelledby="felt-like-label">
              <h3 id="felt-like-label" className="text-sm font-medium text-text-primary">
                Felt like
              </h3>
              <ChipSelector options={PAIN_QUALITY_OPTIONS} selected={form.painQuality} onChange={(v) => set('painQuality', v)} />
            </section>
            <section className="space-y-2" aria-labelledby="also-had-label">
              <h3 id="also-had-label" className="text-sm font-medium text-text-primary">
                Also had
              </h3>
              <ChipSelector options={symptoms} selected={form.symptoms} onChange={(v) => set('symptoms', v)}
                onAddCustom={onAddSymptom} renderIcon={(s) => <SymptomIcon name={s} className="h-4 w-4" />} />
            </section>
          </div>
        )}

        {/* Steps 5 and 6 carry no section heading: each holds one list, and
            the step's own title already names it. */}
        {step === 5 && (
          <section aria-label="What you tried">
            <ChipSelector options={reliefs} selected={form.reliefs} onChange={(v) => set('reliefs', v)}
              onAddCustom={onAddRelief} renderIcon={(r) => <ReliefIcon name={r} className="h-4 w-4" />} />
          </section>
        )}

        {step === 6 && (
          <div className="space-y-6">
            <section aria-label="The two days before">
              <ChipSelector
                options={triggers}
                selected={form.triggers.filter((t) => t !== NOTHING_UNUSUAL)}
                onChange={(v) => set('triggers', v)}
                onAddCustom={onAddTrigger}
                renderIcon={(t) => <TriggerIcon name={t} className="h-4 w-4" />}
              />
              <NothingUnusualChip
                selected={form.triggers.includes(NOTHING_UNUSUAL)}
                onToggle={() => set('triggers', form.triggers.includes(NOTHING_UNUSUAL) ? [] : [NOTHING_UNUSUAL])}
              />
            </section>
            {noteOpen || form.note ? (
              <section className="space-y-2">
                <h3 id="note-label" className="text-sm font-medium text-text-primary">Note</h3>
                <textarea
                  aria-labelledby="note-label"
                  // Opened by the link's own tap, so focusing it is what
                  // the user just asked for.
                  autoFocus={!form.note}
                  value={form.note}
                  onChange={(e) => set('note', e.target.value)}
                  placeholder="Anything else worth remembering"
                  rows={3}
                  className="w-full rounded-field bg-bg-raised border border-border-control px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </section>
            ) : (
              <button type="button" onClick={() => setNoteOpen(true)}
                className="tap-44-y text-base font-medium text-accent-light transition-colors hover:text-accent">
                + Add a note
              </button>
            )}
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
          className={`btn-primary btn-cta flex-1 transition-all ${nextDisabled ? '' : 'active:scale-[.99]'}`}
        >
          {step === totalSteps ? 'Save attack' : 'Next'}
        </button>
      </div>

      <DiscardDraftDialog
        open={discardOpen}
        discardLabel="Discard this attack"
        onKeepGoing={() => setDiscardOpen(false)}
        onSave={() => submit(true)}
        onDiscard={onClose}
      />
    </div>
  );
}
