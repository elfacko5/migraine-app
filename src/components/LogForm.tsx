import { useState } from 'react';
import type { NotificationConfig, Snapshot } from '../types';
import { isoToLocalInput, localInputToIso } from '../utils/format';
import { AreaSeverityPicker } from './AreaSeverityPicker';
import { ListSelector } from './ListSelector';
import { MedicationInput } from './MedicationInput';
import { ChipSelector } from './ChipSelector';
import { NotificationSettings } from './NotificationSettings';

interface Props {
  triggers: string[];
  symptoms: string[];
  reliefs: string[];
  defaultNotifConfig: NotificationConfig;
  recentMeds: Array<{ name: string; dose: string }>;
  onAddTrigger: (t: string) => void;
  onAddSymptom: (s: string) => void;
  onAddRelief: (r: string) => void;
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
  { value: 'hour_ago', label: '1 hour ago' },
  { value: 'manual',   label: 'Specific time' },
];

const END_OPTIONS: { value: EndMode; label: string }[] = [
  { value: 'ongoing',  label: 'Still going' },
  { value: 'just_now', label: 'Just now' },
  { value: 'manual',   label: 'Specific time' },
];

const STEP_LABELS = [
  'When',
  'Pain areas',
  'Symptoms',
  'Triggers',
  'Treatment & reliefs',
  'Reminders',
];

export function LogForm({ triggers, symptoms, reliefs, defaultNotifConfig, recentMeds, onAddTrigger, onAddSymptom, onAddRelief, onSave }: Props) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(() => blank(defaultNotifConfig));

  // Step 6 (Reminders) only shown for ongoing attacks; past attacks go 1→5 then submit
  const totalSteps = form.endMode === 'ongoing' ? 6 : 5;

  // Next is disabled only when mandatory fields are missing
  const nextDisabled = step === 2 && Object.keys(form.areas).length === 0;

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
    <div className="flex flex-col min-h-full">
      {/* Progress */}
      <div className="mb-6 space-y-1.5">
        <div className="flex justify-between text-xs text-text-secondary">
          <span className="font-medium text-text-primary">{STEP_LABELS[step - 1]}</span>
          <span>{step} / {totalSteps}</span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < step ? 'bg-accent' : 'bg-bg-raised'}`} />
          ))}
        </div>
      </div>

      {/* Step content — padded at bottom so content clears sticky nav */}
      <div className="flex-1 pb-4">

        {/* ── Step 1: When ── */}
        {step === 1 && (
          <div className="space-y-6">
            <section className="space-y-2">
              <Label>When did it start?</Label>
              <div className="flex flex-wrap gap-2">
                {START_OPTIONS.map(({ value, label }) => (
                  <button key={value} type="button" onClick={() => set('startMode', value)}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${form.startMode === value ? 'bg-accent text-bg-base' : 'bg-bg-raised text-text-primary hover:bg-bg-border'}`}>
                    {label}
                  </button>
                ))}
              </div>
              {form.startMode === 'manual' && (
                <input type="datetime-local" value={form.startTime} max={isoToLocalInput()}
                  onChange={(e) => set('startTime', e.target.value)}
                  className="w-full rounded-lg bg-bg-raised border border-bg-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent" />
              )}
            </section>

            <section className="space-y-2">
              <Label>When did it end?</Label>
              <div className="flex flex-wrap gap-2">
                {END_OPTIONS.map(({ value, label }) => (
                  <button key={value} type="button" onClick={() => set('endMode', value)}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${form.endMode === value ? 'bg-accent text-bg-base' : 'bg-bg-raised text-text-primary hover:bg-bg-border'}`}>
                    {label}
                  </button>
                ))}
              </div>
              {form.endMode === 'manual' && (
                <input type="datetime-local" value={form.endTime} max={isoToLocalInput()}
                  onChange={(e) => set('endTime', e.target.value)}
                  className="w-full rounded-lg bg-bg-raised border border-bg-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent" />
              )}
            </section>
          </div>
        )}

        {/* ── Step 2: Pain areas ── */}
        {step === 2 && (
          <section className="space-y-3">
            <Label required>Select all areas affected and rate severity</Label>
            <AreaSeverityPicker value={form.areas} onChange={(v) => set('areas', v)} />
          </section>
        )}

        {/* ── Step 3: Symptoms ── */}
        {step === 3 && (
          <section className="space-y-3">
            <Label>Select any symptoms</Label>
            <ListSelector
              options={symptoms}
              selected={form.symptoms}
              onChange={(v) => set('symptoms', v)}
              onAddCustom={onAddSymptom}
            />
          </section>
        )}

        {/* ── Step 4: Triggers ── */}
        {step === 4 && (
          <section className="space-y-3">
            <Label>What may have triggered this?</Label>
            <ListSelector
              options={triggers}
              selected={form.triggers}
              onChange={(v) => set('triggers', v)}
              onAddCustom={onAddTrigger}
            />
          </section>
        )}

        {/* ── Step 5: Treatment & reliefs ── */}
        {step === 5 && (
          <div className="space-y-6">
            <section className="space-y-2">
              <Label>Medication taken (optional)</Label>
              <MedicationInput value={form.medication} onChange={(v) => set('medication', v)} recentMeds={recentMeds} />
            </section>
            <section className="space-y-3">
              <Label>Relief methods (optional)</Label>
              <ChipSelector options={reliefs} selected={form.reliefs}
                onChange={(v) => set('reliefs', v)} onAddCustom={onAddRelief} />
            </section>
            <section className="space-y-2">
              <Label>Note (optional)</Label>
              <textarea rows={2} value={form.note} placeholder="Anything else worth noting…"
                onChange={(e) => set('note', e.target.value)}
                className="w-full rounded-lg bg-bg-raised border border-bg-border px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent resize-none" />
            </section>
          </div>
        )}

        {/* ── Step 6: Reminders (ongoing only) ── */}
        {step === 6 && (
          <NotificationSettings value={form.notifConfig} onChange={(v) => set('notifConfig', v)} />
        )}

      </div>

      {/* Sticky navigation — pinned to bottom of scroll container */}
      <div className="sticky bottom-0 -mx-4 sm:-mx-6 bg-bg-surface border-t border-bg-border px-4 sm:px-6 py-4 flex gap-3">
        {step > 1 && (
          <button type="button" onClick={goBack}
            className="flex-1 rounded-xl border border-bg-border py-3 text-sm font-medium text-text-secondary hover:bg-bg-raised transition-colors">
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
              : 'bg-accent text-bg-base hover:bg-accent-light active:scale-[.99]'
          }`}
        >
          {step === totalSteps ? 'Log attack' : 'Next'}
        </button>
      </div>
    </div>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <p className="text-xs uppercase tracking-wider font-medium text-text-secondary">
      {children}{required && <span className="text-severity-high ml-0.5">*</span>}
    </p>
  );
}
