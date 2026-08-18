// Shared medication display helpers. Lives here rather than inside
// SnapshotRow because the medications library renders the same rows in a
// second place — a drug that shows as 🫧 on the attack timeline has to show
// as 🫧 in the library, and two private copies would drift the first time a
// pattern is added.

// Best-effort form-icon detection from the medication's own name/dose text —
// not a real drug database, just enough to tell a soluble/effervescent
// tablet (e.g. Treo) apart from a swallowed one at a glance. Extend the
// patterns below as new forms come up; unmatched medications fall back to a
// plain tablet.
const MED_ICON_RULES: { pattern: RegExp; icon: string }[] = [
  { pattern: /\btreo\b|soluble|effervescent/i, icon: '🫧' },
  { pattern: /spray|nasal/i, icon: '💨' },
  { pattern: /inject|autoinjector|\bshot\b/i, icon: '💉' },
  { pattern: /suppository/i, icon: '🔻' },
  { pattern: /patch/i, icon: '🩹' },
];

export function medIcon(name: string, dose: string): string {
  const text = `${name} ${dose}`;
  return MED_ICON_RULES.find((r) => r.pattern.test(text))?.icon ?? '💊';
}

// Deterministic per-name color so different medications stay visually
// distinct across a timeline without needing a maintained name→color map.
const MED_COLOR_PALETTE = ['#9bb9a1', '#b07a3c', '#a65a52', '#a9bfad', '#c4b07f', '#87a98f', '#9a9384', '#c99a5e'];

export function medColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return MED_COLOR_PALETTE[hash % MED_COLOR_PALETTE.length];
}
