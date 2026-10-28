import { useState, useRef, useEffect } from 'react';
import type { Attack, Medication, NotificationConfig, Snapshot } from '../types';
import type { TextScale } from '../hooks/useSettings';
import type { VoiceDraft } from '../utils/voiceParse';
import { isoToLocalInput, localInputToIso, formatDatetime, formatTime } from '../utils/format';
import { doseAtStart, doseOptions, effectiveDoseMode, resolveDoseMs, type DoseMode } from '../utils/doseTime';
import { FOLLOW_UP_TARGET_MS } from '../utils/stats';
import { sevTextClass } from '../utils/severity';
import { DateTimeField, type DateTimeFieldHandle } from './DateTimeField';
import { AreaSeverityPicker } from './AreaSeverityPicker';
import { MedicationInput } from './MedicationInput';
import { ChipSelector } from './ChipSelector';
import { SymptomIcon, ReliefIcon, TriggerIcon } from './drawnIcons';
import { TextScaleControl } from './TextScaleControl';
import { SunriseIcon } from './icons';
import { RadioDot } from './RadioDot';

interface Props {
  triggers: string[];
  symptoms: string[];
  reliefs: string[];
  defaultNotifConfig: NotificationConfig;
  recentMeds: Array<{ name: string; dose: string }>;
  /** The library and the full history, so the medication step can show where
   *  a dose sits against this drug's own limits. Both optional to the input
   *  itself — a drug with no limits set behaves exactly as it always did. */
  medications?: Medication[];
  attacks?: Attack[];
  textScale: TextScale;
  onTextScale: (s: TextScale) => void;
  onAddTrigger: (t: string) => void;
  onAddSymptom: (s: string) => void;
  onAddRelief: (r: string) => void;
  onClose: () => void;
  onSave: (
    snapshot: Omit<Snapshot, 'source'>,
    triggers: string[],
    notifConfig: NotificationConfig,
    end: string | null,
    wokeWithMigraine: boolean,
    /** Extra readings for doses taken at a stated time before now. */
    doseReadings: Array<Omit<Snapshot, 'source'>>,
  ) => void;
  // Set when this sheet was opened from the "log a migraine" Siri Shortcut —
  // prefills the wizard from the dictated transcript. The user still walks
  // every step to confirm; nothing is auto-submitted.
  voiceDraft?: VoiceDraft | null;
  /** Opened as "Add a past attack" from the + menu: the end starts on "Pick
   *  a time", whose picker opens on mount, instead of "Still going". The same
   *  wizard otherwise — a dedicated past-attack flow is later work. */
  past?: boolean;
}

type StartMode = 'now' | 'min30' | 'hour_ago' | 'hours2' | 'manual';

/** Minutes before now for each relative start preset. */
const START_OFFSET_MIN: Partial<Record<StartMode, number>> = { now: 0, min30: 30, hour_ago: 60, hours2: 120 };
type EndMode = 'ongoing' | 'just_now' | 'manual';

interface FormState {
  startMode: StartMode;
  startTime: string;
  endMode: EndMode;
  endTime: string;
  wokeWithMigraine: boolean;
  areas: Record<string, number>;
  triggers: string[];
  symptoms: string[];
  reliefs: string[];
  medication: { name: string; dose: string; amount?: number };
  /** No step edits this any more (the Note step went on 2026-10-28) — it is
   *  how a voice log's verbatim transcript still reaches the reading. */
  note: string;
  /** Always the saved default: reminders are set in Settings now, not per
   *  attack. Kept in the form so the save signature is unchanged. */
  notifConfig: NotificationConfig;
  doseMode: DoseMode;
  doseTime: string;
  /** Severity about two hours after the dose — past attacks only. `null` is
   *  "not answered", never "no pain". */
  followUp: number | null;
}

function blank(defaults: NotificationConfig, past = false): FormState {
  return {
    startMode: 'now',
    startTime: isoToLocalInput(),
    endMode: past ? 'manual' : 'ongoing',
    endTime: isoToLocalInput(),
    wokeWithMigraine: false,
    areas: {},
    triggers: [],
    symptoms: [],
    reliefs: [],
    medication: { name: '', dose: '' },
    note: '',
    notifConfig: defaults,
    doseMode: 'now',
    doseTime: isoToLocalInput(),
    followUp: null,
  };
}

/** The attack's start as the form currently resolves it, against `nowMs`. */
function startMsAt(f: FormState, nowMs: number): number {
  return f.startMode === 'manual'
    ? new Date(localInputToIso(f.startTime)).getTime()
    : nowMs - (START_OFFSET_MIN[f.startMode] ?? 0) * 60_000;
}

/** Its end — `null` while ongoing. */
function endMsAt(f: FormState, nowMs: number): number | null {
  return f.endMode === 'ongoing' ? null
    : f.endMode === 'just_now' ? nowMs
    : new Date(localInputToIso(f.endTime)).getTime();
}

/** The area the two-hour answer is recorded against: the worst one. The
 *  prompt asks "how bad", singular, and the worst area is what that means —
 *  it is also the figure `followUpReading` compares (`maxSeverity`). Other
 *  areas are left out, which reads as *not recorded*: they weren't asked. */
function peakArea(areas: Record<string, number>): string | null {
  let best: string | null = null;
  for (const [k, v] of Object.entries(areas)) if (best === null || v > areas[best]) best = k;
  return best;
}

/**
 * Whether the "…and about 2 hours after?" prompt applies: a past attack, a
 * dose, and a two-hour mark that lands before the attack ended. Without a
 * real window there is nothing honest to ask, so it is skipped silently.
 */
function followUpWindow(f: FormState, nowMs: number): { doseMs: number; atMs: number } | null {
  const endMs = endMsAt(f, nowMs);
  if (endMs === null || !f.medication.name.trim()) return null;
  const startMs = startMsAt(f, nowMs);
  const mode = effectiveDoseMode(f.doseMode, doseOptions(startMs, endMs, nowMs));
  const doseMs = resolveDoseMs(mode, localInputToIso(f.doseTime), startMs, endMs, nowMs);
  const atMs = doseMs + FOLLOW_UP_TARGET_MS;
  return atMs < endMs ? { doseMs, atMs } : null;
}

const START_OPTIONS: { value: StartMode; label: string }[] = [
  { value: 'now',      label: 'Just now' },
  { value: 'min30',    label: '30 min ago' },
  { value: 'hour_ago', label: '1h ago' },
  { value: 'hours2',   label: '2h ago' },
  { value: 'manual',   label: 'Pick a time' },
];

const END_OPTIONS: { value: EndMode; label: string }[] = [
  { value: 'ongoing',  label: 'Still going' },
  { value: 'just_now', label: 'Just now' },
  { value: 'manual',   label: 'Pick a time' },
];

// A *selected* preset, not an action — so it takes the tint-and-ring treatment
// `ChipSelector`, `MedicationInput` and `EndAttackDialog`'s impact pills all
// use, never `btn-primary`. Solid accent is the app's "this is the thing to
// press to move forward" signal; on a chosen option it says the same thing
// about a state, which is why a screen of these read as a wall of buttons
// competing with the actual Next. It also made the *same* dialog show two
// styles for one idea: End-attack's time presets were solid while its impact
// pills were tinted.
// **Both states are ring-based, and must stay that way.** `ring` is a
// box-shadow and takes no layout space; a `border` does. (`btn-secondary`
// used to be the counter-example here and was the same bug — it is a ring
// too as of 2026-08-19.)
// Mixing them made an unselected preset 2px taller than a selected one, which
// is invisible in a flex row (siblings stretch to the tallest) and obvious on
// a preset that sits alone on its own line — "Woke up with this migraine"
// grew and shrank as you toggled it. Any new state added here needs a ring,
// not a border.
const presetCls = (active: boolean) =>
  `rounded-lg px-4 py-2 text-sm font-medium transition-colors ring-1 ring-inset ${
    active
      ? 'bg-accent/20 text-accent-light ring-accent/50'
      : 'bg-bg-raised text-text-primary ring-border-control hover:bg-bg-border'
  }`;

// **A flat five, for every attack** (2026-10-28, Flow 1). Relief methods
// folded into Symptoms as "Anything else"; Note and Reminders went — Note
// because it went unused, Reminders to Settings, where the default it always
// was is now set once. Old notes still render on `AttackDetail`.
const STEP_LABELS = [
  'When',
  'Pain areas',
  'Medication',
  'Anything else',
  'Triggers',
];

// Sentence-case instruction shown under each step's H2 title.
//
// **One register, not two** (settled 2026-08-19). §9.5 asks for simpler copy
// the deeper into an attack someone is, and the obvious reading of that is an
// attack-mode variant of every string — but a second register is a permanent
// tax (every string added later needs both, or silently falls back to the
// dense one) and nobody wants the denser sentence on a good day either. So
// these are written plainly for everyone.
//
// Plain here means: ask a question rather than issue an instruction, use the
// words someone would say out loud, and keep it to one clause. "Select all
// areas affected and rate severity" is not hard to understand on a good day —
// it is hard to *act on* while the thing it describes is happening.
const STEP_SUBHEADS = [
  'When did it start, and has it ended?',
  'Tap where it hurts, then set how bad',
  'Did you take anything for it?',
  'What else is going on?',
  'Anything that might have set it off?',
];

export function LogForm({ triggers, symptoms, reliefs, defaultNotifConfig, recentMeds, medications, attacks, textScale, onTextScale, onAddTrigger, onAddSymptom, onAddRelief, onClose, onSave, voiceDraft, past = false }: Props) {
  // Step 0 is the voice review screen and exists only for a voice draft; manual
  // logging starts at 1 as it always has.
  const [step, setStep] = useState(voiceDraft ? 0 : 1);
  const [form, setForm] = useState<FormState>(() => {
    const base = blank(defaultNotifConfig, past);
    if (!voiceDraft) return base;
    // "An hour ago" maps onto the preset that already exists; anything else
    // becomes an explicit time. A start Siri didn't understand leaves the
    // default alone rather than inventing one.
    const mins = voiceDraft.startMinutesAgo;
    const preset = mins === null
      ? undefined
      : START_OPTIONS.find((o) => START_OFFSET_MIN[o.value] === mins)?.value;
    const startMode: StartMode = mins === null ? base.startMode : preset ?? 'manual';
    return {
      ...base,
      startMode,
      startTime: mins === null || preset
        ? base.startTime
        : isoToLocalInput(new Date(Date.now() - mins * 60_000).toISOString()),
      wokeWithMigraine: voiceDraft.wokeWithMigraine,
      areas: voiceDraft.areas,
      symptoms: voiceDraft.symptoms,
      reliefs: voiceDraft.reliefs,
      triggers: voiceDraft.triggers,
      // A dose with a time of its own becomes a separate reading, so it must
      // not also sit on this one — that would record the same tablets twice.
      // Only a dose with no stated time belongs here.
      medication: voiceDraft.doses.some((d) => d.minutesAgo !== null)
        ? (voiceDraft.doses.find((d) => d.minutesAgo === null) ?? base.medication)
        : (voiceDraft.medication ?? base.medication),
      note: voiceDraft.note,
      // An untimed spoken dose stays on the first reading, as it always has.
      doseMode: 'start',
    };
  });

  // The moment the sheet opened, for anything the steps *display* relative to
  // now — read once here rather than with `Date.now()` during render. The
  // save itself reads the real clock.
  const [openedAt] = useState(() => Date.now());

  // Open the native picker the instant "Pick a time" is chosen, so the user isn't
  // required to tap the revealed field a second time. **It opens the time
  // half**, not the date: the day is nearly always the one already shown, and
  // the time is what "Pick a time" is reached for. The date sits beside it.
  const startInputRef = useRef<DateTimeFieldHandle>(null);
  const endInputRef = useRef<DateTimeFieldHandle>(null);

  useEffect(() => {
    if (form.startMode === 'manual') startInputRef.current?.open();
  }, [form.startMode]);

  useEffect(() => {
    if (form.endMode === 'manual') endInputRef.current?.open();
  }, [form.endMode]);

  const totalSteps = STEP_LABELS.length;


  // Next is disabled only when mandatory fields are missing
  const nextDisabled = step === 2 && Object.keys(form.areas).length === 0;

  // Pain areas are the only required input, so once they're set the log is
  // complete — every later step is optional enrichment the user may skip.
  //
  // A voice draft fills them before the user reaches step 2, which is the whole
  // point of logging by voice: the attack is already described, and making
  // someone tap through eight screens to commit it defeats it. So the shortcut
  // is offered from step 1 in that case — but only when a severity was actually
  // heard. A defaulted one must be looked at before it can be saved in a tap,
  // or voice logging would quietly fill the record with 5s nobody said.
  //
  // Step 0 is excluded because the review screen carries its own pair of
  // buttons; a second "Finish now" in the app bar would just be a duplicate.
  //
  // Shown from step 1 onward and *disabled* until it can be used, rather than
  // appearing once the requirement happens to be met. A control that
  // materialises out of nowhere gives no hint it exists, so nobody looks for
  // it; one that is visibly greyed out says both that the shortcut is there
  // and that something is still missing. Same call as the voice review
  // screen's disabled save, for the same reason.
  const areasFilled = Object.keys(form.areas).length > 0;
  const severityConfirmed = step >= 2 || (voiceDraft?.severityHeard ?? false);
  const showFinishEarly = step > 0 && step < totalSteps;
  const canFinishEarly = areasFilled && severityConfirmed;

  // The review screen's save. Pain areas are still the one requirement, and a
  // severity nobody said is treated as missing rather than as a value.
  const canSaveFromReview = areasFilled && (voiceDraft?.severityHeard ?? false);

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function goNext() {
    if (nextDisabled) return;
    if (step < totalSteps) {
      setStep((s) => s + 1);
    } else {
      submit();
    }
  }

  function goBack() {
    setStep((s) => s - 1);
  }

  function submit() {
    const nowMs = Date.now();
    const startMs = startMsAt(form, nowMs);
    const endMs = endMsAt(form, nowMs);
    const startTime = new Date(startMs).toISOString();
    const endTime = endMs === null ? null : new Date(endMs).toISOString();

    const med = form.medication.name.trim()
      ? {
          name: form.medication.name.trim(),
          dose: form.medication.dose,
          // Units, when the quick-pick was used. Absent otherwise, which
          // medGuardrails reads as one — never as zero.
          ...(form.medication.amount ? { amount: form.medication.amount } : {}),
        }
      : null;

    // **A dose's time is the time of the reading it sits on** — nothing on
    // `Snapshot.medication` says otherwise, and `medCheckInDelay`,
    // `checkDose` and `followUpReading` all read it from there. So a dose
    // taken at the start stays on the first reading, and one taken at any
    // other moment becomes its own reading at that moment, carrying the same
    // pain areas (a snapshot is the full state). Never both: the same tablets
    // would count twice.
    const doseMode = effectiveDoseMode(form.doseMode, doseOptions(startMs, endMs, nowMs));
    const doseMs = resolveDoseMs(doseMode, localInputToIso(form.doseTime), startMs, endMs, nowMs);
    const onFirst = !med || doseAtStart(doseMs, startMs);

    const typedDose: Array<Omit<Snapshot, 'source'>> = med && !onFirst
      ? [{ time: new Date(doseMs).toISOString(), areas: { ...form.areas }, symptoms: [], reliefs: [], medication: med, note: null }]
      : [];

    // The backfilled two-hour reading. It is an ordinary reading at dose + 2h
    // carrying only the answered severity — exactly what a live attack's
    // follow-up is — so `followUpReading`/`doseHelped` score it with no
    // special case, and there is no separate "helped" field to drift from them.
    const fw = followUpWindow(form, nowMs);
    const area = peakArea(form.areas);
    const followUp: Array<Omit<Snapshot, 'source'>> = fw && form.followUp !== null && area
      ? [{ time: new Date(fw.atMs).toISOString(), areas: { [area]: form.followUp }, symptoms: [], reliefs: [], medication: null, note: null }]
      : [];

    onSave(
      {
        time: startTime,
        areas: form.areas,
        symptoms: form.symptoms,
        reliefs: form.reliefs,
        medication: onFirst ? med : null,
        note: form.note.trim() || null,
      },
      form.triggers,
      form.notifConfig,
      endTime,
      form.wokeWithMigraine,
      [
        ...typedDose,
        ...followUp,
        // A dose with a time of its own is an event, not an attribute of the
        // attack, so it becomes its own reading. It carries the same pain
        // areas because a snapshot is the full state at that moment — only the
        // medication is new. Clamped to the start, since nothing can be
        // recorded as happening before the attack began.
        ...(voiceDraft?.doses ?? [])
          .filter((d) => d.minutesAgo !== null)
          .map((d) => {
            const at = new Date(nowMs - (d.minutesAgo ?? 0) * 60_000).toISOString();
            return {
              time: at < startTime ? startTime : at,
              areas: { ...form.areas },
              symptoms: [],
              reliefs: [],
              // The quantity was already parsed out of the transcript ("two
              // tablets of Treo") and flattened into `dose`; keeping the
              // number means a spoken dose counts as two units, not one.
              medication: { name: d.name, dose: d.dose, ...(d.amount ? { amount: d.amount } : {}) },
              note: null,
            };
          }),
      ],
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 mx-auto w-full max-w-2xl">
      {/* Top app bar — close (left), step count (center), Finish now (right).
          Finish appears once pain areas are set, since every later step is
          optional enrichment. */}
      <div
        className="relative flex items-center border-b border-border-subtle px-3 py-3 sm:px-4"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="tap-44 rounded-full p-2 text-text-secondary hover:bg-bg-raised hover:text-text-primary transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-base font-medium tabular-nums text-text-primary">
          {step === 0 ? 'From your voice note' : `${step} / ${totalSteps}`}
        </span>

        <div className="ml-auto flex items-center">
          {showFinishEarly && (
            <button
              type="button"
              onClick={submit}
              disabled={!canFinishEarly}
              // Says why, for a control whose disabled state is otherwise a
              // dead end — the required step is the one it points at.
              title={canFinishEarly ? undefined : 'Select a pain area first'}
              className={`px-2 py-1 text-sm font-medium transition-colors ${
                canFinishEarly
                  ? 'text-accent-light hover:text-accent'
                  : 'text-text-secondary/50 cursor-not-allowed'
              }`}
            >
              Finish now
            </button>
          )}
        </div>
      </div>

      {/* Step content — the only scrolling region */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pt-5 pb-4 flex flex-col">

        {/* Section header — H2 title + instruction, with the text-size stepper
            pinned to its right. */}
        <div className="mb-5 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-xl font-medium text-text-primary">
              {step === 0 ? "Here's what I heard" : STEP_LABELS[step - 1]}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {step === 0 ? 'Check it over before saving.' : STEP_SUBHEADS[step - 1]}
              {step === 2 && <span className="text-severity-high ml-0.5">*</span>}
            </p>
          </div>
          <div className="shrink-0">
            <TextScaleControl scale={textScale} onScale={onTextScale} />
          </div>
        </div>

        {/* ── Step 0: voice review (voice drafts only) ──
            A whole screen rather than the banner this used to be: squeezed in
            above the start/end cards, the one thing the user needs to check was
            the smallest thing on the page. */}
        {step === 0 && voiceDraft && (() => {
          const areaNames = Object.keys(form.areas);
          const startLabel = form.startMode === 'manual'
            ? formatDatetime(localInputToIso(form.startTime))
            : START_OPTIONS.find((o) => o.value === form.startMode)?.label;

          return (
            <div className="space-y-3">
              {areaNames.length > 0 && (
                <div className="rounded-xl border border-bg-border bg-bg-raised p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wider text-text-secondary">Pain areas</p>
                  <ul className="space-y-1.5">
                    {/* Per area, not off the single all-areas flag: a
                        transcript that states three severities and omits one
                        is the normal case, and driving every row off the
                        global flag told the user their own spoken number
                        wasn't heard — with the quote right underneath
                        showing that it was. */}
                    {areaNames.map((name) => (
                      <li key={name} className="flex items-baseline justify-between gap-3">
                        <span className="text-base text-text-primary">{name}</span>
                        {voiceDraft.severityHeardFor[name] ? (
                          <span className="text-base font-medium tabular-nums text-text-primary">{form.areas[name]}</span>
                        ) : (
                          // The reason the save button is disabled, said where
                          // the user is looking rather than left to be deduced.
                          <span className="text-sm font-medium text-severity-high">
                            no severity heard
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {!voiceDraft.severityHeard && (
                    <p className="pt-1 text-sm text-severity-high">
                      Add how bad it is to save — everything else is optional.
                    </p>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-bg-border bg-bg-raised p-4 space-y-2">
                <p className="text-xs uppercase tracking-wider text-text-secondary">Started</p>
                {/* "I woke up with it" answers *whether* but not *when*, and
                    the form's untouched default is "Just now" — which would
                    claim a start time nobody gave, the same way a defaulted
                    severity used to read as a spoken one. Say what is known. */}
                {voiceDraft.startMinutesAgo === null && (form.wokeWithMigraine || voiceDraft.startedText) ? (
                  <>
                    <p className="text-base text-text-primary">
                      {form.wokeWithMigraine ? 'Woke up with it' : `"${voiceDraft.startedText}"`}
                    </p>
                    <p className="text-sm text-text-secondary">
                      Couldn't pin that to a time — saving now records it as just now. Tap "Make changes" to set it.
                    </p>
                  </>
                ) : (
                  <p className="text-base text-text-primary">
                    {startLabel}
                    {form.wokeWithMigraine && ' · woke up with it'}
                  </p>
                )}
              </div>

              {/* Each dose with a time of its own is listed separately, because
                  each becomes its own reading on the attack's timeline. */}
              {voiceDraft.doses.length > 0 && (
                <div className="rounded-xl border border-bg-border bg-bg-raised p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wider text-text-secondary">Medication</p>
                  <ul className="space-y-1.5">
                    {voiceDraft.doses.map((d, i) => (
                      <li key={`${d.name}-${i}`} className="flex items-baseline justify-between gap-3">
                        <span className="text-base text-text-primary">
                          {d.name || 'Unnamed'}{d.dose ? ` · ${d.dose}` : ''}
                        </span>
                        <span className="text-sm text-text-secondary">
                          {d.minutesAgo === null
                            ? 'no time given'
                            : formatDatetime(new Date(Date.now() - d.minutesAgo * 60_000).toISOString())}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {voiceDraft.doses.some((d) => d.minutesAgo !== null) && (
                    <p className="pt-1 text-sm text-text-secondary">
                      Each dose with a time is saved as its own entry on the timeline.
                    </p>
                  )}
                </div>
              )}

              {[
                ['Medication', voiceDraft.doses.length === 0 && form.medication.name ? `${form.medication.name}${form.medication.dose ? ` · ${form.medication.dose}` : ''}` : ''],
                ['Relief methods', form.reliefs.join(', ')],
                ['Symptoms', form.symptoms.join(', ')],
                ['Triggers', form.triggers.join(', ')],
              ].filter(([, value]) => value).map(([label, value]) => (
                <div key={label} className="rounded-xl border border-bg-border bg-bg-raised p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wider text-text-secondary">{label}</p>
                  <p className="text-base text-text-primary">{value}</p>
                </div>
              ))}

              {areaNames.length === 0 && (
                <p className="text-sm text-text-secondary">
                  Nothing specific was recognised — what you said is kept as a note.
                  Tap "Make changes" to fill in the rest.
                </p>
              )}

              <div className="rounded-xl border border-bg-border bg-bg-raised/50 p-4 space-y-2">
                {/* "What Siri heard", not "what you said" — the quotes are
                    verbatim of the transcript, which is not necessarily
                    verbatim of the user. When a field looks wrong, this is
                    almost always where it went wrong. */}
                <p className="text-xs uppercase tracking-wider text-text-secondary">What Siri heard</p>
                <p className="text-sm italic text-text-secondary">"{voiceDraft.note}"</p>
              </div>
            </div>
          );
        })()}

        {/* ── Step 1: When ── */}
        {step === 1 && (() => {
          const startDisplay = form.startMode !== 'manual'
            ? formatDatetime(new Date(openedAt - (START_OFFSET_MIN[form.startMode] ?? 0) * 60_000).toISOString())
            : form.startTime ? formatDatetime(localInputToIso(form.startTime))
            : 'Pick a time';
          const endDisplay =
            form.endMode === 'ongoing'   ? 'Still going'
            : form.endMode === 'just_now'  ? formatDatetime(new Date().toISOString())
            : form.endTime               ? formatDatetime(localInputToIso(form.endTime))
            : 'Pick a time';

          return (
            <div className="space-y-4">
              {/* Start time card */}
              <div className="rounded-xl border border-bg-border bg-bg-raised p-4 space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-wider font-medium text-text-secondary">Start time</p>
                  <p className="mt-1 text-lg font-medium text-text-primary">{startDisplay}</p>
                </div>
                <PresetRadios
                  label="Start time presets"
                  options={START_OPTIONS}
                  value={form.startMode}
                  onChange={(v) => set('startMode', v)}
                />
                {form.startMode === 'manual' && (
                  <DateTimeField
                    label="Attack start time"
                    value={form.startTime}
                    max={isoToLocalInput()}
                    onChange={(v) => set('startTime', v)}
                    surface="raised"
                    openRef={startInputRef}
                  />
                )}
                <button
                  type="button"
                  onClick={() => set('wokeWithMigraine', !form.wokeWithMigraine)}
                  aria-pressed={form.wokeWithMigraine}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${presetCls(form.wokeWithMigraine)}`}
                >
                  {/* Drawn icon in currentColor, not 🌙 or 🌅 — see
                      SunriseIcon. It matters more here than on the card: this
                      is a toggle, so the glyph inherits the pressed state's
                      text colour and an emoji would have stayed the same
                      colour in both states. */}
                  <SunriseIcon className="h-4 w-4" />
                  Woke up with this migraine
                </button>
              </div>

              {/* End time card */}
              <div className="rounded-xl border border-bg-border bg-bg-raised p-4 space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-wider font-medium text-text-secondary">End time</p>
                  <p className="mt-1 text-lg font-medium text-text-primary">{endDisplay}</p>
                </div>
                <PresetRadios
                  label="End time presets"
                  options={END_OPTIONS}
                  value={form.endMode}
                  onChange={(v) => set('endMode', v)}
                />
                {form.endMode === 'manual' && (
                  <DateTimeField
                    label="Attack end time"
                    value={form.endTime}
                    max={isoToLocalInput()}
                    onChange={(v) => set('endTime', v)}
                    surface="raised"
                    openRef={endInputRef}
                  />
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Step 2: Pain areas ── */}
        {step === 2 && (
          <AreaSeverityPicker value={form.areas} onChange={(v) => set('areas', v)} />
        )}

        {/* ── Step 3: Medication ── */}
        {step === 3 && (() => {
          const startMs = startMsAt(form, openedAt);
          const endMs = endMsAt(form, openedAt);
          const options = doseOptions(startMs, endMs, openedAt);
          const doseMs = resolveDoseMs(
            effectiveDoseMode(form.doseMode, options), localInputToIso(form.doseTime), startMs, endMs, openedAt,
          );
          const fw = followUpWindow(form, openedAt);
          return (
            <div className="space-y-4">
              <MedicationInput
                value={form.medication}
                onChange={(v) => set('medication', v)}
                recentMeds={recentMeds}
                medications={medications}
                attacks={attacks}
                // The limits are checked at the dose's own time — a backfilled
                // dose counts in *its* 24 hours, not today's.
                atIso={form.medication.name ? new Date(doseMs).toISOString() : undefined}
                doseTiming={{
                  mode: form.doseMode,
                  time: form.doseTime,
                  // "Pick a time" opens on the attack's start, the earliest a
                  // dose may be, unless a time was already picked.
                  onMode: (m) => setForm((f) => ({
                    ...f,
                    doseMode: m,
                    doseTime: m === 'manual' && f.doseMode !== 'manual'
                      ? isoToLocalInput(new Date(startMs).toISOString())
                      : f.doseTime,
                  })),
                  onTime: (t) => set('doseTime', t),
                  startMs,
                  endMs,
                  nowMs: openedAt,
                }}
              />
              {fw && (
                <FollowUpPrompt
                  at={new Date(fw.atMs).toISOString()}
                  value={form.followUp}
                  start={Math.max(0, ...Object.values(form.areas))}
                  onChange={(v) => set('followUp', v)}
                />
              )}
            </div>
          );
        })()}

        {/* ── Step 4: Anything else — symptoms and relief methods together ──
            They were two steps; on their own each was a short screen of chips,
            and the wizard was long enough that "veeeery busy" was the review.
            Both are pick-any, so they keep `ChipSelector` and its checkmarks. */}
        {step === 4 && (
          <div className="space-y-6">
            <section className="space-y-2" aria-labelledby="symptoms-label">
              <h3 id="symptoms-label" className="text-sm font-medium text-text-primary">
                Symptoms <span className="font-normal text-text-secondary">— pick any</span>
              </h3>
              <ChipSelector options={symptoms} selected={form.symptoms}
                onChange={(v) => set('symptoms', v)} onAddCustom={onAddSymptom}
                renderIcon={(s) => <SymptomIcon name={s} className="h-4 w-4" />} />
            </section>
            <section className="space-y-2" aria-labelledby="reliefs-label">
              <h3 id="reliefs-label" className="text-sm font-medium text-text-primary">
                Relief methods <span className="font-normal text-text-secondary">— pick any</span>
              </h3>
              <ChipSelector options={reliefs} selected={form.reliefs}
                onChange={(v) => set('reliefs', v)} onAddCustom={onAddRelief}
                renderIcon={(r) => <ReliefIcon name={r} className="h-4 w-4" />} />
            </section>
          </div>
        )}

        {/* ── Step 5: Triggers ── */}
        {step === 5 && (
          <ChipSelector options={triggers} selected={form.triggers}
            onChange={(v) => set('triggers', v)} onAddCustom={onAddTrigger}
            renderIcon={(t) => <TriggerIcon name={t} className="h-4 w-4" />} />
        )}

      </div>

      {/* Navigation — flex-pinned to the bottom (above the home indicator) */}
      <div
        className="flex gap-3 border-t border-bg-border bg-bg-surface px-4 sm:px-6 py-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        {step === 0 ? (
          <>
            <button type="button" onClick={() => setStep(1)}
              className="btn-secondary flex-1 rounded-xl py-3 text-sm font-medium transition-colors">
              Make changes
            </button>
            {/* Shown even when it can't be used. Hiding it would leave the user
                hunting for the way out at exactly the wrong moment; disabled,
                with the missing severity called out above, says why. */}
            <button
              type="button"
              onClick={submit}
              disabled={!canSaveFromReview}
              // Always `btn-primary`: its `:disabled` rule *is* the muted
              // treatment, so spelling it out by hand here only risked drifting
              // from it — which it had, ending up indistinguishable from the
              // secondary button beside it.
              className={`btn-primary flex-1 transition-all ${
                canSaveFromReview ? 'active:scale-[.99]' : ''
              }`}
            >
              Finish now
            </button>
          </>
        ) : (
          <>
            {(step > 1 || voiceDraft) && (
              <button type="button" onClick={goBack}
                className="btn-secondary flex-1 rounded-xl py-3 text-sm font-medium transition-colors">
                Back
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              disabled={nextDisabled}
              className={`flex-1 rounded-xl py-3 text-sm font-medium transition-all ${
                nextDisabled
                  ? 'bg-bg-raised text-text-secondary cursor-not-allowed'
                  : 'btn-primary active:scale-[.99]'
              }`}
            >
              {step === totalSteps ? 'Log attack' : 'Next'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * A single-choice preset row — `role="radiogroup"` with a `RadioDot` per chip
 * (2026-10-28). These used to be `aria-pressed` toggles, which is the
 * multi-select pattern: a screen reader heard "toggle button, pressed" on
 * every chip and nothing said only one could be on. The visible label stays
 * the "Time presets" kicker; the group's accessible name says which.
 */
function PresetRadios<T extends string>({ label, options, value, onChange }: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs uppercase tracking-wider font-medium text-text-secondary" aria-hidden="true">Time presets</p>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 ${presetCls(value === o.value)}`}
          >
            <RadioDot selected={value === o.value} />
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * "…and about 2 hours after?" — a past attack's stand-in for the live
 * two-hour check-in (2026-10-28). Optional, and added rather than shown with a
 * value: a slider always has one, and an untouched default would read as an
 * answer. Its slider is the pain-area picker's, with 0 allowed — pain gone at
 * two hours is the endpoint that matters most. The answer is saved as an
 * ordinary reading at that time; see `submit`.
 */
function FollowUpPrompt({ at, value, start, onChange }: {
  at: string;
  value: number | null;
  /** Where the slider starts when the question is opened: the reading's own
   *  worst, so the first move is relative to something real. */
  start: number;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="rounded-xl border border-bg-border bg-bg-raised p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-text-primary">…and about 2 hours after?</p>
        <p className="text-xs text-text-secondary">Around {formatTime(at)}. Optional.</p>
      </div>
      {value === null ? (
        <button type="button" onClick={() => onChange(start)} className="btn-secondary btn-compact">
          Add how bad it was
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">How bad</span>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold tabular-nums ${sevTextClass(value)}`}>{value}</span>
              <button type="button" onClick={() => onChange(null)}
                className="text-text-secondary hover:text-text-primary transition-colors"
                aria-label="Remove the 2-hour reading">
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4"
                  stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <line x1="4" y1="4" x2="12" y2="12"/>
                  <line x1="12" y1="4" x2="4" y2="12"/>
                </svg>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-7">None</span>
            <input type="range" min={0} max={10} step={1} value={value}
              aria-label="Severity about 2 hours after the dose"
              onChange={(e) => onChange(Number(e.target.value))}
              className="flex-1"/>
            <span className="text-xs text-text-secondary w-12 text-right">Severe</span>
          </div>
        </div>
      )}
    </div>
  );
}
