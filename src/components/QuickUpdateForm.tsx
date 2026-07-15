import { useState } from 'react';
import type { Attack, Snapshot } from '../types';
import type { TextScale } from '../hooks/useSettings';
import { isoToLocalInput, localInputToIso, formatTime, formatDate } from '../utils/format';
import { maxSeverity, attackMaxSeverity } from '../utils/stats';
import { AreaSeverityPicker } from './AreaSeverityPicker';
import { ChipSelector } from './ChipSelector';
import { MedicationInput } from './MedicationInput';
import { TextScaleControl } from './TextScaleControl';
import { SeverityChart } from './SeverityChart';
import { SnapshotRow } from './SnapshotRow';

interface Props {
  attack: Attack;
  symptoms: string[];
  reliefs: string[];
  recentMeds: Array<{ name: string; dose: string }>;
  textScale: TextScale;
  onTextScale: (s: TextScale) => void;
  onAddSymptom: (s: string) => void;
  onAddRelief: (r: string) => void;
  onSave: (snapshot: Omit<Snapshot, 'source'>) => void;
  onNoChange: () => void;
  onClose: () => void;
}

interface FormState {
  time: string;
  areas: Record<string, number>;
  symptoms: string[];
  reliefs: string[];
  medication: { name: string; dose: string };
  note: string;
}

const blank = (): FormState => ({
  time: isoToLocalInput(),
  areas: {},
  symptoms: [],
  reliefs: [],
  medication: { name: '', dose: '' },
  note: '',
});

const TOTAL_STEPS = 6;

const STEP_LABELS = ['Update time', 'Pain areas', 'Medication', 'Relief methods', 'Symptoms', 'Note'];
const STEP_SUBHEADS = [
  'When is this update from?',
  'Rate how it feels right now — this is a new reading, not an edit',
  'Log any medication you took',
  'What helped relieve it?',
  'Select any symptoms you noticed',
  'Anything else worth noting?',
];

// Small "last entry" caption text shown below each step's picker — a reference
// only, never pre-filled, since an update is a new reading, not an edit of
// what was logged before.
function lastEntryCaption(step: number, prev: Snapshot): string | null {
  const at = formatTime(prev.time);
  if (step === 2) {
    const areaCount = Object.keys(prev.areas).length;
    if (areaCount === 0) return null;
    const sev = maxSeverity(prev);
    const areaList = Object.entries(prev.areas).map(([a, s]) => `${a} ${s}`).join(', ');
    return `At last entry (${at}), pain was severity ${sev} — ${areaList}`;
  }
  if (step === 3) {
    if (!prev.medication) return null;
    const dose = prev.medication.dose ? ` ${prev.medication.dose}` : '';
    return `Took ${prev.medication.name}${dose} at ${at} (last entry)`;
  }
  if (step === 4) {
    if (!prev.reliefs || prev.reliefs.length === 0) return null;
    return `Last entry (${at}): ${prev.reliefs.join(', ')}`;
  }
  if (step === 5) {
    if (prev.symptoms.length === 0) return null;
    return `Last entry (${at}): ${prev.symptoms.join(', ')}`;
  }
  if (step === 6) {
    if (!prev.note) return null;
    return `Last note (${at}): "${prev.note}"`;
  }
  return null;
}

export function QuickUpdateForm({ attack, symptoms, reliefs, recentMeds, textScale, onTextScale, onAddSymptom, onAddRelief, onSave, onNoChange, onClose }: Props) {
  const prev = attack.snapshots[attack.snapshots.length - 1];

  // step 0 = the initial "nothing changed / log what changed" choice screen;
  // steps 1..TOTAL_STEPS = the wizard.
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(blank);

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function goNext() {
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
    else submit();
  }

  function goBack() {
    setStep((s) => s - 1);
  }

  function submit() {
    onSave({
      time: localInputToIso(form.time),
      areas: form.areas,
      symptoms: form.symptoms,
      reliefs: form.reliefs,
      medication: form.medication.name.trim()
        ? { name: form.medication.name.trim(), dose: form.medication.dose }
        : null,
      note: form.note.trim() || null,
    });
  }

  const caption = step >= 1 ? lastEntryCaption(step, prev) : null;

  return (
    <div className="flex flex-col flex-1 min-h-0 mx-auto w-full max-w-2xl">
      {/* Top app bar — close (left), title/step-count (center), Finish now (right). */}
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
          {step === 0 ? 'Add update' : `${step} / ${TOTAL_STEPS}`}
        </span>

        <div className="ml-auto flex items-center">
          {step >= 1 && step < TOTAL_STEPS && (
            <button type="button" onClick={submit}
              className="px-2 py-1 text-sm font-medium text-accent-light hover:text-accent transition-colors">
              Finish now
            </button>
          )}
        </div>
      </div>

      {/* Scrolling content — the only scrolling region */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pt-5 pb-4 flex flex-col">
        {step === 0 ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{formatDate(attack.snapshots[0].time)}</h2>
              <p className="text-sm text-text-secondary">
                Ongoing · max severity {attackMaxSeverity(attack)}
              </p>
              {attack.triggers.length > 0 && (
                <p className="text-xs text-text-secondary mt-1">{attack.triggers.join(', ')}</p>
              )}
            </div>

            {attack.snapshots.length >= 2 && (
              <SeverityChart attack={attack} height={150} />
            )}

            <div>
              <p className="text-xs uppercase tracking-wider font-medium text-text-secondary mb-3">Timeline</p>
              {attack.snapshots.map((snap, i) => (
                <SnapshotRow key={i} snap={snap} isFirst={i === 0} />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Section header — H2 title + instruction, with the text-size stepper
                pinned to its right. */}
            <div className="mb-5 flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-text-primary">{STEP_LABELS[step - 1]}</h2>
                <p className="mt-1 text-sm text-text-secondary">{STEP_SUBHEADS[step - 1]}</p>
              </div>
              <div className="shrink-0">
                <TextScaleControl scale={textScale} onScale={onTextScale} />
              </div>
            </div>

            {/* ── Step 1: Update time ── */}
            {step === 1 && (
              <input
                type="datetime-local"
                value={form.time}
                max={isoToLocalInput()}
                onChange={(e) => set('time', e.target.value)}
                className="w-full rounded-lg bg-bg-raised border border-bg-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-subtle"
              />
            )}

            {/* ── Step 2: Pain areas — starts empty; this is a new reading ── */}
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

            {/* ── Step 6: Note — grows to fill the remaining space ── */}
            {step === 6 && (
              <textarea rows={4} value={form.note} placeholder="What changed?"
                onChange={(e) => set('note', e.target.value)}
                className="w-full flex-1 min-h-[8rem] rounded-lg bg-bg-raised border border-bg-border px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-border-subtle resize-none" />
            )}

            {/* Reference to what was logged last time — never pre-filled, just shown */}
            {caption && (
              <p className="mt-3 text-xs text-text-secondary">{caption}</p>
            )}
          </>
        )}
      </div>

      {/* Actions — flex-pinned to the bottom (above the home indicator) */}
      <div
        className="flex gap-3 border-t border-bg-border bg-bg-surface px-4 sm:px-6 py-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        {step === 0 ? (
          <div className="flex flex-col gap-3 w-full">
            <button
              type="button"
              onClick={onNoChange}
              className="btn-secondary w-full rounded-xl py-3 text-sm font-medium transition-colors"
            >
              Nothing changed — log no change
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="btn-primary w-full rounded-xl py-3 text-sm font-semibold transition-colors"
            >
              Log what changed
            </button>
          </div>
        ) : (
          <>
            <button type="button" onClick={goBack}
              className="btn-secondary flex-1 rounded-xl py-3 text-sm font-medium transition-colors">
              Back
            </button>
            <button type="button" onClick={goNext}
              className="btn-primary flex-1 rounded-xl py-3 text-sm font-semibold transition-colors">
              {step === TOTAL_STEPS ? 'Save update' : 'Next'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
