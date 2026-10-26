import { useState } from 'react';
import type { Attack, Medication } from '../types';
import { formatDate, formatTime, formatDuration, isoToLocalInput, localInputToIso } from '../utils/format';
import { attackDoseOutcomes, attackMaxSeverity, type DoseOutcome } from '../utils/stats';
import { attackSide, SIDE_LABELS } from '../utils/laterality';
import { findMedication } from '../utils/medGuardrails';
import { COUNTED_CLASSES } from '../utils/medClasses';
import { ClassBadge } from './ClassBadge';
import { SeverityBreakdown } from './SeverityBreakdown';
import { SnapshotRow } from './SnapshotRow';
import { ConfirmDialog } from './ConfirmDialog';
import { BinIcon, SunriseIcon } from './icons';
import { IMPACT_SHORT } from '../utils/impact';
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
  /** The library — for each drug's class badge. */
  medications?: Medication[];
}

/**
 * Rendered inside `Sheet`'s `flush bareHeader` mode: this component owns its
 * own top bar and pins its own footer, rather than sitting as plain content
 * inside the generic sheet chrome.
 *
 * That's the same arrangement `LogForm`/`QuickUpdateForm` use, and for the
 * same reason — a footer that has to stay put above the home indicator is
 * more reliable flex-pinned than `sticky` inside an iOS PWA scroll container.
 */
export function AttackDetail({ attack, onDelete, onClose, onAddUpdate, onEndAttack, onSaveDetails, triggerOptions = [], onAddTrigger, medications = [] }: Props) {
  const maxSev = attackMaxSeverity(attack);
  const start = attack.snapshots[0];
  const firstDoses = attackFirstDoses(attack, isRetired, formatDuration);
  const outcomes = attackDoseOutcomes(attack);
  const side = attackSide(attack);
  const symptoms = [...new Set(attack.snapshots.flatMap((s) => s.symptoms ?? []))].filter((x) => !isRetired(x));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const ongoing = attack.end === null;

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

  // A per-row date is only worth showing once the attack actually touches
  // more than one calendar day — otherwise the header's date already covers
  // it and repeating it on every row is just noise.
  const allTimes = [...attack.snapshots.map((s) => s.time), ...(attack.end ? [attack.end] : [])];
  const spansMultipleDays = new Set(allTimes.map((t) => formatDate(t))).size > 1;
  // Newest first, with the attack's start pinned at the very bottom as the
  // timeline's anchor point — mirrors how the severity chart reads left
  // (oldest) to right (newest), just inverted for a scannable top-down list.
  const reversedSnapshots = [...attack.snapshots].reverse();

  return (
    <div className="flex flex-col flex-1 min-h-0 mx-auto w-full max-w-2xl">
      {/* Top app bar — Close (leading), title, Delete (trailing). Delete sits
          up here rather than among the footer actions deliberately: the
          footer is for what you came to do, and a destructive action next to
          the primary one is a mis-tap waiting to happen. */}
      <div
        className="relative flex items-center border-b border-border-subtle px-3 py-3 sm:px-4"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="tap-44 rounded-full bg-bg-raised/60 p-2 text-text-secondary hover:bg-bg-raised hover:text-text-primary transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {/* v3: the attack's own date and start time, rather than "Attack
            details" — the sheet's name is obvious, which attack it is isn't. */}
        <h2 className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-base font-medium text-text-primary">
          {formatDate(start.time)} · {formatTime(start.time)}
        </h2>

        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          aria-label="Delete attack"
          className="tap-44 ml-auto rounded-full bg-bg-raised/60 p-2 text-text-secondary hover:bg-severity-high/15 hover:text-severity-high transition-colors"
        >
          <BinIcon />
        </button>
      </div>

      {/* Body — the only scrolling region */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
      {/* **Three facts first, as cards** (v3, 2026-10-26): how bad at worst,
          how long, which side — the same three the Logs row leads with, so
          opening a row answers its questions in the same order. On the sheet's
          own `bg-surface`, so they are raised. Plain numbers, not severity
          colour: the figure carries the value, as on the row's badge. */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard value={String(maxSev)} label="highest pain" />
        <StatCard value={ongoing ? formatDuration(start.time, null) : formatDuration(start.time, attack.end)} label={ongoing ? 'so far' : 'long'} />
        <div className="flex flex-col items-center justify-center gap-1 rounded-[1.25rem] bg-bg-raised p-3 text-center">
          {side
            ? <SideGlyph side={side} className="h-[2.125rem] w-auto text-text-secondary" />
            : <span aria-hidden="true" className="h-[2.125rem]" />}
          <span className="text-xs text-text-secondary">{side ? SIDE_LABELS[side].toLowerCase() : 'side not recorded'}</span>
        </div>
      </div>

      {/* **Did it help, per drug** — its first dose, how long into the attack
          it was taken (the figure §5 of the dossier asks for), and its own
          two-hour reading by the rule Insights scores with. A missing reading
          is said as missing, never as "didn't help". */}
      {outcomes.length > 0 && (
        <div className="space-y-2.5">
          {outcomes.map((o) => {
            const cls = COUNTED_CLASSES.find((c) => c.value === findMedication(medications, o.name)?.class);
            const timing = firstDoses.find((d) => d.name === o.name)?.timing;
            return (
              <div key={o.name} className="flex items-center gap-3 rounded-[1.25rem] bg-bg-raised p-3.5">
                <ClassBadge>{cls ? cls.letter : <MedIcon name={o.name} dose={o.dose} className="h-4 w-4" />}</ClassBadge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary">{[o.name, o.dose].filter(Boolean).join(' · ')}</p>
                  <p className="text-xs text-text-secondary">{[timing, verdictLine(o)].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-text-secondary">{formatTime(o.time)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Symptoms as tiles, each with its drawn mark — read-only, so a static
          block with no press state. ICHD-3 criterion C lives here. */}
      {symptoms.length > 0 && (
        <div className="grid grid-cols-4 gap-2" aria-label="Symptoms">
          {symptoms.map((sym) => (
            <div key={sym} className="flex min-h-[4.75rem] flex-col items-center justify-center gap-1.5 rounded-[1.25rem] bg-bg-raised px-1 py-2 text-center text-xs text-text-primary">
              <SymptomIcon name={sym} className="h-6 w-6 text-text-secondary" />
              <span className="leading-tight [overflow-wrap:anywhere]">{sym}</span>
            </div>
          ))}
        </div>
      )}

      {(attack.triggers.length > 0 || attack.impact !== undefined || attack.wokeWithMigraine) && (
      <div className="space-y-1">
        {/* Each trigger carries its mark, the same way the symptoms do — a
            comma-joined line was the one list in the app that read as raw
            text. */}
        {attack.triggers.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {attack.triggers.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 text-xs text-text-secondary">
                <TriggerIcon name={t} />
                {t}
              </span>
            ))}
          </div>
        )}
        {/* **Read-only, and absent entirely when unanswered.** Impact is asked
            once, inside 24h of the end, on Today; offering it again here
            would invite an answer reconstructed days later. */}
        {attack.impact !== undefined && (
          <p className="text-xs text-text-secondary">
            Impact: <span className="text-text-primary">{IMPACT_SHORT[attack.impact]}</span>
          </p>
        )}
        {attack.wokeWithMigraine && (
          <p className="flex items-center gap-1.5 text-xs text-accent-light">
            <SunriseIcon className="h-4 w-4" />
            Woke up with this migraine
          </p>
        )}
      </div>
      )}

      {/* Severity chart */}
      {attack.snapshots.length >= 2 ? (
        <SeverityBreakdown attack={attack} />
      ) : (
        <p className="rounded-xl bg-bg-raised/60 px-4 py-6 text-center text-sm text-text-secondary">
          Add another update to see how this changes.
        </p>
      )}

      {/* Snapshot timeline — newest first; attack start anchors the bottom */}
      <div>
        <p className="text-xs uppercase tracking-wider font-medium text-text-secondary mb-3">Timeline</p>
        {attack.end && (
          <div className="flex gap-2">
            <div className="relative flex w-12 shrink-0 flex-col items-center">
              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-bg-border" />
              {spansMultipleDays && (
                <span className="relative bg-bg-surface px-1.5 py-1 text-[0.65rem] font-medium text-text-secondary whitespace-nowrap">{formatDate(attack.end)}</span>
              )}
              <span className="relative mt-1.5 bg-bg-surface px-1.5 py-1.5 text-xs tabular-nums text-text-secondary whitespace-nowrap">
                {formatTime(attack.end)}
              </span>
            </div>
            <div className="min-w-0 flex-1 pb-4">
              <div className="rounded-xl bg-bg-raised px-4 py-3">
                <p className="text-sm text-text-secondary">Attack ended</p>
              </div>
            </div>
          </div>
        )}
        {reversedSnapshots.map((snap) => (
          <SnapshotRow
            key={snap.time}
            snap={snap}
            dateLabel={spansMultipleDays ? formatDate(snap.time) : undefined}
          />
        ))}
      </div>

      </div>

      {/* Actions — flex-pinned to the bottom, above the home indicator.
          "Add update" is offered for past attacks too, so a retrospectively
          logged attack can be backfilled with the readings it actually had;
          only "End attack" is exclusive to one that's still running.

          "Edit details" takes the primary slot on a past attack, as the
          design always called for, and "Add update" steps down to secondary
          there. **It is hidden entirely while the attack is ongoing** (see
          docs/decisions.md's backlog, item 6) — Options 2/3 of the editing
          scope are still undecided, so on a live attack it read as an
          unfinished feature, and it made three buttons stack in the footer
          alongside Add update and End attack.

          What it edits is deliberately narrow — see
          docs/editing-assessment.md. Snapshots are the record of what was
          reported at the time; correcting one is a larger job that has to
          leave a visible trace, and impact is excluded outright because it is
          asked once inside a 24-hour window on purpose. */}
      <div
        className="flex flex-col gap-2 border-t border-bg-border bg-bg-surface px-4 sm:px-6 py-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        {onAddUpdate && (
          <button
            type="button"
            onClick={onAddUpdate}
            className={`${ongoing || !onSaveDetails ? 'btn-primary' : 'btn-secondary'} w-full rounded-xl py-3 text-sm font-medium transition-colors`}
          >
            Add update
          </button>
        )}
        {onSaveDetails && !ongoing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="btn-primary w-full rounded-xl py-3 text-sm font-medium transition-colors order-first"
          >
            Edit details
          </button>
        )}
        {onEndAttack && (
          <button
            type="button"
            onClick={onEndAttack}
            className="btn-secondary w-full rounded-xl py-3 text-sm font-medium transition-colors"
          >
            End attack
          </button>
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
            className={`flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors ${chipClass(woke)}`}
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
        <button type="button" onClick={save} className="btn-primary w-full rounded-xl py-3 text-sm font-medium transition-colors">
          Save changes
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary w-full rounded-xl py-3 text-sm font-medium transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

/** One figure over its label — the v3 stat card on the detail sheet. */
function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 rounded-[1.25rem] bg-bg-raised p-3 text-center">
      <span className="whitespace-nowrap text-[1.5rem] font-semibold leading-tight tabular-nums text-text-primary">{value}</span>
      <span className="text-xs text-text-secondary">{label}</span>
    </div>
  );
}

/** The two-hour reading, as a short clause. */
function verdictLine(o: DoseOutcome): string {
  switch (o.verdict) {
    case 'helped': return `helped · ${o.before} → ${o.after} at 2 hours`;
    case 'not-helped': return `didn't help · ${o.before} → ${o.after} at 2 hours`;
    case 'pending': return '2-hour reading to come';
    case 'no-reading': return 'no 2-hour reading';
  }
}
