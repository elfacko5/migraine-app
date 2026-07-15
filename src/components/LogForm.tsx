import { useState, useRef, useEffect } from 'react';
import type { NotificationConfig, Snapshot } from '../types';
import type { TextScale } from '../hooks/useSettings';
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
  ) => void;
}

type StartMode = 'now' | 'hour_ago' | 'manual';
type EndMode = 'ongoing' | 'just_now' | 'manual';

interface FormState {
  startMode: StartMode;
  startTime: string;
  endMode: EndMode;
  endTime: string;
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

export function LogForm({ triggers, symptoms, reliefs, defaultNotifConfig, recentMeds, textScale, onTextScale, onAddTrigger, onAddSymptom, onAddRelief, onClose, onSave }: Props) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(() => blank(defaultNotifConfig));

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
  const canFinishEarly = step >= 2 && step < totalSteps && Object.keys(form.areas).length > 0;

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

        <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-base font-semibold tabular-nums text-text-primary">
          {step} / {totalSteps}
        </span>

        <div className="ml-auto flex items-center">
          {canFinishEarly && (
            <button type="button" onClick={submit}
              className="px-2 py-1 text-sm font-medium text-accent-light hover:text-accent transition-colors">
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
            <h2 className="text-xl font-semibold text-text-primary">{STEP_LABELS[step - 1]}</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {STEP_SUBHEADS[step - 1]}
              {step === 2 && <span className="text-severity-high ml-0.5">*</span>}
            </p>
          </div>
          <div className="shrink-0">
            <TextScaleControl scale={textScale} onScale={onTextScale} />
          </div>
        </div>

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
        {step > 1 && (
          <button type="button" onClick={goBack}
            className="btn-secondary flex-1 rounded-xl py-3 text-sm font-medium transition-colors">
            Back
          </button>
        )}
        <button
          type="button"
          onClick={goNext}
          disabled={nextDisabled}
          className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-all ${
            nextDisabled
              ? 'bg-bg-raised text-text-secondary cursor-not-allowed'
              : 'btn-primary active:scale-[.99]'
          }`}
        >
          {step === totalSteps ? 'Log attack' : 'Next'}
        </button>
      </div>
    </div>
  );
}
