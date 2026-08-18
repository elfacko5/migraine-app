import { useState } from 'react';
import type { Attack } from '../types';
import { formatDate, formatTime, formatDuration } from '../utils/format';
import { attackMaxSeverity } from '../utils/stats';
import { SeverityBreakdown } from './SeverityBreakdown';
import { SnapshotRow } from './SnapshotRow';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  attack: Attack;
  onDelete: () => void;
  onClose: () => void;
  onAddUpdate?: () => void;
  /** Only passed for an attack still in progress. */
  onEndAttack?: () => void;
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
export function AttackDetail({ attack, onDelete, onClose, onAddUpdate, onEndAttack }: Props) {
  const maxSev = attackMaxSeverity(attack);
  const start = attack.snapshots[0];
  const [confirmDelete, setConfirmDelete] = useState(false);

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
          className="rounded-full bg-bg-raised/60 p-2 text-text-secondary hover:bg-bg-raised hover:text-text-primary transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-base font-medium text-text-primary">
          Attack details
        </span>

        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          aria-label="Delete attack"
          className="ml-auto rounded-full bg-bg-raised/60 p-2 text-text-secondary hover:bg-severity-high/15 hover:text-severity-high transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>

      {/* Body — the only scrolling region */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-medium text-text-primary">{formatDate(start.time)}</h2>
        <p className="text-sm text-text-secondary">
          {attack.end
            ? formatDuration(start.time, attack.end) + ' duration'
            : 'Ongoing'}
          {' · '}max severity {maxSev}
        </p>
        {attack.triggers.length > 0 && (
          <p className="text-xs text-text-secondary mt-1">{attack.triggers.join(', ')}</p>
        )}
        {attack.wokeWithMigraine && (
          <p className="text-xs text-accent-light mt-1">🌙 Woke up with this migraine</p>
        )}
      </div>

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

          A past attack shows "Add update" as its primary action for now. The
          design calls for "Edit details" in that slot, with this demoted to
          secondary — that's parked until the scope of editing an existing
          attack is decided (there is no edit path today), so rather than
          ship a dead button the remaining action takes the primary role. */}
      <div
        className="flex flex-col gap-2 border-t border-bg-border bg-bg-surface px-4 sm:px-6 py-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        {onAddUpdate && (
          <button
            type="button"
            onClick={onAddUpdate}
            className="btn-primary w-full rounded-xl py-3 text-sm font-medium transition-colors"
          >
            Add update
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
        message="This permanently removes the attack and all of its snapshots. This can't be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => { onDelete(); onClose(); }}
      />
    </div>
  );
}
