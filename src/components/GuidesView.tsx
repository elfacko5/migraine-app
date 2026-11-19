import { useState } from 'react';
import type { MedClass, MedGuides, Medication } from '../types';
import { classLetter } from '../utils/medClasses';
import { GUIDELINE, guideFor, type GuideKey } from '../utils/medGuardrails';
import { ClassBadge } from './ClassBadge';
import { ProfileSubPage } from './ProfileSubPage';
import { Chevron, SettingsGroup } from './settingsUi';
import { ValueSheet } from './ValueSheet';

// Monthly guides (frames 15e and 15e-2): one row per type the user has a
// medicine for, plus "Any attack medicine". Each row says which medicines count
// toward it and the days a month it is measured against; tapping opens one
// sheet to set it.
//
// **The number is pre-filled** (Q2): a guide nobody set is the guideline, and
// Clear puts it back there — `guideFor` is the only reader, so this screen,
// Today and Insights can never disagree. A gepant has no row: it has no
// guideline and counts toward nothing.
//
// **The wording on this screen is placeholder, taken from the frames.** The plan
// holds it for June to reword (Q2, Q7): it says nothing about doctors or
// reports that the app does not have, and it never reads as advice.

const ROWS: { key: GuideKey; label: string; one: string; cls: MedClass | null }[] = [
  { key: 'triptan', label: 'Triptans', one: 'triptan', cls: 'triptan' },
  { key: 'combination', label: 'Combination', one: 'combination painkiller', cls: 'combination' },
  { key: 'simple', label: 'Painkillers', one: 'painkiller', cls: 'simple' },
  { key: 'any', label: 'Any medicine', one: 'attack medicine', cls: null },
];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const daysText = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

interface Props {
  medications: Medication[];
  guides: MedGuides;
  onSetGuide: (key: GuideKey, days: number | undefined) => void;
  onClose: () => void;
}

export function GuidesView({ medications, guides, onSetGuide, onClose }: Props) {
  const [editing, setEditing] = useState<GuideKey | null>(null);
  const acute = medications.filter((m) => m.kind === 'acute');
  const namesOf = (cls: MedClass) => [...new Set(acute.filter((m) => m.class === cls).map((m) => m.name.trim()))];

  // Only the types there is a medicine for, then "Any", which always applies.
  const rows = ROWS.filter((r) => r.cls === null || namesOf(r.cls).length > 0).map((r) => ({
    ...r,
    sub: r.cls ? namesOf(r.cls).join(', ') : 'All types together',
    days: guideFor(r.key, guides),
  }));
  const open = editing ? rows.find((r) => r.key === editing) : null;

  return (
    <ProfileSubPage title="Monthly guides" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">Guideline days a month before overuse can start. Check these with your doctor.</p>
        <SettingsGroup raised>
          {rows.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setEditing(r.key)}
              aria-label={`${r.label}, ${r.sub}, ${daysText(r.days)} a month. Change`}
              className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-bg-elevated"
            >
              <ClassBadge large>{r.cls ? classLetter(r.cls) ?? '–' : '+'}</ClassBadge>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-text-primary">{r.label}</span>
                <span className="block truncate text-xs text-text-secondary">{r.sub}</span>
              </span>
              <span className="text-sm font-medium text-text-primary">{daysText(r.days)}</span>
              <Chevron />
            </button>
          ))}
        </SettingsGroup>
        <p className="text-xs text-text-secondary">Only types you have medicines for are listed. Lidd counts days; it never stops you logging.</p>
      </div>

      {open && (
        <ValueSheet
          key={open.key}
          title={`${open.label} days a month`}
          hint={`Shared by all ${open.one}s. Check it with your doctor.`}
          unit="days"
          unitOne="day"
          note="in a month"
          clearNote={`Clear goes back to the guideline: ${daysText(GUIDELINE[open.key])}.`}
          steps={DAYS.includes(open.days) ? DAYS : [...DAYS, open.days].sort((a, b) => a - b)}
          value={open.days}
          fallback={GUIDELINE[open.key]}
          total={null}
          onClear={() => { onSetGuide(open.key, undefined); setEditing(null); }}
          onDone={(v) => { if (v !== open.days) onSetGuide(open.key, v); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}
    </ProfileSubPage>
  );
}
