import { useState } from 'react';
import type { Attack, Medication } from '../types';
import { formatDate, formatTime, formatDuration, isoToLocalInput, localInputToIso } from '../utils/format';
import { attackDoseOutcomes, attackMaxSeverity, maxSeverity, type DoseOutcome } from '../utils/stats';
import { attackSide, SIDE_LABELS } from '../utils/laterality';
import { findMedication, unitsLabel } from '../utils/medGuardrails';
import { classLetter } from '../utils/medClasses';
import { peakShade } from '../utils/severity';
import { ClassBadge } from './ClassBadge';
import { VerdictMark } from './VerdictMark';
import { ConfirmDialog } from './ConfirmDialog';
import { BinIcon, SunriseIcon } from './icons';
import { IMPACT_OPTIONS } from '../utils/impact';
import { attackFirstDoses } from '../utils/medDisplay';
import { MedIcon, SideGlyph, SymptomIcon, TriggerIcon } from './drawnIcons';
import { isRetired } from '../utils/retired';
import { ChipSelector } from './ChipSelector';
import { chipClass} from '../utils/chipStyles';
import { ChipCheck } from './ChipCheck';
import { DateTimeField } from './DateTimeField';

interface Props {
  attack: Attack;
  onDelete: () => void;
  onClose: () => void;
  onAddUpdate?: () => void;
  /** Only passed for an attack still in progress. */
  onEndAttack?: () => void;
  /** Attack-level metadata only — never snapshots. Omit to hide the Edit
   *  details action entirely. */
  onSaveDetails?: (patch: Partial<Pick<Attack, 'triggers' | 'wokeWithMigraine' | 'end'>>) => void;
  triggerOptions?: string[];
  onAddTrigger?: (label: string) => void;
  /** The library — for each drug's type letter. */
  medications?: Medication[];
}

/**
 * Attack detail — the v3.10 design (docs/redesign-v3, "Logs list and attack
 * detail"), rebuilt 2026-10-26. Opened from a Logs row or the Today hero, as
 * a drill-down: it enters from the right behind a back chevron, with Delete
 * as a bin in the header (away from the footer, still confirmed).
 *
 * Top to bottom: how long / peak / side; the span; pain over time with each
 * dose as a lettered line; a card per drug with its two-hour outcome; where
 * it hurt at peak and at the last update; symptoms; the last three updates;
 * impact and what was noted as different. Footer: Edit and Add update (End
 * attack and Add update while it is still going).
 *
 * Rendered in `Sheet`'s `flush bareHeader` mode: it owns its top bar and pins
 * its own footer, which is more reliable above the home indicator than
 * `sticky` inside an iOS PWA scroll container. The body sits on `bg-base`
 * with `bg-surface` cards, the same layering as the tabs.
 */
export function AttackDetail({ attack, onDelete, onClose, onAddUpdate, onEndAttack, onSaveDetails, triggerOptions = [], onAddTrigger, medications = [] }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [allUpdates, setAllUpdates] = useState(false);

  if (editing && onSaveDetails) {
    return (
      <EditDetailsView
        attack={attack}
        triggerOptions={triggerOptions}
        onAddTrigger={onAddTrigger}
        onCancel={() => setEditing(false)}
        onSave={(patch) => { onSaveDetails(patch); setEditing(false); }}
      />
    );
  }

  const ongoing = attack.end === null;
  const start = attack.snapshots[0].time;
  const peak = attackMaxSeverity(attack);
  const side = attackSide(attack);
  const outcomes = attackDoseOutcomes(attack);
  const firstDoses = attackFirstDoses(attack, isRetired, formatDuration);
  const symptoms = [...new Set(attack.snapshots.flatMap((s) => s.symptoms ?? []))].filter((x) => !isRetired(x));
  const letterFor = (name: string) => classLetter(findMedication(medications, name)?.class);

  // "Wed 08:17 – Thu 08:26", or just the end time when it's the same day.
  const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short' });
  const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();
  const span = `${day(start)} ${formatTime(start)} – ${
    attack.end ? `${sameDay(start, attack.end) ? '' : `${day(attack.end)} `}${formatTime(attack.end)}` : 'now'
  }`;

  // Where it hurt: each area's worst, and its value at the last reading. An
  // area absent from the last reading is **not recorded**, never "gone" — the
  // update wizard starts blank, so the app cannot tell "it stopped" from "I
  // only logged the worst one" (the rule SeverityBreakdown was built on).
  const last = attack.snapshots[attack.snapshots.length - 1];
  const areaNames = [...new Set(attack.snapshots.flatMap((s) => Object.keys(s.areas)))];
  const areas = areaNames
    .map((name) => ({
      name,
      peak: Math.max(...attack.snapshots.map((s) => s.areas[name] ?? 0)),
      end: last.areas[name] ?? null,
    }))
    .sort((a, b) => b.peak - a.peak || a.name.localeCompare(b.name));

  // Updates, newest first, with the end as its own row.
  type Update = { key: string; time: string; title: string; more: string };
  const updates: Update[] = [
    ...(attack.end ? [{ key: 'end', time: attack.end, title: 'Attack ended', more: '' }] : []),
    ...[...attack.snapshots].reverse().map((s, i) => ({
      key: `${s.time}-${i}`,
      time: s.time,
      title: s.source === 'notification_no_change' ? `No change · pain ${maxSeverity(s)}` : `Pain ${maxSeverity(s)}`,
      more: [
        Object.entries(s.areas).sort((a, b) => b[1] - a[1]).map(([n, v]) => `${n} ${v}`).join(' · '),
        s.medication?.name ? `Took ${s.medication.name}` : null,
        s.reliefs.length ? `Tried ${s.reliefs.join(', ')}` : null,
        s.note ? `“${s.note}”` : null,
      ].filter(Boolean).join(' · '),
    })),
  ];
  const shownUpdates = allUpdates ? updates : updates.slice(0, 3);
  const spansDays = !sameDay(start, attack.end ?? new Date().toISOString());

  const impact = attack.impact !== undefined ? IMPACT_OPTIONS.find((o) => o.value === attack.impact)?.label : undefined;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col bg-bg-base">
      <div
        className="relative flex items-center px-2 py-2"
        style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="flex size-target items-center justify-center rounded-full text-text-primary transition-colors hover:bg-bg-raised"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h2 className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-base font-semibold text-text-primary">
          {formatDate(start)}
        </h2>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          aria-label="Delete attack"
          className="ml-auto flex size-target items-center justify-center rounded-full text-text-primary transition-colors hover:bg-severity-high/15 hover:text-severity-high"
        >
          <BinIcon className="h-6 w-6" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 pb-6 pt-2 sm:px-6">
        <div className="grid grid-cols-3 gap-2.5">
          <Tile value={formatDuration(start, attack.end)} label={ongoing ? 'so far' : 'long'} />
          <Tile value={String(peak)} label="peak pain" />
          <div className="flex flex-col items-center justify-center gap-1 rounded-card bg-bg-surface p-3 text-center">
            {side
              ? <SideGlyph side={side} className="h-[2.125rem] w-auto text-text-secondary" />
              : <span aria-hidden="true" className="h-[2.125rem]" />}
            <span className="text-xs text-text-secondary">{side ? SIDE_LABELS[side].toLowerCase() : 'side not recorded'}</span>
          </div>
        </div>
        <p className="-mt-1 text-center text-xs text-text-secondary">{span}</p>

        <PainChart attack={attack} letterFor={letterFor} />

        <h3 className="pt-2 text-lg font-semibold text-text-primary">Medication</h3>
        {outcomes.length === 0 ? (
          <div className="rounded-card bg-bg-surface p-4 text-xs text-text-secondary">Nothing taken for this attack.</div>
        ) : outcomes.map((o) => {
          const timing = firstDoses.find((d) => d.name === o.name)?.timing;
          const lib = findMedication(medications, o.name);
          const amount = o.amount ? unitsLabel(o.amount, lib) : o.dose;
          return (
            <div key={o.name} className="space-y-2 rounded-card bg-bg-surface p-4">
              <div className="flex items-center gap-3">
                <ClassBadge large>{letterFor(o.name) ?? <MedIcon name={o.name} dose={o.dose} className="h-4 w-4" />}</ClassBadge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary">{[o.name, amount].filter(Boolean).join(' · ')}</p>
                  {/* "at onset" for a dose on the first reading — the most
                      useful answer about acute treatment, not missing data. */}
                  <p className="text-xs text-text-secondary">
                    {timing === 'at onset' ? 'when the attack started' : `${timing} the attack started`}
                  </p>
                </div>
              </div>
              <p className={`flex items-start gap-2.5 rounded-inset bg-bg-base px-3.5 py-2.5 text-sm text-text-primary ${
                o.verdict === 'helped' ? 'ring-2 ring-inset ring-accent' : ''
              }`}>
                <VerdictMark verdict={o.verdict} className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{outcomeText(o)}</span>
              </p>
            </div>
          );
        })}

        {areas.length > 0 && (
          <>
            <h3 className="pt-2 text-lg font-semibold text-text-primary">Where it hurt</h3>
            <div className="overflow-hidden rounded-card bg-bg-surface [&>*+*]:border-t [&>*+*]:border-bg-border">
              <div className="flex items-center gap-3 px-4 py-2 text-xs text-text-secondary">
                <span className="flex-1" />
                <span className="w-11 text-center">peak</span>
                <span className="w-11 text-center">{ongoing ? 'now' : 'end'}</span>
              </div>
              {areas.map((z) => (
                <div key={z.name} className="flex min-h-14 items-center gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1 text-sm text-text-primary">{z.name}</span>
                  <ShadedValue value={z.peak} />
                  {z.end !== null ? <ShadedValue value={z.end} /> : (
                    <span className="flex h-9 w-11 items-center justify-center rounded-badge text-sm text-text-secondary ring-1 ring-inset ring-bg-border">
                      <span aria-hidden="true">–</span>
                      <span className="sr-only">Not recorded at the last update</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {symptoms.length > 0 && (
          <>
            <h3 className="pt-2 text-lg font-semibold text-text-primary">Symptoms</h3>
            <ul className="grid grid-cols-4 gap-2">
              {symptoms.map((sym) => (
                <li key={sym} className="flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-card bg-bg-surface px-1 py-2 text-center text-xs text-text-primary ring-1 ring-inset ring-bg-border">
                  <SymptomIcon name={sym} className="h-6 w-6 text-text-secondary" />
                  <span className="leading-tight [overflow-wrap:anywhere]">{sym}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <h3 className="pt-2 text-lg font-semibold text-text-primary">Updates</h3>
        <ol className="overflow-hidden rounded-card bg-bg-surface [&>*+*]:border-t [&>*+*]:border-bg-border">
          {shownUpdates.map((u) => (
            <li key={u.key} className="flex items-start gap-3 px-4 py-3">
              <span className="w-12 shrink-0 text-xs tabular-nums text-text-secondary">
                {spansDays && <span className="block">{day(u.time)}</span>}
                {formatTime(u.time)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-text-primary">{u.title}</span>
                {u.more && <span className="block text-xs text-text-secondary">{u.more}</span>}
              </span>
            </li>
          ))}
        </ol>
        {updates.length > 3 && (
          <button
            type="button"
            onClick={() => setAllUpdates((v) => !v)}
            className="min-h-target px-1 text-sm font-medium text-accent-light"
          >
            {allUpdates ? 'Show fewer' : `Show all ${updates.length} updates`}
          </button>
        )}

        {/* Read-only. Impact is asked once, inside 24h of the end, on Today;
            offering it here would invite an answer reconstructed days later,
            so an unanswered one shows nothing rather than an empty control. */}
        {(impact || attack.triggers.length > 0 || attack.wokeWithMigraine) && (
          <dl className="overflow-hidden rounded-card bg-bg-surface [&>*+*]:border-t [&>*+*]:border-bg-border">
            {impact && <Row term="Impact on your day" value={impact} />}
            {attack.triggers.length > 0 && <Row term="Different the day before" value={attack.triggers.join(', ')} />}
            {attack.wokeWithMigraine && <Row term="Started" value="Woke up with it" />}
          </dl>
        )}
      </div>

      {/* Footer — pinned above the home indicator. "Add update" is offered on
          past attacks too, so a retrospective log can be backfilled. Edit is
          metadata only (docs/editing-assessment.md) and waits until the
          attack has ended; while it runs, End attack takes its place. */}
      <div
        className="flex gap-2.5 bg-bg-base px-4 py-3 sm:px-6"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        {ongoing && onEndAttack ? (
          <button type="button" onClick={onEndAttack} className="btn-secondary flex-1">End attack</button>
        ) : onSaveDetails ? (
          <button type="button" onClick={() => setEditing(true)} className="btn-secondary flex-1">Edit</button>
        ) : null}
        {onAddUpdate && (
          <button type="button" onClick={onAddUpdate} className="btn-primary flex-[1.1]">Add update</button>
        )}
      </div>

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

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 rounded-card bg-bg-surface p-3 text-center">
      <span className="whitespace-nowrap text-[1.625rem] font-semibold leading-tight tabular-nums text-text-primary">{value}</span>
      <span className="text-xs text-text-secondary">{label}</span>
    </div>
  );
}

function ShadedValue({ value }: { value: number }) {
  return (
    <span
      className="flex h-9 w-11 items-center justify-center rounded-badge text-sm font-semibold tabular-nums text-text-primary ring-1 ring-inset ring-bg-border"
      style={{ background: peakShade(value) }}
    >
      {value}
    </span>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2">
      <dt className="min-w-0 flex-1 text-sm text-text-primary">{term}</dt>
      <dd className="max-w-[55%] text-right text-xs text-text-secondary">{value}</dd>
    </div>
  );
}

/** A dose's two-hour outcome, in a sentence. A missing reading is said as
 *  missing — never "didn't help", which would be a claim about the drug. */
function outcomeText(o: DoseOutcome): string {
  const dur = (ms: number) => formatDuration(new Date(0).toISOString(), new Date(ms).toISOString());
  switch (o.verdict) {
    case 'helped': return `Pain ${o.before} → ${o.after} at 2 hours · helped`;
    case 'not-helped': return `Pain ${o.before} → ${o.after} at 2 hours · ${o.after === o.before ? 'no change' : "didn't help"}`;
    case 'pending': return '2-hour reading to come';
    case 'no-reading': return o.next
      ? `No reading near 2 hours · next was ${o.next.severity} after ${dur(o.next.afterMs)}`
      : 'No reading near 2 hours';
  }
}

/**
 * Pain over time: the highest place at each update, evenly spaced (reminders
 * are answered when they are answered, so the gaps say more about the diary
 * than the attack), y pinned to 0…10 like every severity line in the app. Each
 * dose is a dashed line carrying its type letter. In accent rather than the
 * severity ramp — the numbers are printed in the cards below.
 */
function PainChart({ attack, letterFor }: { attack: Attack; letterFor: (name: string) => string | null }) {
  const values = attack.snapshots.map(maxSeverity);
  const n = values.length;
  const x = (i: number) => 26 + (n === 1 ? 150 : (i * 296) / (n - 1));
  const y = (v: number) => 100 - v * 9;
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v)}`).join(' ');
  const doses = attack.snapshots
    .map((s, i) => ({ i, name: s.medication?.name?.trim() }))
    .filter((m): m is { i: number; name: string } => !!m.name && !isRetired(m.name));
  const label = `Pain over time: ${values.join(', ')}${doses.length ? `. Doses: ${doses.map((m) => m.name).join(', ')}` : ''}`;

  return (
    <div className="space-y-1.5 rounded-card bg-bg-surface p-4">
      <h3 className="text-base font-semibold text-text-primary">Pain over time</h3>
      <svg viewBox="0 0 326 132" role="img" aria-label={label} className="block h-auto w-full">
        <text x="0" y="16" className="fill-text-secondary" fontSize="14" fontFamily="Lexend, sans-serif">10</text>
        <text x="8" y="104" className="fill-text-secondary" fontSize="14" fontFamily="Lexend, sans-serif">0</text>
        <line x1="26" y1="100" x2="326" y2="100" className="stroke-bg-border" strokeWidth="1.5" />
        {doses.map((m) => (
          <g key={`${m.i}-${m.name}`}>
            <line x1={x(m.i)} y1="8" x2={x(m.i)} y2="100" className="stroke-text-secondary" strokeWidth="1.2" strokeDasharray="3 3" />
            <rect x={x(m.i) - 11} y="106" width="22" height="22" rx="6" className="fill-bg-base stroke-accent" strokeWidth="1.5" />
            <text x={x(m.i)} y="122" textAnchor="middle" fontSize="13" fontWeight="700" className="fill-text-primary" fontFamily="Lexend, sans-serif">
              {letterFor(m.name) ?? '–'}
            </text>
          </g>
        ))}
        {n > 1
          ? <path d={d} fill="none" className="stroke-accent" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          : <circle cx={x(0)} cy={y(values[0])} r="4" className="fill-accent" />}
      </svg>
      <p className="text-xs text-text-secondary">Highest place at each update · lettered lines are doses</p>
    </div>
  );
}

/**
 * "Edit details" — attack-level metadata only.
 *
 * The scope is the whole design (docs/editing-assessment.md): the three
 * fields here describe the episode rather than any one reading, and all three
 * are already rewritten elsewhere in the app today (`endAttack` writes `end`;
 * `wokeWithMigraine` and `triggers` are set at creation and never revisited).
 * Nothing here can reach `snapshots`.
 *
 * `impact` is absent on purpose and must stay absent. It is asked once, in a
 * 24-hour window, and left unanswered for good if that passes — a level
 * reconstructed later is the recall bias a prospective diary exists to avoid,
 * and it counts in the disability figures where an absent answer does not.
 */
function EditDetailsView({ attack, triggerOptions, onAddTrigger, onCancel, onSave }: {
  attack: Attack;
  triggerOptions: string[];
  onAddTrigger?: (label: string) => void;
  onCancel: () => void;
  onSave: (patch: Partial<Pick<Attack, 'triggers' | 'wokeWithMigraine' | 'end'>>) => void;
}) {
  const [triggers, setTriggers] = useState<string[]>(attack.triggers);
  const [woke, setWoke] = useState<boolean>(attack.wokeWithMigraine ?? false);
  const [end, setEnd] = useState<string>(() => isoToLocalInput(attack.end ?? undefined));

  // An end time can never precede the last reading. Same clamp EndAttackDialog
  // applies, and for the same reason: the picker is minute-precision while
  // snapshots are second-precision, so choosing the exact minimum can land a
  // few seconds early.
  const minTime = attack.snapshots[attack.snapshots.length - 1].time;

  function save() {
    const patch: Partial<Pick<Attack, 'triggers' | 'wokeWithMigraine' | 'end'>> = {
      triggers,
      wokeWithMigraine: woke,
    };
    // Only when it actually changed. The picker is minute-precision and the
    // stored time is second-precision, so round-tripping an untouched value
    // would silently shave up to 59 seconds off the end of the attack every
    // time this screen was opened and saved.
    if (attack.end !== null && end && end !== isoToLocalInput(attack.end)) {
      const iso = localInputToIso(end);
      patch.end = iso < minTime ? minTime : iso;
    }
    onSave(patch);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="flex items-center gap-3 border-b border-bg-border bg-bg-surface px-4 sm:px-6 py-3"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full p-2 text-text-secondary transition-colors hover:text-text-primary"
          aria-label="Back"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h2 className="min-w-0 flex-1 truncate text-base font-medium text-text-primary">Edit details</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-6">
        <p className="text-xs text-text-secondary">
          This changes what's recorded about the attack as a whole. The readings themselves stay as they
          were logged.
        </p>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-text-primary">Onset</h3>
          {/* Ring on both states, never a border: a border would make the
              unpressed control 2px shorter, which is visible on a toggle
              sitting alone — exactly how this one was caught before. */}
          <button
            type="button"
            aria-pressed={woke}
            onClick={() => setWoke((w) => !w)}
            className={`flex w-full items-center gap-2 rounded-control px-4 py-3 text-left text-sm font-medium transition-colors ${chipClass(woke)}`}
          >
            <SunriseIcon className="h-4 w-4 shrink-0" />
            <span className="flex-1">Woke up with this migraine</span>
            <ChipCheck selected={woke} />
          </button>
        </div>

        {attack.end !== null && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-text-primary">Ended</h3>
            <DateTimeField
              label="End time"
              value={end}
              min={isoToLocalInput(minTime)}
              max={isoToLocalInput()}
              onChange={setEnd}
            />
            <p className="text-xs text-text-secondary">
              It can't be set before the last reading at {formatTime(minTime)}.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-text-primary">Triggers</h3>
          <ChipSelector
            options={triggerOptions}
            selected={triggers}
            onChange={setTriggers}
            onAddCustom={onAddTrigger}
            renderIcon={(t) => <TriggerIcon name={t} className="h-4 w-4" />}
          />
        </div>
      </div>

      <div
        className="flex flex-col gap-2 border-t border-bg-border bg-bg-surface px-4 sm:px-6 py-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <button type="button" onClick={save} className="btn-primary w-full rounded-control py-3 text-sm font-medium transition-colors">
          Save changes
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary w-full rounded-control py-3 text-sm font-medium transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
