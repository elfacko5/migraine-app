import type { Medication } from '../types';
import { classLetter } from '../utils/medClasses';
import { unitsLabel } from '../utils/medGuardrails';
import { ClassBadge } from './ClassBadge';
import { ProfileSubPage } from './ProfileSubPage';
import { Chevron, SettingsGroup } from './settingsUi';

interface Props {
  medications: Medication[];
  onEdit: (med: Medication) => void;
  onAddNew: () => void;
  onClose: () => void;
}

// My medications — the v3.9 design (docs/redesign-v3), 2026-10-26, less its
// "Every day" list, removed the same day on Sunny's call: the page lists only
// medicines taken for an attack. Preventives stored before then are kept in
// the data, just not shown or offered here.
//
// Each row is a single tap target with a chevron, and carries no Delete of
// its own: two small buttons per row put a destructive action a thumb-width
// from a safe one on every line. Delete lives inside the editor, confirmed.

/** "1 tablet · 50 mg · max 2 in 24 h" — one dose, then the one limit that
 *  bears on the next few hours, when the user entered it. */
function doseLine(med: Medication): string {
  return [
    unitsLabel(med.quantity ?? 1, med),
    med.strength,
    med.kind === 'acute' && med.maxPerDay ? `max ${med.maxPerDay} in 24 h` : null,
  ].filter(Boolean).join(' · ') || med.dose;
}

export function MedicationsView({ medications, onEdit, onAddNew, onClose }: Props) {
  const items = medications.filter((m) => m.kind === 'acute');

  return (
    <ProfileSubPage title="My medications" onClose={onClose}>
      <section className="space-y-3">
        <h2 className="text-[1.375rem] font-semibold text-text-primary">For an attack</h2>

        {items.length > 0 && (
          <SettingsGroup raised>
            {items.map((med) => (
              <button
                key={med.id}
                type="button"
                onClick={() => onEdit(med)}
                aria-label={`Edit ${med.name}`}
                className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-bg-elevated"
              >
                {/* The type letter Today counts it under; "–" for a
                    medicine with no type. */}
                <ClassBadge large>{classLetter(med.class) ?? '–'}</ClassBadge>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text-primary">{med.name}</span>
                  <span className="block truncate text-xs text-text-secondary">{doseLine(med)}</span>
                </span>
                <Chevron />
              </button>
            ))}
          </SettingsGroup>
        )}

        <button type="button" onClick={onAddNew} className="btn-secondary w-full">
          + Add a medication
        </button>
      </section>
    </ProfileSubPage>
  );
}
