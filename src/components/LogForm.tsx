import { useState, useRef, useEffect } from 'react';
import type { NotificationConfig, Snapshot } from '../types';
import type { TextScale } from '../hooks/useSettings';
import type { VoiceDraft } from '../utils/voiceParse';
import { isoToLocalInput, localInputToIso, formatDatetime } from '../utils/format';
import { openPicker } from '../utils/openPicker';
import { AreaSeverityPicker } from './AreaSeverityPicker';
import { MedicationInput } from './MedicationInput';
import { ChipSelector } from './ChipSelector';
import { NotificationSettings } from './NotificationSettings';
import { TextScaleControl } from './TextScaleControl';

interface Props {
  triggers: string[];
  symptoms: string[];
  reliefs: string[];
  defaultNotifConfig: NotificationConfig;
  recentMeds: Array<{ name: string; dose: string }>;
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
}

type StartMode = 'now' | 'hour_ago' | 'manual';
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
  medication: { name: string; dose: string };
  note: string;
  notifConfig: NotificationConfig;
}

function blank(defaults: NotificationConfig): FormState {
  return {
    startMode: 'now',
    startTime: isoToLocalInput(),
    endMode: 'ongoing',
    endTime: isoToLocalInput(),
    wokeWithMigraine: false,
    areas: {},
    triggers: [],
    symptoms: [],
    reliefs: [],
    medication: { name: '', dose: '' },
    note: '',
    notifConfig: defaults,
  };
}

const START_OPTIONS: { value: StartMode; label: string }[] = [
  { value: 'now',      label: 'Just now' },
  { value: 'hour_ago', label: '1h ago' },
  { value: 'manual',   label: 'Other' },
];

const END_OPTIONS: { value: EndMode; label: string }[] = [
  { value: 'ongoing',  label: 'Still going' },
  { value: 'just_now', label: 'Just now' },
  { value: 'manual',   label: 'Other' },
];

const presetCls = (active: boolean) =>
  `rounded-lg px-4 py-2 text-sm font-medium transition-colors ${active ? 'btn-primary' : 'btn-secondary'}`;

const STEP_LABELS = [
  'When',
  'Pain areas',
  'Medication',
  'Relief methods',
  'Symptoms',
  'Triggers',
  'Note',
  'Reminders',
];

// Sentence-case instruction shown under each step's H2 title.
const STEP_SUBHEADS = [
  'When did your attack start and end?',
  'Select all areas affected and rate severity',
  'Log any medication you took',
  'What helped relieve it?',
  'Select any symptoms you noticed',
  'What may have triggered this?',
  'Anything else worth noting?',
  'Get reminded to check in during your attack',
];

export function LogForm({ triggers, symptoms, reliefs, defaultNotifConfig, recentMeds, textScale, onTextScale, onAddTrigger, onAddSymptom, onAddRelief, onClose, onSave, voiceDraft }: Props) {
  // Step 0 is the voice review screen and exists only for a voice draft; manual
  // logging starts at 1 as it always has.
  const [step, setStep] = useState(voiceDraft ? 0 : 1);
  const [form, setForm] = useState<FormState>(() => {
    const base = blank(defaultNotifConfig);
    if (!voiceDraft) return base;
    // "An hour ago" maps onto the preset that already exists; anything else
    // becomes an explicit time. A start Siri didn't understand leaves the
    // default alone rather than inventing one.
    const mins = voiceDraft.startMinutesAgo;
    const startMode: StartMode = mins === null ? base.startMode : mins === 0 ? 'now' : mins === 60 ? 'hour_ago' : 'manual';
    return {
      ...base,
      startMode,
      startTime: mins === null || mins === 0 || mins === 60
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
    };
  });

  // Open the native date/time picker the instant "Other" is chosen, so the
  // user isn't required to tap the revealed input a second time.
  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (form.startMode === 'manual') openPicker(startInputRef.current);
  }, [form.startMode]);

  useEffect(() => {
    if (form.endMode === 'manual') openPicker(endInputRef.current);
  }, [form.endMode]);

  // Step 8 (Reminders) only shown for ongoing attacks; past attacks go 1→7 then submit
  const totalSteps = form.endMode === 'ongoing' ? 8 : 7;

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
    const now = new Date().toISOString();
    const startTime =
      form.startMode === 'now'       ? now
      : form.startMode === 'hour_ago' ? new Date(Date.now() - 60 * 60 * 1000).toISOString()
      : localInputToIso(form.startTime);
    const endTime =
      form.endMode === 'ongoing'   ? null
      : form.endMode === 'just_now'  ? now
      : localInputToIso(form.endTime);

    onSave(
      {
        time: startTime,
        areas: form.areas,
        symptoms: form.symptoms,
        reliefs: form.reliefs,
        medication: form.medication.name.trim()
          ? { name: form.medication.name.trim(), dose: form.medication.dose }
          : null,
        note: form.note.trim() || null,
      },
      form.triggers,
      form.notifConfig,
      endTime,
      form.wokeWithMigraine,
      // A dose with a time of its own is an event, not an attribute of the
      // attack, so it becomes its own reading. It carries the same pain areas
      // because a snapshot is the full state at that moment — only the
      // medication is new. Clamped to the start, since nothing can be recorded
      // as happening before the attack began.
      (voiceDraft?.doses ?? [])
        .filter((d) => d.minutesAgo !== null)
        .map((d) => {
          const at = new Date(Date.now() - (d.minutesAgo ?? 0) * 60_000).toISOString();
          return {
            time: at < startTime ? startTime : at,
            areas: { ...form.areas },
            symptoms: [],
            reliefs: [],
            medication: { name: d.name, dose: d.dose },
            note: null,
          };
        }),
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
          className="rounded-full p-2 text-text-secondary hover:bg-bg-raised hover:text-text-primary transition-colors"
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
              {step === 0 ? 'Here’s what I heard' : STEP_LABELS[step - 1]}
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
          const startLabel =
            form.startMode === 'now'      ? 'Just now'
            : form.startMode === 'hour_ago' ? '1 hour ago'
            : formatDatetime(localInputToIso(form.startTime));

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
                      {form.wokeWithMigraine ? 'Woke up with it' : `“${voiceDraft.startedText}”`}
                    </p>
                    <p className="text-sm text-text-secondary">
                      Couldn’t pin that to a time — saving now records it as just now. Tap “Make changes” to set it.
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
                  Nothing specific was recognised. What you said is kept as a note — tap
                  “Make changes” to fill in the rest.
                </p>
              )}

              <div className="rounded-xl border border-bg-border bg-bg-raised/50 p-4 space-y-2">
                {/* "What Siri heard", not "what you said" — the quotes are
                    verbatim of the transcript, which is not necessarily
                    verbatim of the user. When a field looks wrong, this is
                    almost always where it went wrong. */}
                <p className="text-xs uppercase tracking-wider text-text-secondary">What Siri heard</p>
                <p className="text-sm italic text-text-secondary">“{voiceDraft.note}”</p>
              </div>
            </div>
          );
        })()}

        {/* ── Step 1: When ── */}
        {step === 1 && (() => {
          const startDisplay =
            form.startMode === 'now'      ? formatDatetime(new Date().toISOString())
            : form.startMode === 'hour_ago' ? formatDatetime(new Date(Date.now() - 3600000).toISOString())
            : form.startTime               ? formatDatetime(localInputToIso(form.startTime))
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
                <div className="space-y-1.5">
                  <p className="text-xs uppercase tracking-wider font-medium text-text-secondary">Time presets</p>
                  <div className="flex flex-wrap gap-2">
                    {START_OPTIONS.map(({ value, label }) => (
                      <button key={value} type="button" onClick={() => set('startMode', value)}
                        aria-pressed={form.startMode === value} className={presetCls(form.startMode === value)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {form.startMode === 'manual' && (
                  <input ref={startInputRef} type="datetime-local" value={form.startTime} max={isoToLocalInput()}
                    onChange={(e) => set('startTime', e.target.value)}
                    className="w-full rounded-lg bg-bg-surface border border-bg-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-subtle" />
                )}
                <button
                  type="button"
                  onClick={() => set('wokeWithMigraine', !form.wokeWithMigraine)}
                  aria-pressed={form.wokeWithMigraine}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${presetCls(form.wokeWithMigraine)}`}
                >
                  🌙 Woke up with this migraine
                </button>
              </div>

              {/* End time card */}
              <div className="rounded-xl border border-bg-border bg-bg-raised p-4 space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-wider font-medium text-text-secondary">End time</p>
                  <p className="mt-1 text-lg font-medium text-text-primary">{endDisplay}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs uppercase tracking-wider font-medium text-text-secondary">Time presets</p>
                  <div className="flex flex-wrap gap-2">
                    {END_OPTIONS.map(({ value, label }) => (
                      <button key={value} type="button" onClick={() => set('endMode', value)}
                        aria-pressed={form.endMode === value} className={presetCls(form.endMode === value)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {form.endMode === 'manual' && (
                  <input ref={endInputRef} type="datetime-local" value={form.endTime} max={isoToLocalInput()}
                    onChange={(e) => set('endTime', e.target.value)}
                    className="w-full rounded-lg bg-bg-surface border border-bg-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-subtle" />
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
        {step === 3 && (
          <MedicationInput value={form.medication} onChange={(v) => set('medication', v)} recentMeds={recentMeds} />
        )}

        {/* ── Step 4: Relief methods ── */}
        {step === 4 && (
          <ChipSelector options={reliefs} selected={form.reliefs}
            onChange={(v) => set('reliefs', v)} onAddCustom={onAddRelief} />
        )}

        {/* ── Step 5: Symptoms ── */}
        {step === 5 && (
          <ChipSelector options={symptoms} selected={form.symptoms}
            onChange={(v) => set('symptoms', v)} onAddCustom={onAddSymptom} />
        )}

        {/* ── Step 6: Triggers ── */}
        {step === 6 && (
          <ChipSelector options={triggers} selected={form.triggers}
            onChange={(v) => set('triggers', v)} onAddCustom={onAddTrigger} />
        )}

        {/* ── Step 7: Note — grows to fill the remaining space, so long entries
            never need to scroll within their own tiny box ── */}
        {step === 7 && (
          <textarea rows={4} value={form.note} placeholder="Anything else worth noting…"
            onChange={(e) => set('note', e.target.value)}
            className="w-full flex-1 min-h-[8rem] rounded-lg bg-bg-raised border border-bg-border px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-border-subtle resize-none" />
        )}

        {/* ── Step 8: Reminders (ongoing only) ── */}
        {step === 8 && (
          <NotificationSettings value={form.notifConfig} onChange={(v) => set('notifConfig', v)} />
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
              className={`flex-1 rounded-xl py-3 text-sm font-medium transition-all ${
                canSaveFromReview
                  ? 'btn-primary active:scale-[.99]'
                  : 'bg-bg-raised text-text-secondary cursor-not-allowed'
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
