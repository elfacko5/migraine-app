import { useState } from 'react';
import type { Medication } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import { BinIcon } from './icons';

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
// Same shape as AttackDetail: own top bar (close · title · delete), one
// scrolling body, and a flex-pinned footer holding the primary action. The
// delete is trailing in the app bar rather than under Save for the reason
// recorded there — the footer is for what you came to do, and a destructive
// action beside the primary one is a mis-tap waiting to happen. Pinning Save
// also means it doesn't drift down the page as the body grows.
//
// Name + dose pair and the quantity quick-pick mirror MedicationInput, so a
// medication is entered the same way here as it is mid-attack.
export function MedicationEditor({ medication, kind, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(medication?.name ?? '');
  const [dose, setDose] = useState(medication?.dose ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Top app bar — close leading, delete trailing */}
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
          {medication ? 'Edit medication' : 'Add medication'}
        </span>

        {onDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete medication"
            className="ml-auto rounded-full bg-bg-raised/60 p-2 text-text-secondary hover:bg-severity-high/15 hover:text-severity-high transition-colors"
          >
            <BinIcon />
          </button>
        ) : (
          /* Keeps the title optically centred when adding, where there's
             nothing to delete. */
          <span className="ml-auto h-9 w-9" aria-hidden="true" />
        )}
      </div>

      {/* Body — the only scrolling region */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
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

      </div>

      {/* Save — flex-pinned above the home indicator, so it stays put however
          long the body gets. */}
      <div
        className="border-t border-bg-border bg-bg-surface px-4 sm:px-6 py-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => onSave({ name: name.trim(), dose: dose.trim() })}
          className="btn-primary w-full rounded-xl py-3 text-sm font-medium transition-colors disabled:opacity-40"
        >
          Save
        </button>
      </div>

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
