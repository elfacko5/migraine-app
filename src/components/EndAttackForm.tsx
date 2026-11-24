import { useEffect, useRef, useState } from 'react';
import type { Attack, Snapshot } from '../types';
import { PAIN_QUALITY_OPTIONS, NOTHING_UNUSUAL } from '../types';
import { isoToLocalInput, localInputToIso, formatDatetime } from '../utils/format';
import { attackMaxSeverity } from '../utils/stats';
import { doseHelpRows, rowEligible, placeDoseOutcomeEvents, type HelpRow } from '../utils/doseOutcomes';
import { chipClass } from '../utils/chipStyles';
import { RadioDot } from './RadioDot';
import { DoseOutcomeRow } from './DoseOutcomeRow';
import { ChipSelector } from './ChipSelector';
import { DateTimeField, type DateTimeFieldHandle } from './DateTimeField';
import { TextScaleControl } from './TextScaleControl';
import type { TextScale } from '../hooks/useSettings';
import { SymptomIcon, ReliefIcon, TriggerIcon } from './drawnIcons';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  attack: Attack;
  symptoms: string[];
  reliefs: string[];
  triggers: string[];
  textScale: TextScale;
  onTextScale: (s: TextScale) => void;
  onAddSymptom: (s: string) => void;
  onAddRelief: (r: string) => void;
  onAddTrigger: (t: string) => void;
  onClose: () => void;
  onSave: (
    endTime: string,
    endUnknown: boolean,
    impact: Attack['impact'] | undefined,
    extraSnapshots: Array<Omit<Snapshot, 'source'>>,
    triggers: string[],
    painQuality: string[],
  ) => void;
}

type EndMode = 'now' | 'hour1' | 'hour2' | 'manual' | 'unknown';

const END_OPTIONS: { value: EndMode; label: string }[] = [
  { value: 'now', label: 'Just now' },
  { value: 'hour1', label: '1h ago' },
  { value: 'hour2', label: '2h ago' },
  { value: 'manual', label: 'Pick a time…' },
];

// The v4 flows' own wording for the four impact degrees (A3/A8) — the same
// `Attack['impact']` 0-3 value `IMPACT_OPTIONS` (impact.ts) already uses for
// the Today prompt, AttackDetail and the Logs filter, just read out in the
// newer register. Not unified with `IMPACT_OPTIONS` itself: that's a
// decision of its own (docs/redesign-v4-diff.md notes the two vocabularies
// as a known, accepted gap), not something to settle quietly inside one
// flow's own step.
const END_IMPACT_LABELS: Record<NonNullable<Attack['impact']>, string> = {
  0: 'Carried on',
  1: 'Slowed down',
  2: 'Had to stop',
  3: 'In bed',
};

// Triggers and pain quality start from whatever the attack already has —
// both are stable metadata editable at any time (A5), and this step is
// often the *only* time they're set for an attack that was logged live
// (LiveAttackForm never asks either). Starting blank would mean skipping
// this step on Finish silently wiped out an answer given earlier via
// AttackDetail's own "Add", and starting fresh would make a *picked* answer
// overwrite rather than add to one already on record — same `[]` default
// `endAttack`'s trailing params already treat as "say nothing", so an
// attack with real triggers reaching this step with an empty array would
// have them erased outright.
function blank(attack: Attack): FormState {
  return {
    endMode: 'now', manualTime: isoToLocalInput(), impact: undefined,
    painQuality: attack.painQuality ?? [], symptoms: [], reliefs: [], triggers: attack.triggers,
  };
}

interface FormState {
  endMode: EndMode;
  manualTime: string;
  impact: Attack['impact'] | undefined;
  painQuality: string[];
  symptoms: string[];
  reliefs: string[];
  triggers: string[];
}

/**
 * "End attack" (v4 redesign) — 5 steps (When did it end? → Did it help? →
 * How much did it stop you? → What was it like? → The two days before),
 * matching `docs/redesign-v4/screens/24-end/`. Replaces `EndAttackDialog`'s
 * single question entirely — unlike the other three logging flows there is
 * no voice-draft carve-out, since ending an attack isn't a voice-loggable
 * action.
 *
 * **Step 2 is left out of the count when this attack has no medication old
 * enough to ask about** (the board's own "approved in principle" 4-step
 * variant), and otherwise reuses `doseOutcomes.ts` exactly as
 * `UpdateAttackForm` does — see that module's own doc comment for why a
 * dose-outcome answer has to be placed strictly before whatever other
 * full-state reading a submission also saves. Here that other reading is
 * the "what was it like" closing snapshot (step 4), when there is one.
 *
 * **Step 3's impact question stays separate from `ImpactPrompt`'s own 24h
 * fallback on Today** (A3 condition 1) — answering here just means the
 * fallback has nothing left to ask; skipping it here leaves the fallback to
 * catch it, same as before this flow existed.
 *
 * **"Gone when you woke up" anchors `end` to the attack's last reading**,
 * never to the moment this flow happens to be completed — the same choice
 * `PastAttackForm` makes for its own unknown-start case, for the same
 * reason (lesson 5 in the project's own handoff notes): a flow left open
 * for a while before Finish would otherwise fabricate a placeholder later
 * than the truth, and `endUnknown` existing to exclude a placeholder from
 * duration figures doesn't make a wildly-wrong one harmless everywhere else
 * that reads `end` (the 24h impact window, chiefly).
 */
export function EndAttackForm({ attack, symptoms, reliefs, triggers, textScale, onTextScale, onAddSymptom, onAddRelief, onAddTrigger, onClose, onSave }: Props) {
  const minTime = attack.snapshots[attack.snapshots.length - 1].time;
  const minMs = new Date(minTime).getTime();

  const [openedAt] = useState(() => Date.now());
  const [form, setForm] = useState<FormState>(() => blank(attack));
  const [discardOpen, setDiscardOpen] = useState(false);
  const manualInputRef = useRef<DateTimeFieldHandle>(null);

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  useEffect(() => {
    if (form.endMode === 'manual') manualInputRef.current?.open();
  }, [form.endMode]);

  // A relative preset that would land before the attack's own last reading
  // (a short attack, ending under an hour or two after its own last update)
  // isn't offered at all, rather than offered and silently clamped to
  // something else on Finish — same rule `doseOptions` (doseTime.ts)
  // already follows for a dose-time preset outside its own window.
  const endOptions = END_OPTIONS.filter((o) => {
    if (o.value === 'hour1') return openedAt - 60 * 60 * 1000 >= minMs;
    if (o.value === 'hour2') return openedAt - 2 * 60 * 60 * 1000 >= minMs;
    return true;
  });

  // Resolved, then clamped into [last reading, now] — a manual pick is
  // minute-precision against second-precision snapshots, same clamp
  // `EndAttackDialog` always applied.
  const rawEndMs = (() => {
    switch (form.endMode) {
      case 'now': return openedAt;
      case 'hour1': return openedAt - 60 * 60 * 1000;
      case 'hour2': return openedAt - 2 * 60 * 60 * 1000;
      case 'manual': return new Date(localInputToIso(form.manualTime)).getTime();
      case 'unknown': return minMs;
    }
  })();
  const resolvedEndMs = Math.min(Math.max(rawEndMs, minMs), openedAt);
  const endUnknown = form.endMode === 'unknown';

  // Computed once, when the sheet opens — see `UpdateAttackForm`'s identical
  // note on why a step shouldn't disappear mid-flow. The synthetic `end`
  // gives `doseHelpRows` the right ceiling before the real one is ever
  // committed.
  const [helpRows] = useState<HelpRow[]>(() => doseHelpRows({ ...attack, end: new Date(resolvedEndMs).toISOString() }, openedAt));
  const [helpAnswers, setHelpAnswers] = useState<Record<string, number>>({});

  const STEPS = ['when', ...(helpRows.length > 0 ? ['help'] : []), 'impact', 'like', 'before'] as const;
  const [stepIndex, setStepIndex] = useState(0);
  const kind = STEPS[stepIndex];
  const totalSteps = STEPS.length;

  function goNext() {
    if (stepIndex < totalSteps - 1) setStepIndex((s) => s + 1);
    else submit();
  }

  function goBack() {
    setStepIndex((s) => s - 1);
  }

  function requestClose() {
    // Nothing is saved until Finish, and step 1 always has a default answer
    // ("Just now") — there's nothing worth confirming until the user has
    // moved past it into the flow's own optional steps.
    if (stepIndex > 0) setDiscardOpen(true);
    else onClose();
  }

  function submit() {
    const endIso = new Date(resolvedEndMs).toISOString();
    const outcomeEvents = placeDoseOutcomeEvents(helpRows, helpAnswers, resolvedEndMs);
    const extraSnapshots: Array<Omit<Snapshot, 'source'>> = outcomeEvents.map((ev) => ({
      time: new Date(ev.ms).toISOString(), areas: { [ev.area]: ev.value }, symptoms: [], reliefs: [], medication: null, note: null,
    }));
    // The closing reading only exists when there's something to carry —
    // "also had"/"what did you try" describing the attack overall, not a
    // pain reading (End has no severity step of its own). Skipped entirely
    // rather than saved empty: a reading with no areas, no symptoms and no
    // reliefs is pure noise on the timeline.
    if (form.symptoms.length > 0 || form.reliefs.length > 0) {
      extraSnapshots.push({ time: endIso, areas: {}, symptoms: form.symptoms, reliefs: form.reliefs, medication: null, note: null });
    }
    onSave(endIso, endUnknown, form.impact, extraSnapshots, form.triggers, form.painQuality);
  }

  const STEP_TITLES: Record<string, string> = {
    when: 'When did it end?',
    help: 'Did it help?',
    impact: 'How much did the attack stop you?',
    like: 'What was it like?',
    before: 'The two days before',
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
      <div
        className="relative flex items-center gap-2 px-3.5 pb-0 pt-3.5"
        style={{ paddingTop: 'calc(0.875rem + env(safe-area-inset-top))' }}
      >
        {stepIndex > 0 ? (
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
        <span className="flex-1 text-center text-sm font-medium text-text-primary">Step {stepIndex + 1} of {totalSteps}</span>
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
            <h1 className="text-[1.625rem] font-semibold leading-tight text-text-primary">{STEP_TITLES[kind]}</h1>
            <p className="mt-1.5 text-sm text-text-secondary">
              {kind === 'when' && <>Required<span className="text-severity-high ml-0.5">*</span> · started {formatDatetime(attack.snapshots[0].time)} · worst {attackMaxSeverity(attack)}</>}
              {kind === 'help' && 'Optional · for doses already logged this attack'}
              {kind === 'impact' && 'Optional'}
              {kind === 'like' && 'Optional · pick any'}
              {kind === 'before' && 'Optional · pick any'}
            </p>
          </div>
          <div className="shrink-0">
            <TextScaleControl scale={textScale} onScale={onTextScale} />
          </div>
        </div>

        {kind === 'when' && (
          <div className="space-y-5">
            <div role="radiogroup" aria-label="When it ended" className="flex flex-wrap gap-2">
              {endOptions.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={form.endMode === o.value}
                  onClick={() => set('endMode', o.value)}
                  className={`tap-44-y inline-flex items-center gap-1.5 rounded-chip px-4 py-2 text-sm font-medium transition-colors ${chipClass(form.endMode === o.value)}`}
                >
                  <RadioDot selected={form.endMode === o.value} />
                  {o.label}
                </button>
              ))}
            </div>
            {form.endMode === 'manual' && (
              <DateTimeField
                label="Attack end time"
                value={form.manualTime}
                min={isoToLocalInput(minTime)}
                max={isoToLocalInput()}
                onChange={(v) => set('manualTime', v)}
                openRef={manualInputRef}
              />
            )}
            <div className="space-y-2 border-t border-bg-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Also true?</p>
              <button
                type="button"
                onClick={() => set('endMode', endUnknown ? 'now' : 'unknown')}
                aria-pressed={endUnknown}
                className={`tap-44-y inline-flex items-center gap-1.5 rounded-chip px-3.5 py-2 text-sm font-medium transition-colors ${chipClass(endUnknown)}`}
              >
                Woke up without it
              </button>
              {endUnknown && (
                <p className="text-xs text-text-secondary">Saved as "gone when you woke up." Add a time if you know it.</p>
              )}
            </div>
          </div>
        )}

        {kind === 'help' && (
          <div className="space-y-3">
            {helpRows.map((row) => (
              <DoseOutcomeRow
                key={row.name}
                // Downgraded to "too soon" the moment step 1's chosen end
                // time no longer leaves two hours between the dose and it
                // — same re-check `UpdateAttackForm` applies, needed here
                // too since step 1 (where the end time is set) always comes
                // before this one.
                row={row.state === 'ask' && !rowEligible(row, resolvedEndMs, helpRows.length) ? { ...row, state: 'too-soon' } : row}
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

        {kind === 'impact' && (
          <div role="radiogroup" aria-label="How much the attack stopped you" className="flex flex-col gap-2.5">
            {([0, 1, 2, 3] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={form.impact === v}
                onClick={() => set('impact', form.impact === v ? undefined : v)}
                className={`tap-44-y flex min-h-[3.625rem] w-full items-center gap-3 rounded-card px-4 py-2.5 text-left text-base font-medium transition-colors ${chipClass(form.impact === v)}`}
              >
                <RadioDot selected={form.impact === v} />
                {END_IMPACT_LABELS[v]}
              </button>
            ))}
          </div>
        )}

        {kind === 'like' && (
          <div className="space-y-6">
            <section className="space-y-2" aria-labelledby="end-felt-like-label">
              <h3 id="end-felt-like-label" className="text-sm font-medium text-text-primary">
                Felt like <span className="font-normal text-text-secondary">— pick any</span>
              </h3>
              <ChipSelector options={PAIN_QUALITY_OPTIONS} selected={form.painQuality} onChange={(v) => set('painQuality', v)} />
            </section>
            <section className="space-y-2" aria-labelledby="end-also-had-label">
              <h3 id="end-also-had-label" className="text-sm font-medium text-text-primary">
                Also had <span className="font-normal text-text-secondary">— pick any</span>
              </h3>
              <ChipSelector options={symptoms} selected={form.symptoms} onChange={(v) => set('symptoms', v)}
                onAddCustom={onAddSymptom} renderIcon={(s) => <SymptomIcon name={s} className="h-4 w-4" />} />
            </section>
            <section className="space-y-2" aria-labelledby="end-tried-label">
              <h3 id="end-tried-label" className="text-sm font-medium text-text-primary">
                What did you try? <span className="font-normal text-text-secondary">— pick any</span>
              </h3>
              <ChipSelector options={reliefs} selected={form.reliefs} onChange={(v) => set('reliefs', v)}
                onAddCustom={onAddRelief} renderIcon={(r) => <ReliefIcon name={r} className="h-4 w-4" />} />
            </section>
          </div>
        )}

        {kind === 'before' && (
          <section className="space-y-2" aria-labelledby="end-two-days-label">
            <h3 id="end-two-days-label" className="text-sm font-medium text-text-primary">The two days before</h3>
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
        )}
      </div>

      <div
        className="flex gap-3 border-t border-bg-border bg-bg-surface px-gutter sm:px-gutter-wide py-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={goNext}
          className="btn-primary flex-1 transition-all active:scale-[.99]"
        >
          {stepIndex === totalSteps - 1 ? 'Finish' : 'Next'}
        </button>
      </div>

      <ConfirmDialog
        open={discardOpen}
        danger
        title="Discard this?"
        message="The attack stays ongoing and nothing you've entered here is saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => { setDiscardOpen(false); onClose(); }}
        onCancel={() => setDiscardOpen(false)}
      />
    </div>
  );
}
