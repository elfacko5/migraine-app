import { useEffect, useId, useRef, useState } from 'react';
import type { Attack, MedClass, MedGuides, Medication } from '../types';
import { guideKeyOf } from '../utils/medGuardrails';
import { guideLine } from '../utils/medGuideText';
import { chipClass } from '../utils/chipStyles';
import { useKeyboardFlow } from '../utils/keyboardOverride';
import { TYPE_OPTIONS, classLetter } from '../utils/medClasses';
import {
  DAY_STEPS, GAP_STEPS, QTY_STEPS, STANDARD_FORMS, daysTakenOf, derivedDose, doseCountOf, editMakesDuplicate, formOf, isLogged, medLabel,
  otherVersionsWithOtherType, parseStrength, pluralUnit, seedFromDose, strengthNeedsCheck, unitForForm, unitText,
} from '../utils/medResolve';
import { BinIcon } from './icons';
import { ChipCheck } from './ChipCheck';
import { ClassBadge } from './ClassBadge';
import { ConfirmDialog } from './ConfirmDialog';
import { InlineNote } from './InlineNote';
import { RadioDot } from './RadioDot';
import { Chevron, SettingsGroup } from './settingsUi';
import { TypeList } from './TypeList';
import { ValueSheet } from './ValueSheet';

// Edit a medicine (commit 3 of the medication flows; frames 15f to 16e).
// Rows of labels and values; Type, Form, Strength (and Name) open a screen of
// their own and the three numbers open the value sheet. **Everything stages:
// only Save commits**, Cancel with changes asks first, and Save stays focusable
// but disabled until something has changed.
//
// The sub-screens swap inside the one sheet rather than stacking sheets, so
// there is exactly one thing behind the screen you are on and focus moves to
// its heading each time.
//
// **A Name row is added to the frames' list.** The frames show no way to
// change a name; without one a typo could never be fixed. Q4 item 4 expects
// renaming to stay possible.
//
// **Q10, versions of one drug share a type:** changing the type of one version
// offers to change the other versions of that name too (on by default) and
// says how many days count under the new type. A delete is still the old confirm: commit 4
// rebuilds it.

export type EditPatch = Partial<Omit<Medication, 'id' | 'createdAt'>>;

interface Props {
  medication: Medication;
  library: Medication[];
  guides: MedGuides;
  attacks: Attack[];
  /** One write: this medicine's patch, plus the other versions to retype. */
  onSave: (updates: { id: string; patch: EditPatch }[]) => void;
  /** Set to a function that handles a close request from outside (Escape, a
   *  tap on the backdrop): back one screen, or the discard question. */
  closeRef?: React.MutableRefObject<(() => void) | null>;
  onDelete: () => void;
  onClose: () => void;
}

type Screen = 'main' | 'name' | 'type' | 'form' | 'strength';

const inputClass =
  'w-full min-h-[3.25rem] rounded-field bg-bg-surface px-control-x text-sm text-text-primary ring-1 ring-inset ring-border-control ' +
  'placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent';

const sentence = (parts: string[]) =>
  parts.length <= 1 ? parts[0] ?? '' : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

function Row({ label, value, extra, onOpen, note }: { label: string; value: string; extra?: string | null; onOpen: () => void; note?: React.ReactNode }) {
  return (
    <button type="button" onClick={onOpen} className="tap-44-y flex min-h-[3.5rem] w-full items-center gap-3 px-control-x py-control-y text-left">
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-base text-text-primary">{label}</span>
        <span className="text-right">
          {/* Link colour (`docs/redesign-v4/reference/Patterns.html`'s `.vv`,
              "Containers and rows") — a bare value read as plain text; this
              says the row opens a picker before the chevron ever registers. */}
          <span className="block text-base font-medium text-accent-light">{value}</span>
          {extra && <span className="block text-xs text-text-secondary">{extra}</span>}
        </span>
        {note && <span className="basis-full text-xs text-severity-mid">{note}</span>}
      </span>
      <Chevron />
    </button>
  );
}

function Bar({ left, title, sub, right, headingRef }: { left: React.ReactNode; title: string; sub?: string | null; right?: React.ReactNode; headingRef: React.RefObject<HTMLHeadingElement | null> }) {
  // One row: the left control, the title centred between, the right control.
  // Both sides reserve the same minimum width, so the title sits in the middle
  // whatever is on either side; at large text the title wraps within its column.
  return (
    <div className="grid grid-cols-[minmax(4.5rem,auto)_1fr_minmax(4.5rem,auto)] items-center gap-x-2 px-3 py-3 sm:px-4" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>
      <div className="flex items-center justify-start">{left}</div>
      <div className="min-w-0 text-center">
        <h2 ref={headingRef} tabIndex={-1} className="text-base font-semibold text-text-primary outline-none">{title}</h2>
        {sub && <p className="text-xs text-text-secondary">{sub}</p>}
      </div>
      <div className="flex items-center justify-end">{right}</div>
    </div>
  );
}

export function EditMedicationForm({ medication: original, library, guides, attacks, onSave, closeRef, onDelete, onClose }: Props) {
  const initialForm = formOf(original);
  const initialClass: MedClass | undefined = original.class === 'other' ? undefined : original.class;
  const { inset, rootRef, bodyRef, onFocus, footerPaddingBottom } = useKeyboardFlow();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reasonId = useId();
  const dupId = useId();
  const nameId = useId();
  const strengthId = useId();
  const ownId = useId();

  const [screen, setScreen] = useState<Screen>('main');
  const [name, setName] = useState(original.name);
  const [cls, setCls] = useState<MedClass | undefined>(initialClass);
  const [form, setForm] = useState(initialForm);
  // An old record may store neither: they are read from its dose text for the
  // fields, and compared against those, so merely opening it changes nothing.
  const seed = seedFromDose(original.dose);
  const baseStrength = (original.strength ?? seed.strength).trim();
  const baseQty = original.quantity ?? seed.quantity ?? 1;
  const [strength, setStrength] = useState(baseStrength);
  const [qty, setQty] = useState(baseQty);
  const hasIntake = original.maxPerIntake !== undefined;     // shown only where stored, so it can be cleared
  const [maxPerIntake, setMaxPerIntake] = useState<number | undefined>(original.maxPerIntake);
  const [maxPerDay, setMaxPerDay] = useState<number | undefined>(original.maxPerDay);
  const [gap, setGap] = useState<number | undefined>(original.minHoursBetween);
  const [alsoOthers, setAlsoOthers] = useState(true);
  const [strengthChecked, setStrengthChecked] = useState(false);
  const [editing, setEditing] = useState<'qty' | 'intake' | 'day' | 'gap' | null>(null);
  const [draftText, setDraftText] = useState('');       // the text screens' own staging
  const [ownOpen, setOwnOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Focus goes to the heading of whichever screen is showing, the text screens
  // included (June, 2026-11-18): the screen is announced first, then the field
  // is a swipe and a tap away. The field is not autofocused, so the keyboard
  // opens when it is tapped, not as the screen appears.
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [screen]);

  const ownForm = !(STANDARD_FORMS as readonly string[]).includes(form);
  const unit = form === initialForm ? (original.unitLabel || unitForForm(form)) : unitForForm(form);
  const parsed = parseStrength(strength);
  const total = (n: number) => (parsed ? `${Math.round(n * parsed.value * 100) / 100} ${parsed.unit}` : null);

  // ── what changed ─────────────────────────────────────────────────────────
  const changes = [
    name.trim() !== original.name.trim() && 'name',
    cls !== initialClass && 'type',
    form !== initialForm && 'form',
    strength.trim() !== baseStrength && 'strength',
    qty !== baseQty && 'usual dose',
    maxPerIntake !== original.maxPerIntake && 'max in one go',
    maxPerDay !== original.maxPerDay && 'max in 24 hours',
    gap !== original.minHoursBetween && 'time between doses',
  ].filter((c): c is string => !!c);
  const dirty = changes.length > 0;
  // The dose text is only rewritten when something that makes it changes; an old
  // record's own text ("400mg", "2 tablets") is otherwise left exactly as it is.
  const doseChanged = strength.trim() !== baseStrength || qty !== baseQty || form !== initialForm;
  const willDose = doseChanged ? derivedDose(qty, unit, strength) : original.dose;
  const duplicate = editMakesDuplicate(original, { name: name.trim(), form, strength: strength.trim() || undefined, dose: willDose }, library);
  const blocked = !name.trim() ? 'Add a name to save' : baseStrength && !strength.trim() ? 'Add the strength to save' : null;
  const saveDisabled = !dirty || !!blocked || !!duplicate;
  const strengthFlag = strengthNeedsCheck(initialForm, form) && !strengthChecked;

  // Q10: other versions of the name (as it will be saved) whose type differs.
  const nameChanged = name.trim() !== original.name.trim();
  const othersNow = otherVersionsWithOtherType({ ...original, name: name.trim() }, cls, library);
  const others = cls !== initialClass ? othersNow : [];
  const taken = cls !== initialClass ? daysTakenOf(original, library, attacks) : { days: 0, ambiguousDoses: 0 };

  function save() {
    if (saveDisabled) return;
    // Every key is present, explicitly undefined when empty: the merge is a
    // spread, so a key left out would keep the old value and a limit could
    // never be cleared. `maxDaysPerMonth` is left alone, and `dose`, `strength`,
    // `quantity` and `unitLabel` are only written when the dose itself changed.
    const patch: EditPatch = {
      name: name.trim(),
      form,
      class: cls !== initialClass ? cls : original.class,
      maxPerDay,
      minHoursBetween: gap,
    };
    if (hasIntake) patch.maxPerIntake = maxPerIntake;
    if (doseChanged) Object.assign(patch, { dose: willDose, strength: strength.trim() || undefined, quantity: qty, unitLabel: unit });
    const updates = [{ id: original.id, patch }];
    if (alsoOthers) for (const o of others) updates.push({ id: o.id, patch: { class: cls } });
    onSave(updates);
  }

  function cancel() {
    if (dirty) setConfirmDiscard(true); else onClose();
  }

  // Escape or a tap on the backdrop: one screen back, or the discard question —
  // never a silent close that throws staged changes away. While a dialog is open
  // its own Escape handles it.
  useEffect(() => {
    if (!closeRef) return;
    closeRef.current = () => {
      if (confirmDiscard || confirmDelete || editing) return;
      if (screen !== 'main') setScreen('main'); else cancel();
    };
    return () => { closeRef.current = null; };
  });

  // Remove (commit 4): the library entry leaves, nothing else does. The wording
  // is June's (2026-11-17); the line for a medicine with no doses is a draft.
  // "Nothing has been logged" is only said when no dose could be this medicine
  // (`isLogged` counts an ambiguous one); a figure is only shown when none is
  // ambiguous, since `doseCountOf` leaves those out and would under-state it.
  const loggedDoses = doseCountOf(original, library, attacks);
  const everLogged = isLogged(original, library, attacks);
  const ambiguousDoses = everLogged ? daysTakenOf(original, library, attacks).ambiguousDoses : 0;
  const removeMessage = !everLogged
    ? 'It leaves your list. Nothing has been logged with it.'
    : loggedDoses > 0 && ambiguousDoses === 0
      ? `It leaves your list. The ${loggedDoses} ${loggedDoses === 1 ? 'dose stays' : 'doses stay'} in your diary and in Insights.`
      : 'It leaves your list. Its doses stay in your diary and in Insights.';

  const guideKey = guideKeyOf(cls);
  const gl = guideKey ? guideLine(guideKey, guides) : null;
  const typeLabel = TYPE_OPTIONS.find((t) => t.value === cls)?.label ?? 'Not sure';
  const badge = classLetter(cls) ?? '?';

  // ── pieces ───────────────────────────────────────────────────────────────
  const back = <button type="button" onClick={() => setScreen('main')} className="btn-tertiary flex min-h-target items-center gap-1 px-2">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>Back
  </button>;
  const footerStyle = { paddingBottom: footerPaddingBottom };
  const footerClass = 'space-y-2 bg-bg-surface px-gutter py-4 sm:px-gutter-wide';
  const bodyClass = 'min-h-0 flex-1 space-y-5 overflow-y-auto px-gutter pb-6 pt-2 sm:px-gutter-wide';

  // ── screens ──────────────────────────────────────────────────────────────
  let content: React.ReactNode;

  if (screen === 'main') {
    content = (
      <>
        <Bar headingRef={headingRef}
          left={<button type="button" onClick={cancel} className="btn-tertiary min-h-target px-2">Cancel</button>}
          right={<button type="button" onClick={() => setConfirmDelete(true)} aria-label="Remove medicine"
            className="flex size-target items-center justify-center rounded-full text-text-primary transition-colors hover:bg-severity-high/15 hover:text-severity-high"><BinIcon className="h-6 w-6" /></button>}
          title="Edit medicine"
          sub={dirty ? 'Unsaved changes' : null}
        />
        <div ref={bodyRef} className={bodyClass}>
          <div className="flex items-center gap-3">
            <ClassBadge large>{badge}</ClassBadge>
            <p className="min-w-0 flex-1 truncate text-[1.375rem] font-semibold text-text-primary">{name.trim() || original.name}</p>
          </div>

          <SettingsGroup raised>
            <Row label="Name" value={name.trim() || '–'} onOpen={() => { setDraftText(name); setScreen('name'); }} />
            <Row label="Type" value={typeLabel} extra={cls === undefined ? 'Counts as “Any”' : null} onOpen={() => setScreen('type')} />
            <Row label="Form" value={form} onOpen={() => { setOwnOpen(false); setDraftText(ownForm ? form : ''); setScreen('form'); }} />
            <Row label="Strength" value={strength.trim() || 'Not set'} onOpen={() => { setDraftText(strength); setScreen('strength'); }}
              note={strengthFlag ? `Check it fits the ${form.toLowerCase()}` : undefined} />
            <Row label="Usual dose" value={unitText(qty, unit)} extra={total(qty)} onOpen={() => setEditing('qty')} />
          </SettingsGroup>

          <div className="space-y-2">
            <p className="text-sm font-medium text-text-primary">From the leaflet <span className="font-normal text-text-secondary">· optional</span></p>
            <SettingsGroup raised>
              {hasIntake && <Row label="Max in one go" value={maxPerIntake ? unitText(maxPerIntake, unit) : 'Not set'} onOpen={() => setEditing('intake')} />}
              <Row label="Max in 24 hours" value={maxPerDay ? unitText(maxPerDay, unit) : 'Not set'} extra={maxPerDay ? total(maxPerDay) : null} onOpen={() => setEditing('day')} />
              <Row label="Time between doses" value={gap ? `${gap} ${gap === 1 ? 'hour' : 'hours'}` : 'Not set'} onOpen={() => setEditing('gap')} />
            </SettingsGroup>
          </div>

          {gl && <p className="text-xs text-text-secondary">{gl.lead} <span className="font-medium text-text-primary">{gl.days}</span> · {gl.tail}</p>}
          {nameChanged && othersNow.length > 0 && cls === initialClass && (
            <InlineNote>{`Your other ${name.trim()} entries are a different type, so earlier doses can’t be told apart. Open Type to match them.`}</InlineNote>
          )}
          {duplicate && <InlineNote id={dupId} tone="amber">{`You already have ${medLabel(duplicate)}. Change the form or the strength.`}</InlineNote>}
        </div>
        <div className={footerClass} style={footerStyle}>
          {(blocked || !dirty) && <p id={reasonId} className="text-center text-xs text-text-secondary">{blocked ?? 'Change something to save'}</p>}
          <button type="button" aria-disabled={saveDisabled} aria-describedby={blocked || !dirty ? reasonId : duplicate ? dupId : undefined} onClick={save} className="btn-primary w-full">Save</button>
        </div>
      </>
    );
  } else if (screen === 'type') {
    content = (
      <>
        <Bar headingRef={headingRef} left={back} title="Type" />
        <div ref={bodyRef} className={bodyClass}>
          <p id={`${nameId}-t`} className="text-base text-text-primary">{`What kind of medicine is ${name.trim() || original.name}? It's on the box or the leaflet.`}</p>
          <TypeList value={cls} chosen onChange={setCls} labelledBy={`${nameId}-t`} />
          {taken.days > 0 && (
            <InlineNote>{`When you save, ${taken.days === 1 ? 'the 1 day' : `the ${taken.days} days`} you took ${original.name} ${taken.days === 1 ? 'counts' : 'count'} ${guideKey ? 'under the new type' : 'under no monthly guide'}, including past months in Insights.${alsoOthers && others.length > 0 ? ' The other entries change type too.' : ''}${taken.ambiguousDoses > 0 ? ` ${taken.ambiguousDoses === 1 ? '1 earlier dose can’t' : `${taken.ambiguousDoses} earlier doses can’t`} be matched to this version.` : ''}`}</InlineNote>
          )}
          {others.length > 0 && (
            <button type="button" aria-pressed={alsoOthers} onClick={() => setAlsoOthers((v) => !v)}
              className={`tap-44-y flex min-h-[3.5rem] w-full items-center gap-3 rounded-control px-control-x text-left ${chipClass(alsoOthers)}`}>
              <span className="min-w-0 flex-1 text-base">{`Change the other ${original.name} ${others.length === 1 ? 'entry' : 'entries'} too`}</span>
              <ChipCheck selected={alsoOthers} />
            </button>
          )}
        </div>
        <div className={footerClass} style={footerStyle}><button type="button" onClick={() => setScreen('main')} className="btn-primary w-full">Done</button></div>
      </>
    );
  } else if (screen === 'form') {
    const pick = (f: string) => { if (f !== form) setStrengthChecked(false); setForm(f); setScreen('main'); };
    const applyOwn = () => { const f = draftText.trim(); if (!f) return; if (f !== form) setStrengthChecked(false); setForm(f); setScreen('main'); };
    const editingOwn = ownOpen;
    content = (
      <>
        <Bar headingRef={headingRef} left={editingOwn ? <button type="button" onClick={() => setOwnOpen(false)} className="btn-tertiary min-h-target px-2">Cancel</button> : back} title="Form" />
        <div ref={bodyRef} className={bodyClass}>
          {editingOwn ? (
            <div className="space-y-2">
              <label htmlFor={ownId} className="block text-sm text-text-primary">Your own form</label>
              <input id={ownId} autoFocus type="text" value={draftText} onChange={(e) => setDraftText(e.target.value)} className={inputClass} />
              <p className="text-xs text-text-secondary">Only for this medicine.</p>
            </div>
          ) : (
            <>
              {ownForm && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-text-secondary">Your own form</p>
                  <SettingsGroup raised>
                    <div role="radiogroup" aria-label="Your own form">
                      <button type="button" role="radio" aria-checked onClick={() => setScreen('main')} className="tap-44-y flex min-h-[3.5rem] w-full items-center gap-2 px-control-x text-left text-base text-text-primary">
                        <span className="min-w-0 flex-1">{form}</span><RadioDot selected />
                      </button>
                    </div>
                    <button type="button" onClick={() => { setDraftText(form); setOwnOpen(true); }} className="tap-44-y flex min-h-[3.5rem] w-full items-center px-control-x text-left text-base text-text-primary">Rename</button>
                  </SettingsGroup>
                </div>
              )}
              <div className="space-y-2">
                {ownForm && <p className="text-xs font-medium text-text-secondary">Standard forms</p>}
                <div role="radiogroup" aria-label="Form" className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
                  {STANDARD_FORMS.map((f) => {
                    const on = form === f;
                    return (
                      <button key={f} type="button" role="radio" aria-checked={on} onClick={() => pick(f)}
                        className={`tap-44-y flex min-h-[3.25rem] items-center gap-2 rounded-control px-control-x text-left text-base ${chipClass(on)}`}>
                        <span className="min-w-0 flex-1">{f}</span><RadioDot selected={on} />
                      </button>
                    );
                  })}
                </div>
                {!ownForm && <button type="button" onClick={() => { setDraftText(''); setOwnOpen(true); }} className="btn-tertiary min-h-target"><span aria-hidden="true">+ </span>Add a different form</button>}
              </div>
              <p className="text-xs text-text-secondary">{ownForm ? 'Picking a standard form replaces it. Saved when you tap Save on the medicine.' : 'Saved when you tap Save on the medicine.'}</p>
            </>
          )}
        </div>
        {editingOwn && (
          <div className={footerClass} style={footerStyle}>
            <button type="button" aria-disabled={!draftText.trim()} onClick={applyOwn} className="btn-primary w-full">Done</button>
          </div>
        )}
      </>
    );
  } else {
    const isName = screen === 'name';
    const done = () => {
      if (isName) { if (!draftText.trim()) return; setName(draftText); }
      else { setStrength(draftText); setStrengthChecked(true); }
      setScreen('main');
    };
    content = (
      <>
        <Bar headingRef={headingRef} left={<button type="button" onClick={() => setScreen('main')} className="btn-tertiary min-h-target px-2">Cancel</button>} title={isName ? 'Name' : 'Strength'} />
        <div ref={bodyRef} className={bodyClass}>
          <div className="space-y-2">
            <label htmlFor={isName ? nameId : strengthId} className="block text-xs font-medium text-text-secondary">{isName ? 'As it’s written on the box' : 'As printed on the box, e.g. 500/50 mg or 100 mg/5 ml'}</label>
            <input id={isName ? nameId : strengthId} type="text" value={draftText} onChange={(e) => setDraftText(e.target.value)} className={inputClass} />
            <p className="text-xs text-text-secondary">{isName ? 'Doses already logged keep the name they were logged under.' : 'A new strength applies from today; past doses keep theirs.'}</p>
          </div>
        </div>
        <div className={footerClass} style={footerStyle}>
          <button type="button" aria-disabled={isName && !draftText.trim()} onClick={done} className="btn-primary w-full">Done</button>
        </div>
      </>
    );
  }

  return (
    <div ref={rootRef} className="relative flex min-h-0 flex-1 flex-col" style={{ paddingBottom: inset }} onFocus={onFocus}>
      {content}

      {editing && (
        <ValueSheet
          key={editing}
          title={editing === 'qty' ? 'Usual dose' : editing === 'intake' ? 'Max in one go' : editing === 'day' ? 'Max in 24 hours' : 'Time between doses'}
          hint={editing === 'day' ? 'On the leaflet, under “How much to take”' : editing === 'gap' ? 'Shortest gap the leaflet allows between two doses' : `The ${pluralUnit(unit)} you take at once`}
          unit={editing === 'gap' ? 'hours' : pluralUnit(unit)}
          unitOne={editing === 'gap' ? 'hour' : unit}
          steps={editing === 'gap' ? GAP_STEPS : editing === 'day' ? DAY_STEPS : QTY_STEPS}
          value={editing === 'qty' ? qty : editing === 'intake' ? maxPerIntake : editing === 'day' ? maxPerDay : gap}
          fallback={editing === 'qty' ? 1 : 2}
          total={editing === 'gap' ? null : total}
          clearNote="Clear leaves it not set."
          onClear={editing === 'qty' ? undefined : () => { if (editing === 'intake') setMaxPerIntake(undefined); else if (editing === 'day') setMaxPerDay(undefined); else setGap(undefined); setEditing(null); }}
          onDone={(v) => { if (editing === 'qty') setQty(v); else if (editing === 'intake') setMaxPerIntake(v); else if (editing === 'day') setMaxPerDay(v); else setGap(v); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={confirmDiscard}
        danger
        title="Discard changes?"
        message={`You changed the ${sentence(changes)}. Nothing is saved until you tap Save.`}
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onConfirm={() => { setConfirmDiscard(false); onClose(); }}
        onCancel={() => setConfirmDiscard(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        danger
        title={`Remove ${medLabel(original)}?`}
        message={removeMessage}
        confirmLabel="Remove"
        cancelLabel="Keep it"
        onConfirm={() => { setConfirmDelete(false); onDelete(); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
