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
