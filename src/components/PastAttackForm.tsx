import { useEffect, useRef, useState } from 'react';
import type { Attack, Medication, NotificationConfig, Snapshot } from '../types';
import { PAIN_QUALITY_OPTIONS, NOTHING_UNUSUAL } from '../types';
import type { TextScale } from '../hooks/useSettings';
import { isoToLocalInput, localInputToIso } from '../utils/format';
import { doseEntryMs, followUpApplies, type SelectedMedication } from '../utils/doseEntries';
import { FOLLOW_UP_TARGET_MS } from '../utils/stats';
import { chipClass } from '../utils/chipStyles';
import { AreaSeverityPicker } from './AreaSeverityPicker';
import { MedicationEntry } from './MedicationEntry';
import { ChipSelector } from './ChipSelector';
import { DateTimeField, type DateTimeFieldHandle } from './DateTimeField';
import { TextScaleControl } from './TextScaleControl';
import { SymptomIcon, ReliefIcon, TriggerIcon } from './drawnIcons';
import { SunriseIcon } from './icons';

interface Props {
  symptoms: string[];
  reliefs: string[];
  triggers: string[];
  recentMeds: Array<{ name: string; dose: string }>;
  medications?: Medication[];
  attacks?: Attack[];
  defaultNotifConfig: NotificationConfig;
  textScale: TextScale;
  onTextScale: (s: TextScale) => void;
  onAddSymptom: (s: string) => void;
  onAddRelief: (r: string) => void;
  onAddTrigger: (t: string) => void;
  onClose: () => void;
  onSave: (
    snapshot: Omit<Snapshot, 'source'>,
    triggers: string[],
    notifConfig: NotificationConfig,
    end: string | null,
    wokeWithMigraine: boolean,
    doseReadings: Array<Omit<Snapshot, 'source'>>,
    endUnknown?: boolean,
    painQuality?: string[],
  ) => void;
}

interface FormState {
  startTime: string;
  wokeWithMigraine: boolean;
  endTime: string;
  /** "Woke up without it" — end time left unknown. Only takes effect while
   *  `endTime` itself is blank; filling in a time always means it's known,
   *  the same rule `updateAttackDetails` applies when this attack is edited
   *  later. */
  endUnknownFlag: boolean;
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
    areas: {},
    meds: [],
    painQuality: [],
    symptoms: [],
    reliefs: [],
    triggers: [],
    note: '',
  };
}

const STEP_LABELS = ['When was it?', 'Where does it hurt?', 'Did you take anything?', 'What was it like?', 'Anything else?'];
const STEP_SUBHEADS = [
  'Required: when it started and when it ended.',
  'Tap an area, then rate it. Required. The rest is optional.',
  'Optional · pick any',
  'Optional · pick any',
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
 * "Add a past attack" (v4 redesign) — 5 steps (When → Where → Medication →
 * What it was like → Anything else), matching
 * `docs/redesign-v4/screens/21-past-attack/`. Replaces `LogForm`'s
 * `past={true}` case for **manual** entry — a voice draft still opens
 * `LogForm`, same reasoning as `LiveAttackForm`.
 *
 * Deliberately asks nothing about impact (how much the attack stopped the
 * user) — `docs/redesign-v4-diff.md` A5 holds the line on `impact.ts`'s own
 * recall-bias reasoning, which the board's "How much did it stop you?" step
 * would reopen for an attack that, by construction, is already being logged
 * after the fact. The existing Today prompt already covers a past attack
 * whose end falls inside its own 24h window; one older than that is meant
 * to stay unanswered.
 */
export function PastAttackForm({ symptoms, reliefs, triggers, recentMeds, medications = [], attacks = [], defaultNotifConfig, textScale, onTextScale, onAddSymptom, onAddRelief, onAddTrigger, onClose, onSave }: Props) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(blank);
  const [discardOpen, setDiscardOpen] = useState(false);
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

  function submit() {
    const nowMs = Date.now();
    const resolvedStartMs = new Date(localInputToIso(form.startTime)).getTime();
    const endKnown = form.endTime.trim() !== '';
    const endUnknown = form.endUnknownFlag && !endKnown;
    // While resolving dose/follow-up times, an unknown end is bounded like
    // "ongoing" (null) rather than asserted as a real end. The *stored* end
    // is derived below from whatever times this attack actually ends up
    // with — never "now": for a backfilled attack "now" can be days or
    // weeks after it really ended, which would both wildly overcount
    // ICHD attack-days (attackDayKeys counts every day from start to end)
    // and land inside the Today impact prompt's 24h window, asking about
    // impact for a long-over attack — exactly what this flow exists to not
    // do. Caught in review before this ever reached a phone.
    const boundEndMs = endKnown ? new Date(localInputToIso(form.endTime)).getTime() : null;

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

    onSave(
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
    );
  }

  const peakSeverity = Math.max(0, ...Object.values(form.areas));

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
      <div
        className="relative flex items-center gap-2 px-3.5 pb-0 pt-3.5"
        style={{ paddingTop: 'calc(0.875rem + env(safe-area-inset-top))' }}
      >
        {step > 1 ? (
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
        <span className="flex-1 text-center text-sm font-medium text-text-primary">Step {step} of {totalSteps}</span>
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
            <h1 className="text-[1.625rem] font-semibold leading-tight text-text-primary">{STEP_LABELS[step - 1]}</h1>
            <p className="mt-1.5 text-sm text-text-secondary">{STEP_SUBHEADS[step - 1]}</p>
          </div>
          <div className="shrink-0">
            <TextScaleControl scale={textScale} onScale={onTextScale} />
          </div>
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
              </button>
            </div>
            <div className="border-t border-bg-border pt-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Ended</p>
              <DateTimeField
                label="Attack end"
                value={form.endTime}
                min={form.startTime}
                max={isoToLocalInput()}
                onChange={(v) => set('endTime', v)}
                openRef={endInputRef}
              />
              <button
                type="button"
                onClick={() => {
                  const next = !form.endUnknownFlag;
                  set('endUnknownFlag', next);
                  if (next) set('endTime', '');
                }}
                aria-pressed={form.endUnknownFlag}
                className={`tap-44-y inline-flex items-center gap-1.5 rounded-chip px-3.5 py-2 text-sm font-medium transition-colors ${chipClass(form.endUnknownFlag)}`}
              >
                Woke up without it
              </button>
              {form.endUnknownFlag && !hasEndTime && (
                <p className="text-xs text-text-secondary">Saved as "gone when you woke up." Add a time if you know it.</p>
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
                Felt like <span className="font-normal text-text-secondary">— pick any</span>
              </h3>
              <ChipSelector options={PAIN_QUALITY_OPTIONS} selected={form.painQuality} onChange={(v) => set('painQuality', v)} />
            </section>
            <section className="space-y-2" aria-labelledby="also-had-label">
              <h3 id="also-had-label" className="text-sm font-medium text-text-primary">
                Also had <span className="font-normal text-text-secondary">— pick any</span>
              </h3>
              <ChipSelector options={symptoms} selected={form.symptoms} onChange={(v) => set('symptoms', v)}
                onAddCustom={onAddSymptom} renderIcon={(s) => <SymptomIcon name={s} className="h-4 w-4" />} />
            </section>
            <section className="space-y-2" aria-labelledby="tried-label">
              <h3 id="tried-label" className="text-sm font-medium text-text-primary">
                What did you try? <span className="font-normal text-text-secondary">— pick any</span>
              </h3>
              <ChipSelector options={reliefs} selected={form.reliefs} onChange={(v) => set('reliefs', v)}
                onAddCustom={onAddRelief} renderIcon={(r) => <ReliefIcon name={r} className="h-4 w-4" />} />
            </section>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6">
            <section className="space-y-2" aria-labelledby="two-days-label">
              <h3 id="two-days-label" className="text-sm font-medium text-text-primary">The two days before</h3>
              <ChipSelector
                options={triggers}
                selected={form.triggers.filter((t) => t !== NOTHING_UNUSUAL)}
                onChange={(v) => set('triggers', v)}
                onAddCustom={onAddTrigger}
                renderIcon={(t) => <TriggerIcon name={t} className="h-4 w-4" />}
              />
              <button
                type="button"
                onClick={() => set('triggers', form.triggers.includes(NOTHING_UNUSUAL) ? [] : [NOTHING_UNUSUAL])}
                aria-pressed={form.triggers.includes(NOTHING_UNUSUAL)}
                className={`tap-44-y mt-1 inline-flex items-center gap-1.5 rounded-chip px-3.5 py-2 text-sm font-medium transition-colors ${chipClass(form.triggers.includes(NOTHING_UNUSUAL))}`}
              >
                Nothing unusual
              </button>
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-text-primary">Note</h3>
              <textarea
                value={form.note}
                onChange={(e) => set('note', e.target.value)}
                placeholder="Anything else worth remembering"
                rows={3}
                className="w-full rounded-field bg-bg-raised border border-border-control px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
              />
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
          className={`btn-primary btn-cta flex-1 transition-all ${nextDisabled ? '' : 'active:scale-[.99]'}`}
        >
          {step === totalSteps ? 'Save attack' : 'Next'}
        </button>
      </div>

      <DiscardDialog
        open={discardOpen}
        onKeepGoing={() => setDiscardOpen(false)}
        onSaveAndClose={submit}
        onDiscard={onClose}
      />
    </div>
  );
}

/**
 * The three-way "discard this draft?" choice (`MrgPastStopDark` in the v4
 * boards) — `ConfirmDialog`'s own backdrop/focus/inert handling, since that
 * component only supports a confirm/cancel pair and this needs a third,
 * non-destructive middle action ("Save and close"). Same `fixed inset-0`
 * positioning `ConfirmDialog` itself uses for the same reason: a short-lived
 * alert overlay, never visible across the cold-launch resize that the
 * shell's own `position: fixed` ban is about.
 *
 * **Escape here is not reliable, and neither is `ConfirmDialog`'s own.** The
 * Sheet underneath also listens for Escape on `window` and calls its own
 * `onClose` (closing the whole sheet, discarding the draft) — both listeners
 * fire, in registration order, and nothing here can suppress one already
 * added to the same target before this dialog opened. A keyboard Escape
 * while this is open both "keeps going" *and* closes the sheet, which nets
 * out to the draft being lost regardless. Fixing it needs Sheet itself to
 * know a nested dialog is open, not a fix local to this component — left
 * for when a flow's keyboard behaviour actually matters enough to touch
 * Sheet's own Escape handling. The backdrop click and the explicit "Keep
 * going" button are both unaffected and work correctly.
 */
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
        aria-label="Discard this draft?"
        className="relative w-full max-w-2xl space-y-3 rounded-t-sheet border border-bg-border bg-bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <h2 className="text-lg font-medium text-text-primary">Discard this draft?</h2>
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
            Discard this draft
          </button>
        </div>
      </div>
    </div>
  );
}
