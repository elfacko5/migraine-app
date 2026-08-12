// Turns a raw dictated transcript (from the Siri Shortcut deep link — see
// the `voice` query param handling in App.tsx) into a best-effort draft for
// LogForm/QuickUpdateForm to prefill. This is deliberately low-precision:
// simple keyword/substring matching against the user's own chip lists, not
// real NLP. The raw transcript is always kept verbatim in `note` so nothing
// said is ever lost even when the structured parse misses something — the
// wizard still walks the user through every step to confirm before saving.

export interface VoiceDraft {
  areas: Record<string, number>;
  symptoms: string[];
  reliefs: string[];
  triggers: string[];
  medication: { name: string; dose: string } | null;
  note: string;
  // Human-readable "here's what we heard" lines for the prefill banner.
  matched: string[];
}

interface VoiceParseOptions {
  painAreas: string[];
  symptoms: string[];
  reliefs: string[];
  triggers: string[];
  recentMeds: Array<{ name: string; dose: string }>;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

// The sided PAIN_AREAS base terms (see useUserPrefs.ts) — 'Nose' has no side
// and is handled separately.
const AREA_TERMS = ['Forehead', 'Temple', 'Eye', 'Cheek', 'Jaw', 'Crown', 'Occiput', 'Nape'];

function sharedPrefixLen(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

// Minimum shared-prefix length before two words count as "close enough" —
// below this, short common words (a, me, my, an, in...) would trivially
// prefix-match all sorts of unrelated symptom/trigger names.
const MIN_STEM_MATCH = 4;

// Loose match: exact substring, or every word of `needle` has some word in
// `haystack` sharing at least a 4-letter prefix — catches "nauseous" for
// "Nausea", "sensitive to light" for "Light sensitivity", etc. without a
// real stemmer. Needle words shorter than that (e.g. "eye", "jaw") instead
// require an exact word match, since a short prefix is too easy to hit by
// accident.
function fuzzyIncludes(haystack: string, needle: string): boolean {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (h.includes(n)) return true;
  const hayWords = h.split(/[^a-z]+/).filter(Boolean);
  const needleWords = n.split(/[^a-z]+/).filter(Boolean);
  if (needleWords.length === 0) return false;
  return needleWords.every((nw) => {
    if (hayWords.includes(nw)) return true;
    if (nw.length < MIN_STEM_MATCH) return false;
    return hayWords.some((hw) => hw.length >= MIN_STEM_MATCH && sharedPrefixLen(nw, hw) >= MIN_STEM_MATCH);
  });
}

function extractSeverity(text: string): number | null {
  const explicit =
    text.match(/(?:severity|pain(?:\s+level)?|level)\D{0,10}(\d{1,2})/i) ??
    text.match(/(\d{1,2})\s*(?:\/|out of)\s*10/i);
  if (explicit) {
    const n = parseInt(explicit[1], 10);
    if (n >= 1 && n <= 10) return n;
  }
  for (const [word, val] of Object.entries(NUMBER_WORDS)) {
    const re = new RegExp(`(?:severity|pain|level)\\D{0,10}\\b${word}\\b`, 'i');
    if (re.test(text)) return val;
  }
  if (/\b(worst|unbearable|excruciating)\b/i.test(text)) return 10;
  if (/\b(severe|really bad|awful|intense)\b/i.test(text)) return 8;
  if (/\b(moderate|medium)\b/i.test(text)) return 5;
  if (/\b(mild|slight|light)\b/i.test(text)) return 3;
  // Last resort: any bare 1–10 number anywhere in the text.
  const bare = text.match(/\b([1-9]|10)\b/);
  return bare ? parseInt(bare[1], 10) : null;
}

function extractAreas(text: string, painAreas: string[]): Record<string, number> {
  const lower = text.toLowerCase();
  const severity = extractSeverity(text) ?? 5;
  const areas: Record<string, number> = {};

  if (fuzzyIncludes(lower, 'nose') && painAreas.includes('Nose')) areas['Nose'] = severity;

  for (const term of AREA_TERMS) {
    const termLower = term.toLowerCase();
    if (!fuzzyIncludes(lower, termLower)) continue;
    const idx = lower.indexOf(termLower);
    // A word within ~15 chars either side decides which side was meant;
    // mentioning neither (or both) applies the term to both sides so
    // nothing is silently dropped — the picker makes it trivial to correct.
    const windowText = lower.slice(Math.max(0, idx - 15), idx + termLower.length + 15);
    const hasLeft = /\bleft\b/.test(windowText);
    const hasRight = /\bright\b/.test(windowText);
    const leftName = `${term} left`;
    const rightName = `${term} right`;
    if (hasLeft && !hasRight) {
      if (painAreas.includes(leftName)) areas[leftName] = severity;
    } else if (hasRight && !hasLeft) {
      if (painAreas.includes(rightName)) areas[rightName] = severity;
    } else {
      if (painAreas.includes(leftName)) areas[leftName] = severity;
      if (painAreas.includes(rightName)) areas[rightName] = severity;
    }
  }
  return areas;
}

function extractFromList(text: string, options: string[]): string[] {
  return options.filter((opt) => fuzzyIncludes(text, opt));
}

function extractMedication(
  text: string,
  recentMeds: Array<{ name: string; dose: string }>
): { name: string; dose: string } | null {
  for (const med of recentMeds) {
    if (med.name && fuzzyIncludes(text, med.name)) return { name: med.name, dose: med.dose };
  }
  return null;
}

export function parseVoiceEntry(rawText: string, opts: VoiceParseOptions): VoiceDraft {
  const text = rawText.trim();
  const areas = extractAreas(text, opts.painAreas);
  const symptoms = extractFromList(text, opts.symptoms);
  const reliefs = extractFromList(text, opts.reliefs);
  const triggers = extractFromList(text, opts.triggers);
  const medication = extractMedication(text, opts.recentMeds);

  const matched: string[] = [];
  if (Object.keys(areas).length) {
    matched.push(`Pain areas: ${Object.entries(areas).map(([a, s]) => `${a} (${s})`).join(', ')}`);
  }
  if (symptoms.length) matched.push(`Symptoms: ${symptoms.join(', ')}`);
  if (reliefs.length) matched.push(`Reliefs: ${reliefs.join(', ')}`);
  if (triggers.length) matched.push(`Triggers: ${triggers.join(', ')}`);
  if (medication) matched.push(`Medication: ${medication.name}${medication.dose ? ` ${medication.dose}` : ''}`);

  return { areas, symptoms, reliefs, triggers, medication, note: text, matched };
}
