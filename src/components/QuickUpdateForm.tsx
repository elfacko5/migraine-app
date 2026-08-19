import { useState } from 'react';
import type { Attack, Medication, Snapshot } from '../types';
import type { TextScale } from '../hooks/useSettings';
import type { VoiceDraft } from '../utils/voiceParse';
import { isoToLocalInput, localInputToIso, formatTime, formatDatetime } from '../utils/format';
import { maxSeverity } from '../utils/stats';
import { findMedication } from '../utils/medGuardrails';
import { AreaSeverityPicker } from './AreaSeverityPicker';
import { ChipSelector } from './ChipSelector';
import { SymptomIcon, ReliefIcon } from './drawnIcons';
import { MedicationInput } from './MedicationInput';
import { TextScaleControl } from './TextScaleControl';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  attack: Attack;
  symptoms: string[];
  reliefs: string[];
  recentMeds: Array<{ name: string; dose: string }>;
  /** The library and the full history — the medication step shows where a
   *  dose sits against this drug's own limits, and the last-entry note says
   *  when the next one falls due by the gap the user entered. */
  medications?: Medication[];
  attacks?: Attack[];
  textScale: TextScale;
  onTextScale: (s: TextScale) => void;
  onAddSymptom: (s: string) => void;
  onAddRelief: (r: string) => void;
  onSave: (snapshot: Omit<Snapshot, 'source'>, source?: Snapshot['source']) => void;
  onClose: () => void;
  // Only passed for an attack still in progress. A reminder asks "how's your
  // migraine?", and "it's over" is one of the three honest answers — without
  // it here the user has to close the sheet, find the attack again and end it
  // from the Today tab, or log a no-change reading that says the opposite of
  // what happened.
  // Set when this sheet was opened from the "log a migraine" Siri Shortcut
  // for an already-ongoing attack — prefills the wizard from the dictated
  // transcript and skips straight past the choice screen (see below).
  voiceDraft?: VoiceDraft | null;
}

interface FormState {
  time: string;
  areas: Record<string, number>;
  symptoms: string[];
  reliefs: string[];
  medication: { name: string; dose: string; amount?: number };
  note: string;
}

const blank = (defaultTime: string): FormState => ({
  time: defaultTime,
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
function lastEntryCaption(step: number, prev: Snapshot, medications: Medication[]): string | null {
  const at = formatTime(prev.time);
  if (step === 1) {
    // **The one caption that carries its date when the day differs.** Every
    // other step shows a clock time as a secondary detail attached to some
    // other fact; here the time *is* the fact, and it's the floor the picker
    // enforces. "Last reading was at 20:51" on an attack that ran overnight
    // would be read as this evening and quietly invite an impossible choice
    // the picker then refuses without saying why.
    const sameDay = new Date(prev.time).toDateString() === new Date().toDateString();
    return `Last reading was at ${sameDay ? at : formatDatetime(prev.time)} — an update can't be earlier than that`;
  }
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
    // When a minimum gap was entered for this drug, say when the next dose
    // falls due by it. Measured from *this* dose rather than through
    // checkDose, which answers a different question — where a dose being
    // logged now sits — and would look past the reading this caption is about.
    // The user's own number, restated: not an instruction, and nothing here
    // refuses a dose logged before it.
    const med = findMedication(medications, prev.medication.name);
    const gap = med?.minHoursBetween
      ? ` · next dose from ${formatTime(
          new Date(new Date(prev.time).getTime() + med.minHoursBetween * 60 * 60 * 1000).toISOString(),
        )}`
      : '';
    return `Took ${prev.medication.name}${dose} at ${at} (last entry)${gap}`;
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

export function QuickUpdateForm({ attack, symptoms, reliefs, recentMeds, medications = [], attacks = [], textScale, onTextScale, onAddSymptom, onAddRelief, onSave, onClose, voiceDraft }: Props) {
  const prev = attack.snapshots[attack.snapshots.length - 1];
  // A new update must land after the last reading, and — for a past attack —
  // no later than when it ended (an ongoing attack has no such ceiling
  // besides "now", which the input's max already enforces per render).
  const minTime = prev.time;
  const maxTime = attack.end ?? new Date().toISOString();

  // Opens straight into the wizard, at the time step. There used to be a
  // choice screen first — "nothing changed" / "log what changed" / "it's
  // over" — but tapping "Add update" already says which of those you meant.
  // "Nothing changed" is a reminder's job: it's a quick action on the
  // notification, answerable from the lock screen or a watch without
  // unlocking anything, which is the only place it saves work. Someone who
  // opens the app to log nothing can pick the pain areas and use Finish now.
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(() => {
    // Defaults to *now* — the moment this sheet was opened — not to the last
    // reading's time. Seeding it with `minTime` meant the first update on an
    // attack offered the attack's own start time, so accepting the default
    // recorded a reading as having happened hours before it did.
    //
    // Captured in the initialiser rather than re-read per render, so it stays
    // the moment the user tapped "Add update" while they work through the
    // wizard. Clamped into the picker's own window: for a past attack "now"
    // is after `maxTime` (its end), and the nearest valid instant is that
    // end — which does assert the update happened right as the attack
    // finished, but any default does something like that, and the picker is
    // right there. An ongoing attack is unaffected: now is always in range.
    const opened = new Date().toISOString();
    const initialTime = opened < minTime ? minTime : opened > maxTime ? maxTime : opened;
    const base = blank(isoToLocalInput(initialTime));
    if (!voiceDraft) return base;
    return {
      ...base,
      areas: voiceDraft.areas,
      symptoms: voiceDraft.symptoms,
      reliefs: voiceDraft.reliefs,
      medication: voiceDraft.medication ?? base.medication,
      note: voiceDraft.note,
    };
  });

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

  // Everything on this update is still blank. On step 1 that's always true —
  // there has been nothing to fill in yet — which is what makes "Finish now"
  // there mean something different from "Finish now" further in.
  const isBlank =
    Object.keys(form.areas).length === 0 &&
    !form.medication.name.trim() &&
    form.reliefs.length === 0 &&
    form.symptoms.length === 0 &&
    !form.note.trim();

  // Saving a blank form would record a reading with no pain areas at all,
  // which the breakdown then has to show as "not recorded" for every area —
  // that isn't "nothing changed", it's "nothing was said". A no-change
  // reading carries the previous *severities* forward, at the time on the
  // picker, and is marked `no_change` so the plateau stats count it as
  // severity holding rather than as a gap. Symptoms and reliefs are not
  // copied: "nothing changed" is a statement about the pain, and carrying
  // them over made the timeline list things nobody had re-reported.
  function submitNoChange() {
    let time = localInputToIso(form.time);
    if (time < minTime) time = minTime;
    if (time > maxTime) time = maxTime;
    onSave({
      time,
      areas: { ...prev.areas },
      symptoms: [],
      reliefs: [],
      medication: null,
      note: null,
    }, 'notification_no_change');
  }

  function submit() {
    // Minute-precision picker vs second-precision snapshots means the exact
    // bounds can otherwise land a few seconds outside them — clamp instead
    // of rejecting, matching EndAttackDialog's handling of the same gap.
    let time = localInputToIso(form.time);
    if (time < minTime) time = minTime;
    if (time > maxTime) time = maxTime;
    onSave({
      time,
      areas: form.areas,
      symptoms: form.symptoms,
      reliefs: form.reliefs,
      medication: form.medication.name.trim()
        ? {
            name: form.medication.name.trim(),
            dose: form.medication.dose,
            // Units, when the quick-pick was used. Absent otherwise, which
            // medGuardrails reads as one — never as zero.
            ...(form.medication.amount ? { amount: form.medication.amount } : {}),
          }
        : null,
      note: form.note.trim() || null,
    });
  }

  const caption = step >= 1 ? lastEntryCaption(step, prev, medications) : null;
  const [confirmNoChange, setConfirmNoChange] = useState(false);

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
          className="tap-44 rounded-full p-2 text-text-secondary hover:bg-bg-raised hover:text-text-primary transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-base font-medium tabular-nums text-text-primary">
          {`${step} / ${TOTAL_STEPS}`}
        </span>

        <div className="ml-auto flex items-center">
          {step >= 1 && step < TOTAL_STEPS && (
            <button type="button" onClick={() => (isBlank ? setConfirmNoChange(true) : submit())}
              className="px-2 py-1 text-sm font-medium text-accent-light hover:text-accent transition-colors">
              Finish now
            </button>
          )}
        </div>
      </div>

      {/* Scrolling content — the only scrolling region */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pt-5 pb-4 flex flex-col">
            {/* Section header — H2 title + instruction, with the text-size stepper
                pinned to its right. */}
            <div className="mb-5 flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h2 className="text-xl font-medium text-text-primary">{STEP_LABELS[step - 1]}</h2>
                <p className="mt-1 text-sm text-text-secondary">{STEP_SUBHEADS[step - 1]}</p>
              </div>
              <div className="shrink-0">
                <TextScaleControl scale={textScale} onScale={onTextScale} />
              </div>
            </div>

            {step === 1 && voiceDraft && (
              <div className="mb-4 rounded-xl border border-accent/40 bg-accent/10 p-3 text-xs text-text-secondary space-y-1">
                <p className="font-medium text-accent-light">🎙️ Filled in from your voice note</p>
                {voiceDraft.matched.length > 0 ? (
                  <ul className="list-disc pl-4 space-y-0.5">
                    {voiceDraft.matched.map((m) => <li key={m}>{m}</li>)}
                  </ul>
                ) : (
                  <p>Nothing specific was recognised — what you said is kept as a note.</p>
                )}
                <p>Review each step before saving.</p>
              </div>
            )}

            {/* ── Step 1: Update time — bounded to after the last reading and,
                for a past attack, no later than when it ended ── */}
            {step === 1 && (
              <input
                type="datetime-local"
                aria-label="Time of this update"
                value={form.time}
                min={isoToLocalInput(minTime)}
                max={isoToLocalInput(maxTime)}
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
              <MedicationInput
                value={form.medication}
                onChange={(v) => set('medication', v)}
                recentMeds={recentMeds}
                medications={medications}
                attacks={attacks}
                // The reading's own time, not now: a backfilled dose counts in
                // *its* 24 hours, which is the whole point of a rolling window.
                atIso={localInputToIso(form.time)}
              />
            )}

            {/* ── Step 4: Relief methods ── */}
            {step === 4 && (
              <ChipSelector options={reliefs} selected={form.reliefs}
                onChange={(v) => set('reliefs', v)} onAddCustom={onAddRelief}
                renderIcon={(r) => <ReliefIcon name={r} className="h-4 w-4" />} />
            )}

            {/* ── Step 5: Symptoms ── */}
            {step === 5 && (
              <ChipSelector options={symptoms} selected={form.symptoms}
                onChange={(v) => set('symptoms', v)} onAddCustom={onAddSymptom}
                renderIcon={(s) => <SymptomIcon name={s} className="h-4 w-4" />} />
            )}

            {/* ── Step 6: Note — grows to fill the remaining space ── */}
            {step === 6 && (
              <textarea rows={4} value={form.note} aria-label="Note"
                placeholder="What changed?"
                onChange={(e) => set('note', e.target.value)}
                className="w-full flex-1 min-h-[8rem] rounded-lg bg-bg-raised border border-bg-border px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-border-subtle resize-none" />
            )}

            {/* Reference to what was logged last time — never pre-filled, just
                shown. Boxed so it reads as a distinct aside rather than as a
                caption belonging to the control above it, which is what plain
                text under a picker looks like.

                Deliberately quiet: the app's own raised surface and border,
                no accent fill and no colour of its own. A tinted info box
                (the usual blue) would break the palette rules and, worse,
                pull the eye to the one thing on the step that is *not*
                actionable — this is context for the reading being entered
                above it, not a message about it. `aria-hidden` is wrong here
                (it is real information), so it stays readable but inert. */}
            {caption && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-bg-border bg-bg-raised/50 px-3 py-2.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                  strokeLinecap="round" strokeLinejoin="round"
                  className="mt-px h-3.5 w-3.5 shrink-0 text-text-secondary" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                <p className="text-xs leading-relaxed text-text-secondary">{caption}</p>
              </div>
            )}
      </div>

      {/* Actions — flex-pinned to the bottom (above the home indicator) */}
      <div
        className="flex gap-3 border-t border-bg-border bg-bg-surface px-4 sm:px-6 py-4"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
            {/* Nothing behind step 1 any more — the wizard is the whole flow */}
            {step > 1 && (
              <button type="button" onClick={goBack}
                className="btn-secondary flex-1 rounded-xl py-3 text-sm font-medium transition-colors">
                Back
              </button>
            )}
            <button type="button" onClick={goNext}
              className="btn-primary flex-1 rounded-xl py-3 text-sm font-medium transition-colors">
              {step === TOTAL_STEPS ? 'Save update' : 'Next'}
            </button>
      </div>

      {/* Finishing with nothing filled in is a real answer — the pain is the
          same as last time — but it's also what a mis-tap looks like, and it
          writes a reading either way. The dialog says which of the two it is
          about to record. */}
      <ConfirmDialog
        open={confirmNoChange}
        title="Log that nothing has changed?"
        message={`This saves a reading at ${formatTime(localInputToIso(form.time))} carrying your last entry forward — same pain areas and severities. Go back if you want to record something different.`}
        confirmLabel="Log no change"
        cancelLabel="Go back"
        onConfirm={() => { setConfirmNoChange(false); submitNoChange(); }}
        onCancel={() => setConfirmNoChange(false)}
      />
    </div>
  );
}
