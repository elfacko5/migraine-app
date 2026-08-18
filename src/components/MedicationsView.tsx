import { useState } from 'react';
import type { Medication } from '../types';
import { medIcon } from '../utils/medDisplay';
import { ConfirmDialog } from './ConfirmDialog';
import { ProfileSubPage } from './ProfileSubPage';

const QTY_OPTIONS = ['1 tablet', '2 tablets', '3 tablets'];

interface Props {
  medications: Medication[];
  onAdd: (med: Omit<Medication, 'id' | 'createdAt'>) => void;
  onUpdate: (id: string, patch: Partial<Omit<Medication, 'id' | 'createdAt'>>) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

const KIND_LABEL: Record<Medication['kind'], string> = {
  acute: 'Acute treatment',
  preventive: 'Preventive',
};

// Named rather than left blank: this screen is where someone meets the
// acute/preventive distinction for the first time, and an empty list with a
// bare "Add" button explains neither what goes here nor why it's split.
const KIND_BLURB: Record<Medication['kind'], string> = {
  acute: 'Taken to treat an attack. These appear as one-tap chips when you log medication.',
  preventive: 'Taken daily, whether or not you have an attack. Kept out of attack logging.',
};

export function MedicationsView({ medications, onAdd, onUpdate, onRemove, onClose }: Props) {
  const [editing, setEditing] = useState<Medication | null>(null);
  const [adding, setAdding] = useState<Medication['kind'] | null>(null);
  const [pendingRemove, setPendingRemove] = useState<Medication | null>(null);

  const acute = medications.filter((m) => m.kind === 'acute');
  const preventive = medications.filter((m) => m.kind === 'preventive');

  return (
    <ProfileSubPage title="My medications" onClose={onClose}>
      <div className="space-y-8">
        {(['acute', 'preventive'] as const).map((kind) => {
          const items = kind === 'acute' ? acute : preventive;
          return (
            <section key={kind} className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider font-medium text-text-secondary label-caps">
                  {KIND_LABEL[kind]}
                </p>
                <p className="text-xs text-text-secondary">{KIND_BLURB[kind]}</p>
              </div>

              {items.map((med) =>
                editing?.id === med.id ? (
                  <MedicationForm
                    key={med.id}
                    initial={med}
                    onCancel={() => setEditing(null)}
                    onSave={(next) => { onUpdate(med.id, next); setEditing(null); }}
                  />
                ) : (
                  <div
                    key={med.id}
                    className="flex items-center gap-3 rounded-xl border border-bg-border bg-bg-raised/40 px-4 py-3"
                  >
                    <span aria-hidden="true">{medIcon(med.name, med.dose)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">{med.name}</p>
                      {med.dose && <p className="truncate text-xs text-text-secondary">{med.dose}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setAdding(null); setEditing(med); }}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary ring-1 ring-inset ring-bg-border transition-colors hover:text-text-primary"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingRemove(med)}
                      aria-label={`Remove ${med.name}`}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-severity-high ring-1 ring-inset ring-bg-border transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                )
              )}

              {adding === kind ? (
                <MedicationForm
                  onCancel={() => setAdding(null)}
                  onSave={(next) => { onAdd({ ...next, kind }); setAdding(null); }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => { setEditing(null); setAdding(kind); }}
                  className="btn-secondary w-full rounded-xl py-2.5 text-sm font-medium transition-colors"
                >
                  Add {kind === 'acute' ? 'an acute' : 'a preventive'} medication
                </button>
              )}
            </section>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!pendingRemove}
        danger
        title="Remove this medication?"
        message={
          pendingRemove
            ? `${pendingRemove.name} will no longer be suggested when you log. Attacks that already record it are not affected.`
            : ''
        }
        confirmLabel="Remove"
        onConfirm={() => { if (pendingRemove) onRemove(pendingRemove.id); setPendingRemove(null); }}
        onCancel={() => setPendingRemove(null)}
      />
    </ProfileSubPage>
  );
}

// Name + dose pair and the quantity quick-pick mirror MedicationInput, so a
// medication is entered the same way here as it is mid-attack.
function MedicationForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Medication;
  onSave: (next: { name: string; dose: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [dose, setDose] = useState(initial?.dose ?? '');

  return (
    <div className="space-y-2.5 rounded-xl border border-bg-border bg-bg-raised/40 p-4">
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

      <div className="grid grid-cols-2 gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary rounded-lg py-2.5 text-sm font-medium transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => onSave({ name: name.trim(), dose: dose.trim() })}
          className="btn-primary rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  );
}
