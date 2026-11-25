import { useState } from 'react';
import type { Attack, Medication } from '../types';
import { NOTHING_UNUSUAL } from '../types';
import { formatDate, formatTime, formatDatetime, formatDuration, upToText } from '../utils/format';
import { attackDoseOutcomes, attackMaxSeverity, hasKnownDuration, looksTooShort, type DoseOutcome } from '../utils/stats';
import { attackSide, SIDE_LABELS } from '../utils/laterality';
import { unitsLabel } from '../utils/medGuardrails';
import { resolveDose } from '../utils/medResolve';
import { classLetter } from '../utils/medClasses';
import { editWindows, type EditWindows } from '../utils/editWindow';
import { END_IMPACT_LABELS } from '../utils/impact';
import { isRetired } from '../utils/retired';
import { useNowTick } from '../hooks/useNowTick';
import { ClassBadge } from './ClassBadge';
import { ConfirmDialog } from './ConfirmDialog';
import { BinIcon } from './icons';
import { MedIcon, MoonIcon, SideGlyph } from './drawnIcons';
import { MarkChips, SevBox } from './AttackDetailParts';
import { AttackPainChart } from './AttackPainChart';
import { AttackTimeline } from './AttackTimeline';
import { AttackDetailEditor, type DetailPatch, type EditField } from './AttackDetailEditor';

interface Props {
  attack: Attack;
  onDelete: () => void;
  onClose: () => void;
  onAddUpdate?: () => void;
  /** Only passed for an attack still in progress. */
  onEndAttack?: () => void;
  /** Attack-level metadata only — never snapshots. */
  onSaveDetails: (patch: DetailPatch) => void;
  /** Appends symptoms or reliefs as a new reading; never edits one. */
  onAddLater: (details: { symptoms: string[]; reliefs: string[] }) => void;
  symptomOptions?: string[];
  reliefOptions?: string[];
  triggerOptions?: string[];
  onAddSymptom?: (label: string) => void;
  onAddRelief?: (label: string) => void;
  onAddTrigger?: (label: string) => void;
  /** The library — for each drug's type letter and strength. */
  medications?: Medication[];
}

const weekday = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short' });
const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();
/** "Mon 10:26" */
const dayTime = (iso: string) => `${weekday(iso)} ${formatTime(iso)}`;

/**
 * Attack detail (rebuilt 2026-11-25 from the v4 board 07, as reworked in
 * review — see docs/decisions.md). A drill-down from a Logs row or the Today
 * hero, with Delete as a bin in the header, still confirmed.
 *
 * Top to bottom: how long / worst / side; start and end; pain over time; every
 * dose with the pain before and about two hours after; what it was like; where
 * it hurt; the full timeline. Footer: Add update (and End attack while it runs).
 *
 * **There is no edit screen.** Each editable thing is its own row, open for a
 * limited time (`editWindows`); after that it reads as text, and an unanswered
 * one disappears rather than asking.
 *
 * Rendered in `Sheet`'s `flush bareHeader` mode: it owns its top bar and pins
 * its own footer.
 */
export function AttackDetail({ attack, onDelete, onClose, onAddUpdate, onEndAttack, onSaveDetails, onAddLater, symptomOptions = [], reliefOptions = [], triggerOptions = [], onAddSymptom, onAddRelief, onAddTrigger, medications = [] }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState<EditField | null>(null);
  // The running length, and an edit window closing while the screen is open.
  useNowTick();

  const ongoing = attack.end === null;
  const start = attack.snapshots[0].time;
  const peak = attackMaxSeverity(attack);
  const side = attackSide(attack);
  const outcomes = attackDoseOutcomes(attack);
  const windows = editWindows(attack);
  const all = (key: 'symptoms' | 'reliefs') =>
    [...new Set(attack.snapshots.flatMap((s) => s[key] ?? []))].filter((x) => !isRetired(x));
  const symptoms = all('symptoms');
  const reliefs = all('reliefs');
  const letterFor = (name: string) => classLetter(resolveDose({ name }, medications).med?.class);

  const title = !hasKnownDuration(attack) || sameDay(start, attack.end!)
    ? formatDate(start)
    // "Mon 17 – Tue, Aug 18": the month once, so it fits between the buttons.
    : `${weekday(start)} ${new Date(start).getDate()} – ${formatDate(attack.end!)}`;

  // Where it hurt: each area's worst, and its value at the last reading. An
  // area absent from the last reading is **not recorded**, never "gone" — the
  // update wizard starts blank, so the app cannot tell "it stopped" from "I
  // only logged the worst one". "Last" is the last reading with any area, and
  // its time is printed: it can be hours before the end.
  const scored = attack.snapshots.filter((s) => Object.keys(s.areas).length > 0);
  const last = scored[scored.length - 1];
  const areas = [...new Set(scored.flatMap((s) => Object.keys(s.areas)))]
    .map((name) => ({
      name,
      worst: Math.max(...scored.map((s) => s.areas[name] ?? 0)),
      last: last?.areas[name] ?? null,
    }))
    .sort((a, b) => b.worst - a.worst || a.name.localeCompare(b.name));

  return (
    <div className="relative mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col bg-bg-base">
      <div
        className="flex items-center gap-2 px-3.5 pb-2 pt-3.5"
        style={{ paddingTop: 'calc(0.875rem + env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="flex size-target shrink-0 items-center justify-center rounded-full bg-bg-raised text-text-primary transition-colors hover:bg-bg-elevated"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h2 className="min-w-0 flex-1 text-center text-base font-semibold text-text-primary">{title}</h2>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          aria-label="Delete attack"
          className="flex size-target shrink-0 items-center justify-center rounded-full bg-bg-raised text-text-primary transition-colors hover:text-severity-high"
        >
          <BinIcon className="h-5 w-5" />
        </button>
      </div>

      {/* `relative` so the screen-reader-only text in here is positioned inside
          the scroller. Against the root it stuck out below the screen, and
          moving focus scrolled the whole app shell up to reach it. */}
      <div className="relative min-h-0 flex-1 space-y-3.5 overflow-y-auto px-gutter pb-6 pt-2 sm:px-gutter-wide">
        {/* The v4 board's flag (07-detail, `DetailFlagged`). Two ways out:
            Confirm here, or the bin in the header. Confirming writes
            `confirmedReal` only — the readings stay as logged — and the
            card, and the Logs banner, go away. */}
        {looksTooShort(attack) && (
          <div role="status" className="flex items-center gap-3 rounded-card bg-warning-surface p-card ring-1 ring-inset ring-warning/40">
            <span aria-hidden="true" className="flex size-compact flex-none items-center justify-center rounded-full bg-warning/20 text-warning">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              {/* Says the fact and hands over the choice (§9.3: user in control,
                  never imply fault). The board's "Looks too short to be
                  real" doubted the record itself; this doesn't. */}
              <span className="block text-[0.9375rem] font-semibold text-text-primary">Under 5 minutes</span>
              <span className="block text-xs text-text-secondary">If it was started by accident, you can delete it.</span>
            </span>
            <button
              type="button"
              onClick={() => onSaveDetails({ confirmedReal: true })}
              aria-label="Keep this attack"
              className="inline-flex min-h-target flex-none items-center gap-1.5 px-1 text-sm font-medium text-text-primary"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <path d="M5 12l5 5 9-10" />
              </svg>
              Keep it
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2.5">
          <LengthTile attack={attack} />
          <Tile label="worst" figure={<SevBox value={peak} className="h-9 w-11 text-lg" />} />
          <Tile
            label={side ? SIDE_LABELS[side].toLowerCase() : 'side not recorded'}
            figure={side
              ? <SideGlyph side={side} tinted className="h-9 w-auto" />
              : <span aria-hidden="true" className="text-lg text-text-secondary">–</span>}
          />
        </div>

        <Times attack={attack} windows={windows} onEdit={setEditing} />

        <AttackPainChart attack={attack} letterFor={letterFor} />

        <h3 className="pt-2 text-lg font-semibold text-text-primary">Medication</h3>
        {outcomes.length === 0 ? (
          <p className="rounded-card bg-bg-surface p-card text-xs text-text-secondary">Nothing taken for this attack.</p>
        ) : (
          <ul className="overflow-hidden rounded-card bg-bg-surface [&>*+*]:border-t [&>*+*]:border-bg-border">
            {outcomes.map((o, i) => (
              <DoseRow key={`${o.time}-${i}`} outcome={o} attack={attack} medications={medications} letter={letterFor(o.name)} />
            ))}
          </ul>
        )}

        <WhatItWasLike attack={attack} windows={windows} symptoms={symptoms} reliefs={reliefs} onEdit={setEditing} />

        {areas.length > 0 && (
          <>
            <h3 className="pt-2 text-lg font-semibold text-text-primary">Where it hurt</h3>
            <div className="overflow-hidden rounded-card bg-bg-surface [&>*+*]:border-t [&>*+*]:border-bg-border">
              <div className="flex items-center gap-3 px-4 py-2 text-xs text-text-secondary">
                <span className="flex-1">Area</span>
                <span className="w-14 text-center">Worst</span>
                {scored.length > 1 && <span className="w-16 text-center">Last logged</span>}
              </div>
              {areas.map((z) => (
                <div key={z.name} className="flex min-h-14 items-center gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1 text-sm text-text-primary">{z.name}</span>
                  <span className="flex w-14 justify-center"><SevBox value={z.worst} /></span>
                  {scored.length > 1 && (
                    <span className="flex w-16 justify-center">
                      {z.last !== null ? <SevBox value={z.last} /> : (
                        <span className="flex h-9 w-11 items-center justify-center rounded-badge text-sm text-text-secondary ring-1 ring-inset ring-bg-border">
                          <span aria-hidden="true">–</span>
                          <span className="sr-only">Not recorded at the last reading</span>
                        </span>
                      )}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {scored.length > 1 && (
              <p className="-mt-1.5 text-xs text-text-secondary">
                Last logged {sameDay(start, last.time) ? formatTime(last.time) : dayTime(last.time)}.
                {areas.some((z) => z.last === null) && ' A dash means not recorded then.'}
              </p>
            )}
          </>
        )}

        <h3 className="pt-2 text-lg font-semibold text-text-primary">Timeline</h3>
        <AttackTimeline attack={attack} medications={medications} letterFor={letterFor} />
      </div>

      {/* Footer — pinned above the home indicator. "Add update" is offered on
          past attacks too, so a retrospective log can be backfilled. The two
          sit side by side and stack when large text leaves no room. */}
      <div
        className="flex flex-wrap gap-2.5 bg-bg-base px-gutter py-3 sm:px-gutter-wide"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        {ongoing && onEndAttack && (
          <button type="button" onClick={onEndAttack} className="btn-secondary flex-1 whitespace-nowrap">End attack</button>
        )}
        {onAddUpdate && (
          <button type="button" onClick={onAddUpdate} className="btn-primary flex-1 whitespace-nowrap">Add update</button>
        )}
      </div>

      {editing && (
        <AttackDetailEditor
          field={editing}
          attack={attack}
          recorded={{ symptoms, reliefs }}
          symptomOptions={symptomOptions}
          reliefOptions={reliefOptions}
          triggerOptions={triggerOptions}
          onAddSymptom={onAddSymptom}
          onAddRelief={onAddRelief}
          onAddTrigger={onAddTrigger}
          onSave={onSaveDetails}
          onAddLater={onAddLater}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        danger
        title="Delete this attack?"
        message="This permanently removes the attack and all of its readings. This can't be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => { onDelete(); onClose(); }}
      />
    </div>
  );
}

/** Figure over label, the figures sharing one row height so the three tiles
 *  line up even when a label wraps. */
function Tile({ figure, label }: { figure: React.ReactNode; label: string }) {
  return (
    <div className="flex min-h-28 flex-col items-center gap-1.5 rounded-card bg-bg-surface px-2.5 pb-4 pt-5 text-center">
      <span className="flex h-9 items-center justify-center">{figure}</span>
      <span className="text-xs text-text-secondary">{label}</span>
    </div>
  );
}

const figureText = 'text-lg font-semibold tabular-nums leading-tight text-text-strong';

/** An unknown end never prints the placeholder as a length: it says the attack
 *  ended in sleep, or — once a wake time is given — the most it can have been. */
function LengthTile({ attack }: { attack: Attack }) {
  const start = attack.snapshots[0].time;
  if (attack.end !== null && !hasKnownDuration(attack)) {
    if (!attack.wokeAt) {
      return <Tile label="ended in sleep" figure={<MoonIcon className="h-8 w-8 text-accent-light" />} />;
    }
    return <Tile label="length" figure={<span className={figureText}>up to {upToText(start, attack.wokeAt)}</span>} />;
  }
  return (
    <Tile
      label={attack.end === null ? 'so far' : 'long'}
      figure={<span className={`whitespace-nowrap ${figureText}`}>{formatDuration(start, attack.end)}</span>}
    />
  );
}

/** Start and end. While the end (or wake time) can still be set, it is a row;
 *  afterwards, one line of text. */
function Times({ attack, windows, onEdit }: { attack: Attack; windows: EditWindows | null; onEdit: (f: EditField) => void }) {
  const start = attack.snapshots[0].time;
  const unknown = attack.end !== null && !hasKnownDuration(attack);
  const open = !!windows?.endOpen;
  const until = windows ? formatDate(windows.endUntil) : '';

  if (unknown) {
    return (
      <>
        <p className="text-center text-xs text-text-secondary">Started {dayTime(start)}. Gone when you woke up.</p>
        {(open || attack.wokeAt) && (
          <div className="overflow-hidden rounded-card bg-bg-surface">
            <Row label="When did you wake?" value={attack.wokeAt ? dayTime(attack.wokeAt) : 'Add'} onClick={open ? () => onEdit('wake') : undefined} />
          </div>
        )}
        {(open || attack.wokeAt) && (
          <p className="-mt-1.5 text-xs text-text-secondary">
            {attack.wokeAt && 'Left out of average length. '}
            {open && `Can be ${attack.wokeAt ? 'changed' : 'added'} until ${until}.`}
          </p>
        )}
      </>
    );
  }

  if (!open) {
    const end = attack.end === null ? 'now' : sameDay(start, attack.end) ? formatTime(attack.end) : dayTime(attack.end);
    return <p className="text-center text-xs text-text-secondary">{dayTime(start)} – {end}</p>;
  }

  return (
    <>
      <div className="overflow-hidden rounded-card bg-bg-surface [&>*+*]:border-t [&>*+*]:border-bg-border">
        <Row label="Started" value={dayTime(start)} />
        <Row label="Ended" value={dayTime(attack.end!)} onClick={() => onEdit('end')} />
      </div>
      <p className="-mt-1.5 text-xs text-text-secondary">The end time can be changed until {until}.</p>
    </>
  );
}

/** What describes the attack as a whole. Editable rows while the window is
 *  open; afterwards (and while ongoing) only what was answered, as text. */
function WhatItWasLike({ attack, windows, symptoms, reliefs, onEdit }: {
  attack: Attack;
  windows: EditWindows | null;
  symptoms: string[];
  reliefs: string[];
  onEdit: (f: EditField) => void;
}) {
  const open = !!windows?.answersOpen;
  const quality = attack.painQuality ?? [];
  const before = attack.triggers.filter((t) => t !== NOTHING_UNUSUAL && !isRetired(t)).join(', ')
    || (attack.triggers.includes(NOTHING_UNUSUAL) ? 'Nothing unusual' : '');
  const edit = (f: EditField) => (open ? () => onEdit(f) : undefined);

  const rows = [
    (open || attack.wokeWithMigraine) && (
      <Row key="woke" label="Woke up with it" value={attack.wokeWithMigraine ? 'Yes' : 'No'} onClick={edit('woke')} />
    ),
    (open || quality.length > 0) && (
      <Row key="quality" label="Felt like" value={quality.join(', ') || 'Add'} onClick={edit('quality')} />
    ),
    (open || symptoms.length > 0) && (
      <Row key="symptoms" label="Symptoms" value={symptoms.length ? <MarkChips kind="symptom" names={symptoms} /> : 'Add'} stacked={symptoms.length > 0} onClick={edit('symptoms')} />
    ),
    (open || reliefs.length > 0) && (
      <Row key="reliefs" label="Tried" value={reliefs.length ? <MarkChips kind="relief" names={reliefs} /> : 'Add'} stacked={reliefs.length > 0} onClick={edit('reliefs')} />
    ),
    // Read-only, always. Impact is asked once, live, as a step of
    // EndAttackForm; offering it here would invite an answer reconstructed
    // later, so an unanswered one shows nothing.
    attack.impact !== undefined && <Row key="impact" label="Stopped you" value={END_IMPACT_LABELS[attack.impact]} />,
    (open || before) && (
      <Row key="before" label="The two days before" value={before || 'Add'} onClick={edit('before')} />
    ),
  ].filter(Boolean);

  if (rows.length === 0) return null;
  return (
    <>
      <h3 className="pt-2 text-lg font-semibold text-text-primary">What it was like</h3>
      <div className="overflow-hidden rounded-card bg-bg-surface [&>*+*]:border-t [&>*+*]:border-bg-border">{rows}</div>
      {windows && (
        <p className="-mt-1.5 text-xs text-text-secondary">
          {open
            ? `Can be changed until ${formatDatetime(windows.answersUntil)}.`
            : `These answers closed on ${formatDate(windows.answersUntil)}.`}
        </p>
      )}
    </>
  );
}

/** A label and its value. With `onClick` it is a button with a chevron — the
 *  only sign a row can be changed, so a read-only row must have neither.
 *  `stacked` puts the value under the label (chips). */
function Row({ label, value, stacked = false, onClick }: {
  label: string;
  value: React.ReactNode;
  stacked?: boolean;
  onClick?: () => void;
}) {
  const body = stacked ? (
    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-sm text-text-secondary">{label}</span>
      {value}
    </span>
  ) : (
    <>
      <span className="min-w-0 flex-1 text-sm text-text-secondary">{label}</span>
      <span className={`max-w-[62%] text-right text-sm ${onClick ? 'font-medium text-accent-light' : 'text-text-primary'}`}>{value}</span>
    </>
  );
  const cls = 'flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left';
  if (!onClick) return <div className={cls}>{body}</div>;
  return (
    <button type="button" onClick={onClick} className={`${cls} transition-colors hover:bg-bg-raised`}>
      {body}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 text-text-secondary" aria-hidden="true">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );
}

/** One intake: what and when on the left; the worst pain at the time and at
 *  the reading nearest two hours on the right, with how long after that was.
 *  A missing reading is said as missing — never "didn't help", which would be
 *  a claim about the drug. */
function DoseRow({ outcome: o, attack, medications, letter }: {
  outcome: DoseOutcome;
  attack: Attack;
  medications: Medication[];
  letter: string | null;
}) {
  const snap = attack.snapshots.find((s) => s.time === o.time && s.medication?.name?.trim() === o.name);
  const lib = resolveDose(snap?.medication, medications).med;
  const at = sameDay(attack.snapshots[0].time, o.time) ? formatTime(o.time) : dayTime(o.time);
  const amount = o.amount ? unitsLabel(o.amount, lib) : o.dose;
  const hours = o.afterMs === null ? 0 : Math.round(o.afterMs / 3_600_000);
  const before = o.before > 0 ? o.before : '–';
  const pain = o.after !== null ? `Pain ${before} → ${o.after}` : o.verdict === 'pending' ? `Pain ${before} → …` : `Pain ${before}`;
  const under = o.after !== null
    ? `${hours} h later`
    : o.verdict === 'pending' ? '2 h to come' : 'no 2 h reading';
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <ClassBadge>{letter ?? <MedIcon name={o.name} dose={o.dose} className="h-4 w-4" />}</ClassBadge>
      {/* Wraps: with large text the pain scores move under the name instead of
          squeezing it to a letter per line. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-[9rem] flex-1">
          {/* An amount means `dose` is the strength-bearing text; without one,
              `dose` is all that was recorded and goes on the second line. */}
          <p className="text-sm font-medium text-text-primary [overflow-wrap:anywhere]">
            {[o.name, o.amount ? lib?.strength : null].filter(Boolean).join(' ')}
          </p>
          <p className="text-xs text-text-secondary">{amount ? `${amount} at ${at}` : `At ${at}`}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="whitespace-nowrap text-sm font-medium tabular-nums text-text-primary">{pain}</p>
          <p className="whitespace-nowrap text-xs text-text-secondary">{under}</p>
          {o.verdict === 'helped' && <p className="text-xs font-medium text-accent-light">helped</p>}
        </div>
      </div>
    </li>
  );
}
