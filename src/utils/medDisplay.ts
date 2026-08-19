// Shared medication display helpers. Lives here rather than inside
// SnapshotRow because the medications library renders the same rows in a
// second place — a drug that shows as 🫧 on the attack timeline has to show
// as 🫧 in the library, and two private copies would drift the first time a
// pattern is added.

// Best-effort *form* detection from the medication's own name/dose text —
// not a real drug database, just enough to tell a soluble/effervescent tablet
// (e.g. Treo) from a swallowed one at a glance. Extend the patterns as new
// forms come up; anything unmatched is a plain tablet.
//
// **This returns a key, not a mark.** The icons are drawn components in
// `drawnIcons.tsx` (they used to be emoji, and emoji broke the palette rule:
// a full-colour glyph makes the least important thing on a row the brightest
// on a screen built to stay quiet). Keeping the matching here means the
// "what form is this" question stays a plain function — importable from
// non-JSX code and readable on its own — while rendering stays a component.
export type MedForm = 'soluble' | 'spray' | 'injection' | 'suppository' | 'patch' | 'tablet';

const MED_FORM_RULES: { pattern: RegExp; form: MedForm }[] = [
  { pattern: /\btreo\b|soluble|effervescent|dispersible/i, form: 'soluble' },
  { pattern: /spray|nasal/i, form: 'spray' },
  { pattern: /inject|autoinjector|\bshot\b|subcutaneous/i, form: 'injection' },
  { pattern: /suppository/i, form: 'suppository' },
  { pattern: /patch|transdermal/i, form: 'patch' },
];

export function medForm(name: string, dose: string): MedForm {
  const text = `${name} ${dose}`;
  return MED_FORM_RULES.find((r) => r.pattern.test(text))?.form ?? 'tablet';
}

/** A drug, and when its *first* dose landed relative to the attack starting. */
export interface FirstDose {
  name: string;
  dose: string;
  /** "at onset" or "after 4h 59m". */
  timing: string;
}

// Each medication in an attack with the time from onset to its first dose.
//
// §5 of the dossier asks for drug, dose *and timing relative to onset* —
// "taken early" is the most actionable fact about acute treatment. Keyed by
// first dose, so a drug taken again later still reports the time that
// mattered. Retired entries are excluded; the card and the detail sheet both
// read snapshots directly, so nothing else filters them.
//
// **Both cases are labelled.** A dose recorded on the first reading says "at
// onset" rather than showing nothing: an absent offset read as missing
// information when it is in fact the most useful answer.
//
// Shared so the two callers can't drift — `AttackCard` uses only the name (a
// scanned row shouldn't carry a duration nobody asked for), `AttackDetail`
// prints the timing.
export function attackFirstDoses(
  attack: { snapshots: { time: string; medication: { name: string; dose: string } | null }[] },
  isRetired: (name: string) => boolean,
  formatDuration: (from: string, to: string) => string,
): FirstDose[] {
  const out: FirstDose[] = [];
  const start = attack.snapshots[0].time;
  const startMs = new Date(start).getTime();
  for (const snap of attack.snapshots) {
    const name = snap.medication?.name?.trim();
    if (!name || isRetired(name) || out.some((m) => m.name === name)) continue;
    const takenMs = new Date(snap.time).getTime();
    out.push({
      name,
      dose: snap.medication!.dose,
      timing: takenMs > startMs ? `after ${formatDuration(start, snap.time)}` : 'at onset',
    });
  }
  return out;
}
