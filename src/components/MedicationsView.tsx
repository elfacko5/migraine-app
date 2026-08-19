import type { Medication } from '../types';
import { MedIcon } from './drawnIcons';
import { ProfileSubPage } from './ProfileSubPage';

interface Props {
  medications: Medication[];
  onEdit: (med: Medication) => void;
  onAddNew: (kind: Medication['kind']) => void;
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

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

// Rows are a single tap target with a pencil at the trailing edge, rather
// than a row carrying its own Edit and Remove buttons. Two small buttons per
// row put a destructive action a thumb-width from a safe one on every line
// of the list; the delete now lives inside the editor, behind a deliberate
// tap and a confirm.
export function MedicationsView({ medications, onEdit, onAddNew, onClose }: Props) {
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

              {items.map((med) => (
                <button
                  key={med.id}
                  type="button"
                  onClick={() => onEdit(med)}
                  aria-label={`Edit ${med.name}`}
                  className="flex w-full items-center gap-3 rounded-xl border border-bg-border bg-bg-raised/40 px-4 py-3 text-left transition-colors hover:bg-bg-raised"
                >
                  <MedIcon name={med.name} dose={med.dose} className="h-5 w-5 shrink-0 text-text-secondary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text-primary">{med.name}</span>
                    {med.dose && <span className="block truncate text-xs text-text-secondary">{med.dose}</span>}
                  </span>
                  <PencilIcon />
                </button>
              ))}

              <button
                type="button"
                onClick={() => onAddNew(kind)}
                className="btn-secondary w-full rounded-xl py-2.5 text-sm font-medium transition-colors"
              >
                Add {kind === 'acute' ? 'an acute' : 'a preventive'} medication
              </button>
            </section>
          );
        })}
      </div>
    </ProfileSubPage>
  );
}
