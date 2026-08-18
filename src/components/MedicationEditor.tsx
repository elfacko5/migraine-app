import { useState } from 'react';
import type { Medication } from '../types';
import { ConfirmDialog } from './ConfirmDialog';

const QTY_OPTIONS = ['1 tablet', '2 tablets', '3 tablets'];

interface Props {
  /** Absent when adding. */
  medication?: Medication;
  kind: Medication['kind'];
  onSave: (next: { name: string; dose: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

// Opened as a bottom sheet from the medications list — a modal detour, so it
// enters from the bottom behind a close X, unlike the Profile pages, which
// are a drill-down and slide in from the right behind a back chevron.
//
// Name + dose pair and the quantity quick-pick mirror MedicationInput, so a
// medication is entered the same way here as it is mid-attack.
export function MedicationEditor({ medication, kind, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(medication?.name ?? '');
  const [dose, setDose] = useState(medication?.dose ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="space-y-5">
      <p className="text-xs text-text-secondary">
        {kind === 'acute'
          ? 'Taken to treat an attack. Appears as a one-tap chip when you log medication.'
          : 'Taken daily, whether or not you have an attack. Kept out of attack logging.'}
      </p>

      <div className="space-y-2.5">
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Medication name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 min-w-0 rounded-lg bg-bg-raised border border-bg-border px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <input
            type="text"
            placeholder="Dose / strength"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            className="w-32 rounded-lg bg-bg-raised border border-bg-border px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary shrink-0">Qty:</span>
          {QTY_OPTIONS.map((qty) => (
            <button
              key={qty}
              type="button"
              onClick={() => setDose(qty)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                dose === qty
                  ? 'bg-accent/20 text-accent-light ring-1 ring-inset ring-accent/40'
                  : 'bg-bg-raised text-text-secondary ring-1 ring-inset ring-bg-border hover:text-text-primary'
              }`}
            >
              {qty}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={!name.trim()}
        onClick={() => onSave({ name: name.trim(), dose: dose.trim() })}
        className="btn-primary w-full rounded-xl py-3 text-sm font-medium transition-colors disabled:opacity-40"
      >
        Save
      </button>

      {/* Delete sits below the primary action and behind a confirm, and only
          exists when there's something to delete. Separated by a rule so it
          reads as a different kind of action, not a third button in a row. */}
      {onDelete && (
        <div className="border-t border-bg-border pt-5">
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-full rounded-xl border border-bg-border py-3 text-sm font-medium text-severity-high transition-colors hover:bg-bg-raised"
          >
            Delete medication
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        danger
        title="Delete this medication?"
        message={
          medication
            ? `${medication.name} will no longer be suggested when you log. Attacks that already record it are not affected.`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={() => { setConfirmDelete(false); onDelete?.(); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
