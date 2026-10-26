import type { Medication } from '../types';
import { COUNTED_CLASSES } from '../utils/medClasses';
import { MedIcon } from './drawnIcons';
import { ClassBadge } from './ClassBadge';
import { ProfileSubPage } from './ProfileSubPage';
import { Chevron, SettingsGroup } from './settingsUi';

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

/**
 * The row's leading mark. An acute medication with a type carries its class
 * letter — the same T / C / P badge Today's medication card counts it under,
 * so the two screens name it the same way. Anything without a class keeps
 * its form icon in the same frame, so every row's text starts at one edge.
 */
function MedBadge({ med }: { med: Medication }) {
  const cls = med.kind === 'acute' ? COUNTED_CLASSES.find((c) => c.value === med.class) : undefined;
  return (
    <ClassBadge>
      {cls ? cls.letter : <MedIcon name={med.name} dose={med.dose} className="h-4 w-4" />}
    </ClassBadge>
  );
}

// v3 (2026-10-26): each kind is one grouped card, the Settings menu's own
// shape. Rows are a single tap target with a chevron — this is a list you go
// into — and still carry no Delete of their own: two small buttons per row put
// a destructive action a thumb-width from a safe one on every line, so the
// delete stays inside the editor, behind a deliberate tap and a confirm.
//
// **Add is the group's last row**, not a full-width secondary button under it,
// so an empty list is still one card with one thing to do rather than a
// heading over a lone button.
export function MedicationsView({ medications, onEdit, onAddNew, onClose }: Props) {
  return (
    <ProfileSubPage title="My medications" onClose={onClose}>
      <div className="space-y-8">
        {(['acute', 'preventive'] as const).map((kind) => {
          const items = medications.filter((m) => m.kind === kind);
          return (
            <section key={kind} className="space-y-3">
              <div className="space-y-1">
                <h2 className="text-sm font-medium text-text-primary">{KIND_LABEL[kind]}</h2>
                <p className="text-xs text-text-secondary">{KIND_BLURB[kind]}</p>
              </div>

              <SettingsGroup raised>
                {items.map((med) => (
                  <button
                    key={med.id}
                    type="button"
                    onClick={() => onEdit(med)}
                    aria-label={`Edit ${med.name}`}
                    className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-bg-elevated"
                  >
                    <MedBadge med={med} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-text-primary">{med.name}</span>
                      {med.dose && <span className="block truncate text-xs text-text-secondary">{med.dose}</span>}
                    </span>
                    <Chevron />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => onAddNew(kind)}
                  className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm font-medium text-accent-light transition-colors hover:bg-bg-elevated"
                >
                  <span aria-hidden="true" className="flex h-[1.875rem] w-[1.875rem] shrink-0 items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                  Add {kind === 'acute' ? 'an acute' : 'a preventive'} medication
                </button>
              </SettingsGroup>
            </section>
          );
        })}
      </div>
    </ProfileSubPage>
  );
}
