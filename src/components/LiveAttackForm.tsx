import { useEffect, useRef, useState } from 'react';
import type { Attack, Medication, NotificationConfig, Snapshot } from '../types';
import { isoToLocalInput, localInputToIso } from '../utils/format';
import { doseEntryMs } from '../utils/doseEntries';
import { chipClass } from '../utils/chipStyles';
import { RadioDot } from './RadioDot';
import { AreaSeverityPicker } from './AreaSeverityPicker';
import { MedicationEntry, type SelectedMedication } from './MedicationEntry';
import { DateTimeField, type DateTimeFieldHandle } from './DateTimeField';
import { SunriseIcon } from './icons';
import { ChipCheck } from './ChipCheck';
import { DiscardDraftDialog } from './DiscardDraftDialog';
import { MoreQuestionsFields, OFFER_TITLE, OFFER_SUBHEAD, EXTRAS_TITLE } from './MoreQuestions';

interface Props {
  recentMeds: Array<{ name: string; dose: string }>;
  medications?: Medication[];
  attacks?: Attack[];
  defaultNotifConfig: NotificationConfig;
  symptoms: string[];
  reliefs: string[];
  onAddSymptom: (s: string) => void;
  onAddRelief: (r: string) => void;
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

type StartMode = 'now' | 'min30' | 'hour_ago' | 'hours2' | 'manual';

const START_OFFSET_MIN: Partial<Record<StartMode, number>> = { now: 0, min30: 30, hour_ago: 60, hours2: 120 };

const START_OPTIONS: { value: StartMode; label: string }[] = [
  { value: 'now',      label: 'Just now' },
  { value: 'min30',    label: '30 min ago' },
  { value: 'hour_ago', label: '1h ago' },
  { value: 'hours2',   label: '2h ago' },
  { value: 'manual',   label: 'Pick a time…' },
];

const STEP_LABELS = ['When did it start?', 'Where does it hurt?', 'Taken anything?', OFFER_TITLE, EXTRAS_TITLE];
const STEP_SUBHEADS = [
  undefined,
  'Tap an area, then rate it. Required.',
  'Optional',
  OFFER_SUBHEAD,
  'Optional',
];
/** Steps 1–3 make the reading; 4 offers more questions, 5 asks them. */
const CORE_STEPS = 3;
const OFFER_STEP = 4;

/**
 * "Log an attack" (live), v4 redesign — 3 steps (When → Where → Medication),
 * matching `docs/redesign-v4/screens/23-live/`, then an offer of a few more
 * questions — Felt like, symptoms, reliefs (`MoreQuestions.tsx`, 2026-11-27).
 * Triggers stay with the end-of-attack flow.
 *
 * Replaces `LogForm`'s `past={false}` case for **manual** entry only. A
 * voice draft still opens `LogForm` regardless of past/live — that flow's
 * step-0 review screen, and the symptoms/reliefs/triggers it can prefill,
 * have no equivalent here yet, and preserving voice compatibility exactly as
 * it works today matters more than this flow covering that case too. See
 * docs/voice-parsing.md.
 */
export function LiveAttackForm({ recentMeds, medications = [], attacks = [], defaultNotifConfig, symptoms: symptomOptions, reliefs: reliefOptions, onAddSymptom, onAddRelief, onClose, onSave }: Props) {
  const [step, setStep] = useState(1);
  const [startMode, setStartMode] = useState<StartMode>('now');
  const [startTime, setStartTime] = useState(() => isoToLocalInput());
  const [wokeWithMigraine, setWokeWithMigraine] = useState(false);
  const [areas, setAreas] = useState<Record<string, number>>({});
  const [meds, setMeds] = useState<SelectedMedication[]>([]);
  const [painQuality, setPainQuality] = useState<string[]>([]);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [reliefs, setReliefs] = useState<string[]>([]);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const startInputRef = useRef<DateTimeFieldHandle>(null);

  useEffect(() => {
    if (startMode === 'manual') startInputRef.current?.open();
  }, [startMode]);

  const totalSteps = STEP_LABELS.length;
  const startMs = startMode === 'manual' ? new Date(localInputToIso(startTime)).getTime() : openedAt - (START_OFFSET_MIN[startMode] ?? 0) * 60_000;
  const nextDisabled = step === 2 && Object.keys(areas).length === 0;

  function goNext() {
    if (nextDisabled) return;
    if (step === OFFER_STEP || step === totalSteps) submit();
    else setStep((s) => s + 1);
  }

  // Once an area is rated the reading is complete, so closing asks before
  // dropping it — same dialog Update and Past use.
  function requestClose() {
    if (Object.keys(areas).length > 0) setDiscardOpen(true);
    else onClose();
  }

  function submit() {
    const nowMs = Date.now();
    const rawStartMs = startMode === 'manual' ? new Date(localInputToIso(startTime)).getTime() : nowMs - (START_OFFSET_MIN[startMode] ?? 0) * 60_000;
    // Clamped once, here, and reused for every dose below — a manually
    // picked start in the future (the picker's own max should already
    // prevent this, but nothing downstream should rely on that alone) must
    // not push a dose's resolved time past "now" either.
    const resolvedStartMs = Math.min(rawStartMs, nowMs);
    const startIso = new Date(resolvedStartMs).toISOString();

    // Every dose entry resolves to its own time; one that lands on the start
    // (within doseEntryMs's own slack) rides on the opening reading instead
    // of becoming a second one at the same instant — same "a dose's time is
    // the time of the reading it sits on" rule LogForm already follows, just
    // generalised from one dose to any number across any number of medicines.
    let openingMedication: Omit<Snapshot, 'source'>['medication'] = null;
    let openingClaimed = false;
    const extraSnapshots: Array<Omit<Snapshot, 'source'>> = [];

    for (const med of meds) {
      for (const dose of med.doses) {
        const doseMs = doseEntryMs(dose, resolvedStartMs, null, nowMs);
        const medication = { name: med.name, dose: med.dose, ...(dose.amount ? { amount: dose.amount } : {}) };
        if (!openingClaimed && Math.abs(doseMs - resolvedStartMs) < 60_000) {
          openingMedication = medication;
          openingClaimed = true;
        } else {
          extraSnapshots.push({
            time: new Date(doseMs).toISOString(),
            areas: { ...areas },
            symptoms: [],
            reliefs: [],
            medication,
            note: null,
          });
        }
      }
    }

    onSave(
      { time: startIso, areas, symptoms, reliefs, medication: openingMedication, note: null },
      [],
      defaultNotifConfig,
      null,
      wokeWithMigraine,
      extraSnapshots,
      undefined,
      painQuality,
    );
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
      {/* Flow header — 40px circle back (hidden on step 1) / step count / 40px
          circle close. Matches the v4 step-flow header pattern exactly;
          "Back" moves here from the footer, which now carries only the one
          forward action.

          **Circle fill is `bg-bg-raised`, not `bg-bg-surface`** (June's
          report, 2026-11-24) — the sheet's own root is `bg-bg-surface`
          (`Sheet.tsx`), so a same-tone circle on it had zero contrast and
          read as no background at all. `bg-bg-raised` is the next surface up
          from the sheet's own tone, same nesting rule as everywhere else;
          hover steps up again to `bg-bg-elevated`. */}
      <div
        className="relative flex items-center gap-2 px-3.5 pb-0 pt-3.5"
        style={{ paddingTop: 'calc(0.875rem + env(safe-area-inset-top))' }}
      >
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
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
        <span className="flex-1 text-center text-sm font-medium text-text-primary">{step <= CORE_STEPS ? `Step ${step} of ${CORE_STEPS}` : ''}</span>
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
          {STEP_SUBHEADS[step - 1] && <p className="mt-1.5 text-sm text-text-secondary">{STEP_SUBHEADS[step - 1]}</p>}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div role="radiogroup" aria-label="When it started" className="flex flex-wrap gap-2">
              {START_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={startMode === o.value}
                  onClick={() => setStartMode(o.value)}
                  className={`tap-44-y inline-flex items-center gap-1.5 rounded-chip px-4 py-2 text-sm font-medium transition-colors ${chipClass(startMode === o.value)}`}
                >
                  <RadioDot selected={startMode === o.value} />
                  {o.label}
                </button>
              ))}
            </div>
            {startMode === 'manual' && (
              <DateTimeField
                label="Attack start time"
                value={startTime}
                max={isoToLocalInput()}
                onChange={setStartTime}
                surface="raised"
                openRef={startInputRef}
              />
            )}
            <div className="space-y-2.5 border-t border-bg-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Also true?</p>
              <button
                type="button"
                onClick={() => setWokeWithMigraine((w) => !w)}
                aria-pressed={wokeWithMigraine}
                className={`tap-44-y inline-flex items-center gap-1.5 rounded-chip px-3.5 py-2 text-sm font-medium transition-colors ${chipClass(wokeWithMigraine)}`}
              >
                <SunriseIcon className="h-4 w-4" />
                Woke up with it
                <ChipCheck selected={wokeWithMigraine} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && <AreaSeverityPicker value={areas} onChange={setAreas} />}

        {step === 3 && (
          <MedicationEntry
            value={meds}
            onChange={setMeds}
            recentMeds={recentMeds}
            medications={medications}
            attacks={attacks}
            startMs={startMs}
            endMs={null}
            nowMs={openedAt}
          />
        )}

        {step === 5 && (
          <MoreQuestionsFields
            idPrefix="live"
            showFeltLike
            painQuality={painQuality} onPainQuality={setPainQuality}
            symptomOptions={symptomOptions} symptoms={symptoms} onSymptoms={setSymptoms} onAddSymptom={onAddSymptom}
            reliefOptions={reliefOptions} reliefs={reliefs} onReliefs={setReliefs} onAddRelief={onAddRelief}
          />
        )}
      </div>

      <div
        className="flex gap-3 border-t border-bg-border bg-bg-surface px-gutter sm:px-gutter-wide py-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        {step === OFFER_STEP && (
          <button type="button" onClick={() => setStep((s) => s + 1)} className="btn-secondary btn-cta flex-1 transition-colors">
            A few more
          </button>
        )}
        <button
          type="button"
          onClick={goNext}
          disabled={nextDisabled}
          className={`btn-primary btn-cta flex-1 transition-all ${nextDisabled ? '' : 'active:scale-[.99]'}`}
        >
          {step >= OFFER_STEP ? 'Save' : 'Next'}
        </button>
      </div>

      <DiscardDraftDialog
        open={discardOpen}
        discardLabel="Discard this attack"
        onKeepGoing={() => setDiscardOpen(false)}
        onSave={submit}
        onDiscard={onClose}
      />
    </div>
  );
}
