import type { Medication } from '../types';
import { classLetter } from '../utils/medClasses';
import { unitsLabel } from '../utils/medGuardrails';
import { ClassBadge } from './ClassBadge';
import { ProfileSubPage } from './ProfileSubPage';
import { Chevron, SettingsGroup } from './settingsUi';

interface Props {
  medications: Medication[];
  onEdit: (med: Medication) => void;
  onAddNew: (kind: Medication['kind']) => void;
  onClose: () => void;
}

// My medications — the v3.9 design (docs/redesign-v3), 2026-10-26. Two lists
// named for when the medicine is taken, "For an attack" and "Every day",
// rather than the clinical "acute" / "preventive"; the data model keeps its
// own words.
//
// Each row is a single tap target with a chevron, and carries no Delete of
// its own: two small buttons per row put a destructive action a thumb-width
// from a safe one on every line. Delete lives inside the editor, confirmed.

/** Lucide `calendar` — an every-day medicine, which has no overuse type. */
function DailyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-[1.125rem] w-[1.125rem]" aria-hidden="true">
      <path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" />
    </svg>
  );
}

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
  const sections = [
    { kind: 'acute' as const, title: 'For an attack', caption: null, add: 'Add a medication' },
    { kind: 'preventive' as const, title: 'Every day', caption: 'Preventive. Kept out of attack logging.', add: 'Add a daily medication' },
  ];

  return (
    <ProfileSubPage title="My medications" onClose={onClose}>
      <div className="space-y-8">
        {sections.map(({ kind, title, caption, add }) => {
          const items = medications.filter((m) => m.kind === kind);
          return (
            <section key={kind} className="space-y-3">
              <div className="space-y-1">
                <h2 className="text-[1.375rem] font-semibold text-text-primary">{title}</h2>
                {caption && <p className="text-xs text-text-secondary">{caption}</p>}
              </div>

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
                      {/* The type letter Today counts it under; "–" for an
                          attack medicine with no type, a calendar for a daily
                          one, which has none to give. */}
                      <ClassBadge large>
                        {kind === 'preventive' ? <DailyIcon /> : (classLetter(med.class) ?? '–')}
                      </ClassBadge>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-text-primary">{med.name}</span>
                        <span className="block truncate text-xs text-text-secondary">{doseLine(med)}</span>
                      </span>
                      <Chevron />
                    </button>
                  ))}
                </SettingsGroup>
              )}

              <button type="button" onClick={() => onAddNew(kind)} className="btn-secondary w-full">
                + {add}
              </button>
            </section>
          );
        })}
      </div>
    </ProfileSubPage>
  );
}
