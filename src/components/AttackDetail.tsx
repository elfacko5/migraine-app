import { useState } from 'react';
import type { Attack } from '../types';
import { formatDate, formatTime, formatDuration } from '../utils/format';
import { attackMaxSeverity } from '../utils/stats';
import { SeverityChart } from './SeverityChart';
import { SnapshotRow } from './SnapshotRow';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  attack: Attack;
  onDelete: () => void;
  onClose: () => void;
  onAddUpdate?: () => void;
}

export function AttackDetail({ attack, onDelete, onClose, onAddUpdate }: Props) {
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
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{formatDate(start.time)}</h2>
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
      <SeverityChart attack={attack} height={180} />

      {/* Snapshot timeline — newest first; attack start anchors the bottom */}
      <div>
        <p className="text-xs uppercase tracking-wider font-medium text-text-secondary mb-3">Timeline</p>
        {attack.end && (
          <div className="flex gap-3">
            <div className="relative flex flex-col items-center w-16 shrink-0">
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-bg-border" />
              {spansMultipleDays && (
                <span className="relative mb-1 text-[0.65rem] font-medium text-text-secondary whitespace-nowrap">{formatDate(attack.end)}</span>
              )}
              <span className="relative shrink-0 rounded-full bg-bg-raised border border-bg-border px-2.5 py-1 text-xs font-bold tabular-nums text-text-primary whitespace-nowrap">
                {formatTime(attack.end)}
              </span>
            </div>
            <p className="pt-1.5 pb-4 text-sm font-semibold text-accent-light">
              Attack ended
            </p>
          </div>
        )}
        {reversedSnapshots.map((snap, i) => (
          <SnapshotRow
            key={snap.time}
            snap={snap}
            isFirst={i === reversedSnapshots.length - 1}
            dateLabel={spansMultipleDays ? formatDate(snap.time) : undefined}
          />
        ))}
      </div>

      {/* Actions — Add update works for past attacks too, to backfill a
          retrospective log with more than one reading */}
      <div className="pt-2 border-t border-bg-border space-y-2">
        {onAddUpdate && (
          <button
            type="button"
            onClick={onAddUpdate}
            className="btn-primary w-full rounded-xl py-3 text-sm font-semibold transition-colors"
          >
            Add update
          </button>
        )}
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="btn-secondary w-full rounded-xl py-3 text-sm font-medium text-severity-high hover:bg-severity-high/10 transition-colors"
        >
          Delete attack
        </button>
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
