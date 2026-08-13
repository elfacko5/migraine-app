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
  /**
   * Every dose heard, in spoken order, with names corrected against history.
   * `medication` is the first of these — the one the wizard's single field
   * holds. Any dose carrying a time of its own becomes a reading of its own,
   * because that is what a dose is: an event, not an attribute of the attack.
   */
  doses: VoiceDose[];
  note: string;
  // Human-readable "here's what we heard" lines for the prefill banner.
  matched: string[];
  /**
   * Whether a severity was actually heard, as opposed to `DEFAULT_SEVERITY`
   * being filled in. Siri's dictation stops on its own and routinely cuts
   * people off mid-sentence — usually before the severity, since it tends to
   * come last — so this is the common case, not an edge one.
   *
   * It matters because a guessed number is indistinguishable from a spoken one
   * once it is in `areas`, and this is a health record. The banner says so, and
   * the wizard won't offer its one-tap save until someone has looked at it.
   */
  severityHeard: boolean;
  /**
   * Minutes before now that the attack started, from Siri's answer to "when
   * did it start?". `null` means nothing usable was said, and the form keeps
   * its "Just now" default.
   *
   * Parsed from its own answer, never from the pain sentence: "an hour ago"
   * contains a number, and feeding it through the severity parser would record
   * a severity of one.
   */
  startMinutesAgo: number | null;
  /** "I woke up with it" — an onset flag, independent of the start time. */
  wokeWithMigraine: boolean;
  /**
   * The raw answer to "when did it start?", so the review screen can show what
   * was said when `startMinutesAgo` is null. Otherwise an answer the parser
   * didn't understand ("last night") silently displays as "Just now".
   */
  startedText: string;
}

// Used when nothing in the transcript gives a severity. Mid-scale on purpose:
// it is a placeholder to be corrected, so it should not read as either alarming
// or dismissible.
export const DEFAULT_SEVERITY = 5;

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

// Nobody says "occiput". The zone names are anatomical because they have to be
// stable (see the pain-areas section), but people describe where it hurts in
// ordinary words, so those map onto the same terms and are matched first —
// "the back of my head" has to win before "head" can match anything else.
const AREA_SYNONYMS: Array<{ pattern: RegExp; term: string }> = [
  { pattern: /\bback of (?:my |the )?head\b/g, term: 'Occiput' },
  { pattern: /\bbase of (?:my |the )?skull\b/g, term: 'Occiput' },
  { pattern: /\btop of (?:my |the )?head\b/g, term: 'Crown' },
  { pattern: /\bback of (?:my |the )?neck\b/g, term: 'Nape' },
  { pattern: /\bneck\b/g, term: 'Nape' },
  { pattern: /\bbrow\b/g, term: 'Forehead' },
  { pattern: /\bcheekbones?\b/g, term: 'Cheek' },
  { pattern: /\bsinus(?:es)?\b/g, term: 'Nose' },
];

/**
 * Soundex — the classic "sounds like" code: first letter, then consonants
 * mapped to digits with vowels dropped.
 *
 * Used only to rescue a mis-transcribed *pain area*. Dictation gets these wrong
 * in ways no amount of spelling comparison can follow — "jaw" came back as
 * "Joe" — but the candidate list is 8 fixed words, so matching on sound is safe
 * here in a way it wouldn't be against open vocabulary. It is stricter than
 * edit distance where it matters: "note" and "nose" share an edit but not a
 * sound, and "even" is nowhere near "eye".
 */
function soundex(word: string): string {
  const codes: Record<string, string> = {
    b: '1', f: '1', p: '1', v: '1',
    c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2',
    d: '3', t: '3',
    l: '4',
    m: '5', n: '5',
    r: '6',
  };
  const letters = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!letters) return '';
  let result = letters[0].toUpperCase();
  let previous = codes[letters[0]] ?? '';
  for (const letter of letters.slice(1)) {
    const code = codes[letter] ?? '';
    // 'h' and 'w' don't break a run of the same code; vowels do.
    if (code && code !== previous) result += code;
    if (letter !== 'h' && letter !== 'w') previous = code;
    if (result.length === 4) break;
  }
  return result.padEnd(4, '0');
}

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
  // Last resort: any bare 1–10 anywhere, spelled out or not.
  return firstNumberIn(text);
}

// Siri transcribes a spoken number as a word about as often as a digit — "right
// eye eight" rather than "right eye 8" — and which one you get isn't something
// the user can control or even see. Treating only digits as numbers meant a
// severity that was clearly said got recorded as the default instead.
const NUMBER_TOKEN = new RegExp(`\\b(10|[1-9]|${Object.keys(NUMBER_WORDS).join('|')})\\b`, 'i');

function firstNumberIn(text: string): number | null {
  const m = text.match(NUMBER_TOKEN);
  if (!m) return null;
  const digits = parseInt(m[1], 10);
  if (!Number.isNaN(digits)) return digits >= 1 && digits <= 10 ? digits : null;
  return NUMBER_WORDS[m[1].toLowerCase()] ?? null;
}

const COUNT_WORDS = `\\d+|${Object.keys(NUMBER_WORDS).join('|')}|a|an`;

// Clock hours go past ten, unlike severities.
const CLOCK_WORDS: Record<string, number> = { ...NUMBER_WORDS, eleven: 11, twelve: 12 };

function countFrom(token: string): number | null {
  if (token === 'a' || token === 'an') return 1;
  const n = parseInt(token, 10);
  return Number.isNaN(n) ? (NUMBER_WORDS[token] ?? null) : n;
}

/**
 * Turns Siri's answer to "when did it start?" into minutes before now.
 *
 * Kept deliberately narrow — the handful of ways people actually answer that
 * question out loud. Anything it doesn't recognise returns null and the form
 * keeps its "Just now" default rather than inventing a time, on the same
 * principle as the severity: a wrong timestamp in a health record is worse
 * than an obvious blank.
 */
export function parseStartOffset(text: string): number | null {
  const t = text.toLowerCase();
  if (/\bjust started\b|\bjust now\b|\bright now\b|^\s*now\b/.test(t)) return 0;
  if (/\bhalf an hour\b|\bhalf hour\b/.test(t)) return 30;

  // "About noon" is a clock time that contains no number, so nothing else here
  // catches it. Yesterday's if the hour hasn't come round yet today.
  const named = /\bnoon\b|\bmidday\b/.test(t) ? 12 : /\bmidnight\b/.test(t) ? 0 : null;
  if (named !== null) return minutesSince(named, 0);

  const hours = t.match(new RegExp(`\\b(${COUNT_WORDS})\\s+(?:and a half\\s+)?(?:hour|hr)`, 'i'));
  if (hours) {
    const n = countFrom(hours[1]);
    if (n !== null) return /and a half/.test(hours[0]) ? n * 60 + 30 : n * 60;
  }

  const mins = t.match(new RegExp(`\\b(${COUNT_WORDS})\\s+(?:minute|min)`, 'i'));
  if (mins) {
    const n = countFrom(mins[1]);
    if (n !== null) return n;
  }

  // A clock time — "at 7:30 am", "7.30", "at 8pm". Checked last so it can't
  // steal the number out of "two hours ago".
  const clock = t.match(/\b(\d{1,2})[:.](\d{2})\s*(a\.?m\.?|p\.?m\.?)?|\b(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)/i);
  if (clock) {
    let hour = parseInt(clock[1] ?? clock[4], 10);
    const minute = clock[2] ? parseInt(clock[2], 10) : 0;
    const suffix = (clock[3] ?? clock[5] ?? '').toLowerCase().replace(/\./g, '');
    if (hour > 23 || minute > 59) return null;
    if (suffix.startsWith('p') && hour < 12) hour += 12;
    if (suffix.startsWith('a') && hour === 12) hour = 0;

    const now = new Date();
    const at = new Date(now);
    at.setHours(hour, minute, 0, 0);
    // A time still ahead of us was meant as yesterday — you can't have started
    // a migraine later today.
    if (at.getTime() > now.getTime()) at.setDate(at.getDate() - 1);
    return Math.round((now.getTime() - at.getTime()) / 60_000);
  }

  // A spoken clock time — "last night around nine", "this morning at seven".
  // Siri writes the hour as a word here, and the part of day is what makes it
  // unambiguous, so one is required: a bare "nine" could be either end of the
  // day and guessing would put the attack twelve hours out.
  const pm = /\b(pm|p\.m\.|evening|tonight|afternoon|night)\b/i.test(t);
  const am = /\b(am|a\.m\.|morning)\b/i.test(t);
  const lastNight = /\blast night\b|\byesterday\b/i.test(t);
  if (pm || am || lastNight) {
    const spoken = t.match(new RegExp(`\\b(\\d{1,2}|${Object.keys(CLOCK_WORDS).join('|')})\\b`, 'i'));
    if (!spoken) return null;
    const parsed = parseInt(spoken[1], 10);
    let hour = Number.isNaN(parsed) ? CLOCK_WORDS[spoken[1].toLowerCase()] : parsed;
    if (hour === undefined || hour > 23) return null;
    if (pm && hour < 12) hour += 12;
    if (am && hour === 12) hour = 0;

    const now = new Date();
    const at = new Date(now);
    at.setHours(hour, 0, 0, 0);
    if (lastNight) at.setDate(at.getDate() - 1);
    if (at.getTime() > now.getTime()) at.setDate(at.getDate() - 1);
    return Math.round((now.getTime() - at.getTime()) / 60_000);
  }
  return null;
}

/** Minutes since the most recent occurrence of a clock time, today or yesterday. */
function minutesSince(hour: number, minute: number, daysBack = 0): number {
  const now = new Date();
  const at = new Date(now);
  at.setHours(hour, minute, 0, 0);
  if (daysBack) at.setDate(at.getDate() - daysBack);
  if (at.getTime() > now.getTime()) at.setDate(at.getDate() - 1);
  return Math.round((now.getTime() - at.getTime()) / 60_000);
}

// "I woke up with it" answers *when* it started without giving a time, and the
// form has a dedicated flag for exactly that.
const WOKE_RE = /\bwoke\b|\bwoken\b|\bwaking up\b|\bwoke up\b/i;

interface AreaResult {
  areas: Record<string, number>;
  /** Per area: was its severity actually said, or is it the default? */
  heard: Record<string, boolean>;
}

/**
 * `snapshot.areas` holds a severity per zone, and people speak that way too —
 * "right eye eight and forehead seven" is two readings, not one. So each
 * mentioned area takes the first number said *after* it and before the next
 * area is mentioned, which is the order these come out in naturally.
 *
 * A number said before any area ("eight out of ten, right eye and forehead")
 * lands in no forward window, so `fallback` — the severity read from the
 * sentence as a whole — covers it and every area shares it, which is what was
 * meant.
 */
function extractAreas(text: string, painAreas: string[], fallback: number | null): AreaResult {
  const lower = text.toLowerCase();
  const areas: Record<string, number> = {};
  const heard: Record<string, boolean> = {};

  // Every *occurrence* of every area term, in spoken order. Not just the first:
  // "left eye nine right eye seven" mentions the eye twice with different
  // severities, and taking only the first match collapsed them into one
  // reading that then had to cover both sides.
  const mentions: Array<{ term: string; start: number; end: number }> = [];
  const collect = (term: string) => {
    const t = term.toLowerCase();
    let from = 0;
    for (;;) {
      const i = lower.indexOf(t, from);
      if (i < 0) break;
      mentions.push({ term, start: i, end: i + t.length });
      from = i + t.length;
    }
    if (mentions.some((m) => m.term === term)) return;

    // Nothing literal: try what it sounds like, word by word, so a
    // mis-transcription still lands on the right zone *and* in the right place
    // — position matters, because it's what scopes the severity that follows.
    //
    // Only accepted when a number follows closely, which is the shape this is
    // rescuing ("Joe six" for "jaw six"). Sound alone is too generous —
    // "nap" and "nape" are the same code, and so are "check" and "cheek" — but
    // an ordinary word that happens to rhyme with a body part is very unlikely
    // to be followed by a severity.
    const code = soundex(term);
    for (const m of lower.matchAll(/[a-z]{3,}/g)) {
      const end = m.index + m[0].length;
      if (soundex(m[0]) !== code) continue;
      if (firstNumberIn(lower.slice(end, end + 15)) === null) continue;
      mentions.push({ term, start: m.index, end });
    }
    if (mentions.some((m) => m.term === term)) return;

    // Last resort: a prefix match with no position to scope from
    // ("occipital" for Occiput), which takes the sentence-wide severity.
    if (fuzzyIncludes(lower, t)) {
      mentions.push({ term, start: lower.length, end: lower.length });
    }
  };
  // Everyday phrasings first, so "the back of my head" is already claimed
  // before the anatomical terms are looked for.
  for (const { pattern, term } of AREA_SYNONYMS) {
    for (const m of lower.matchAll(pattern)) {
      mentions.push({ term, start: m.index, end: m.index + m[0].length });
    }
  }
  if (painAreas.includes('Nose')) collect('Nose');
  for (const term of AREA_TERMS) collect(term);
  mentions.sort((a, b) => a.start - b.start);

  // Every "left"/"right" in the sentence, so each mention can take the nearest
  // one. A fixed window either side isn't enough once two sided mentions sit
  // next to each other — in "left eye nine right eye", both side words fall
  // inside both windows, and only proximity tells them apart.
  // "write"/"rite" are how dictation renders "right" often enough to matter —
  // it turned "right jaw" into "Write jaw", which then read as no side at all
  // and selected both. Nothing else in a migraine description says "write".
  const sideWords: Array<{ side: 'left' | 'right'; start: number; end: number }> = [];
  for (const m of lower.matchAll(/\b(left|right|write|rite)\b/g)) {
    sideWords.push({
      side: m[1] === 'left' ? 'left' : 'right',
      start: m.index,
      end: m.index + m[1].length,
    });
  }
  const SIDE_RANGE = 20;

  // Each side word belongs to whichever mention it's nearest, rather than each
  // mention grabbing any side word in range. Otherwise the "right" in "right
  // eye seven forehead three" is close enough to reach the forehead as well,
  // and an unsided area silently becomes one-sided.
  const claimed = new Map<number, Set<'left' | 'right'>>();
  for (const word of sideWords) {
    let owner = -1;
    let bestDistance = Infinity;
    mentions.forEach((mention, i) => {
      const distance = word.end <= mention.start ? mention.start - word.end
        : word.start >= mention.end ? word.start - mention.end
        : 0;
      if (distance > SIDE_RANGE || distance >= bestDistance) return;
      bestDistance = distance;
      owner = i;
    });
    if (owner < 0) continue;
    if (!claimed.has(owner)) claimed.set(owner, new Set());
    claimed.get(owner)!.add(word.side);
  }

  // Neither side mentioned (or both) means both, so nothing is silently
  // dropped — the picker makes it trivial to correct.
  const sidesFor = (i: number): Array<'left' | 'right'> => {
    const sides = claimed.get(i);
    return sides && sides.size === 1 ? [...sides] : ['left', 'right'];
  };

  // A number stated for one area must never stand in for another. When
  // mentions carry *different* numbers of their own, the sentence-wide
  // fallback is switched off and an area without one is reported as not
  // heard — "Joe six left eye for left forehead nine" (jaw six, left eye
  // four) otherwise handed the jaw's six to the eye, inventing a severity
  // that reads exactly like a spoken one.
  //
  // The fallback still applies when *no* mention has its own number, which is
  // the "eight out of ten, right eye and forehead" case: one severity, and it
  // genuinely covers everything mentioned.
  const ownSeverities = mentions.map((mention, i) => {
    const next = mentions[i + 1];
    let window = lower.slice(mention.end, next ? next.start : lower.length);
    // A severity window stops where the sentence turns to medication. Numbers
    // after "I took" are quantities — "in the back of my head ten. I took two
    // tablets…" came back with "ten" as "then", and the last area helped itself
    // to the two out of "two tablets" and reported it as a severity.
    const meds = window.search(/\b(?:took|taken|taking|had)\b/);
    if (meds >= 0) window = window.slice(0, meds);
    return firstNumberIn(window);
  });
  // Distinct values, not just "any value": a *trailing* shared severity —
  // "forehead and eye hurt, it's a nine" — lands in the last mention's own
  // window purely because that's where the sentence ends, not because the
  // user aimed it at that area specifically. Left as "any", that one number
  // switched the fallback off for forehead, which then invented a default
  // and reported it as not heard despite the user having stated a severity
  // for both in one breath. Two *different* numbers is what actually proves
  // per-area intent (the Joe-six/forehead-nine case below) — one number
  // occupying one window is exactly the leading-fallback case, mirrored.
  const anyStatedPerArea = new Set(ownSeverities.filter((v) => v !== null)).size > 1;

  mentions.forEach((mention, i) => {
    const own = ownSeverities[i] ?? (anyStatedPerArea ? null : fallback);

    const names = mention.term === 'Nose'
      ? ['Nose']
      : sidesFor(i).map((s) => `${mention.term} ${s}`);

    for (const name of names.filter((n) => painAreas.includes(n))) {
      // An earlier mention wins, unless it had no severity and this one does —
      // repeating an area usually means correcting or elaborating on it.
      if (name in areas && (heard[name] || own === null)) continue;
      areas[name] = own ?? DEFAULT_SEVERITY;
      heard[name] = own !== null;
    }
  });

  return { areas, heard };
}

function extractFromList(text: string, options: string[]): string[] {
  return options.filter((opt) => fuzzyIncludes(text, opt));
}

export interface VoiceDose {
  name: string;
  dose: string;
  /**
   * When it was taken, from the words following it — "…two tablets of Treo
   * last night around six". Null when no time was said, in which case it
   * belongs to the reading being created rather than to one of its own.
   */
  minutesAgo: number | null;
}

const MED_FORMS = 'tablets?|pills?|capsules?|sachets?|puffs?|sprays?|drops?|shots?|injections?|doses?';
const QUANTITY = `\\d+|${Object.keys(NUMBER_WORDS).join('|')}|a|an`;
// Words that follow "took" without naming a drug — "took a shower", "took the
// usual". Cheaper than trying to recognise real drug names, which is a problem
// this parser has no business attempting.
// Number words are in here too: "took two tablets" must not name a drug "Two".
const NOT_A_MED = new Set([
  'the', 'some', 'my', 'it', 'this', 'that', 'them', 'another', 'more',
  'something', 'anything', 'nothing', 'painkillers', 'medication', 'medicine',
  'meds', 'shower', 'nap', 'rest', 'break', 'walk',
  // Connectives, so "took two tablets and then…" doesn't name a drug "and".
  'and', 'then', 'with', 'for', 'at', 'in', 'of', 'about', 'around',
  ...Object.keys(NUMBER_WORDS),
]);

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function quantityToNumber(token: string): string {
  const t = token.toLowerCase();
  if (t === 'a' || t === 'an') return '1';
  return String(NUMBER_WORDS[t] ?? token);
}

/**
 * A medication the user has taken before is matched by name against their own
 * history, which is by far the most reliable signal — people take the same few
 * things. But that alone can never pick up a drug named for the first time, so
 * the phrasing is matched too: "two tablets of Treo" gives both a name and a
 * dose, and "I took sumatriptan" gives a name.
 *
 * A guessed name is visible on the review screen and the raw transcript is
 * always kept, so a wrong guess is correctable rather than silent.
 */
// "two tablets of Treo", and "two *more* tablets of Treo" — the filler between
// the quantity and the form is how a second dose usually gets described.
// The optional number before the name is dictation debris, not a second
// quantity: "two tablets of Treo" came back as "two tablets of three trail",
// and taking "three" as the drug's name threw the whole dose away, since a
// number word can't be a medication.
const DOSE_PATTERN = new RegExp(
  `\\b(${QUANTITY})\\s+(?:more\\s+|extra\\s+|additional\\s+|another\\s+)?(${MED_FORMS})\\s+(?:of\\s+)?(?:(?:${Object.keys(NUMBER_WORDS).join('|')}|\\d+)\\s+)?([a-z][a-z0-9-]{2,})`,
  'gi',
);

/**
 * Every dose mentioned, in the order spoken, each with the time attached to it.
 *
 * People describe a migraine's medication as a sequence — "two tablets last
 * night around six and then two more this morning at eleven" — and that is
 * two events, not one. Each dose's time is read from the words between it and
 * the next dose, so times can't bleed across.
 */
/**
 * A bare hour — "and then a tablet of Sumatriptan at six" — is ambiguous on its
 * own, which is why the *start* time refuses to guess at one. A dose isn't
 * ambiguous in the same way: it has to have been taken after the attack began
 * and before now, and that usually leaves exactly one candidate. Six o'clock,
 * for an attack that started at noon, can only be the evening.
 *
 * Where it doesn't leave exactly one, this returns null and the dose keeps
 * "no time given" rather than picking a side.
 */
function resolveBareHour(text: string, startMinutesAgo: number | null): number | null {
  const m = text.match(new RegExp(`\\b(?:at|around|about)\\s+(\\d{1,2}|${Object.keys(CLOCK_WORDS).join('|')})\\b`, 'i'));
  if (!m) return null;
  const parsed = parseInt(m[1], 10);
  const hour = Number.isNaN(parsed) ? CLOCK_WORDS[m[1].toLowerCase()] : parsed;
  if (hour === undefined || hour > 23) return null;

  const now = Date.now();
  const startMs = startMinutesAgo === null ? null : now - startMinutesAgo * 60_000;
  const candidates = new Set<number>();
  for (const h of new Set([hour % 12, (hour % 12) + 12, hour])) {
    for (const daysBack of [0, 1]) {
      const at = new Date();
      at.setHours(h, 0, 0, 0);
      at.setDate(at.getDate() - daysBack);
      const t = at.getTime();
      if (t <= now && (startMs === null || t >= startMs)) candidates.add(t);
    }
  }
  if (candidates.size !== 1) return null;
  return Math.round((now - [...candidates][0]) / 60_000);
}

function extractDoses(text: string, startMinutesAgo: number | null = null): VoiceDose[] {
  const matches = [...text.matchAll(DOSE_PATTERN)]
    .filter((m) => !NOT_A_MED.has(m[3].toLowerCase()));
  return matches.map((m, i) => {
    const from = m.index + m[0].length;
    const to = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const window = text.slice(from, to);
    return {
      name: titleCase(m[3]),
      dose: `${quantityToNumber(m[1])} ${m[2].toLowerCase()}`,
      minutesAgo: parseStartOffset(window) ?? resolveBareHour(window, startMinutesAgo),
    };
  });
}

function extractMedicationByPhrasing(text: string): { name: string; dose: string } | null {
  // "two tablets of Treo" — quantity, form, then the name.
  const [first] = extractDoses(text);
  if (first) return { name: first.name, dose: first.dose };

  // "took two tablets" — a dose with no name. Checked before the bare-name
  // pattern below, which would otherwise read "two" as the drug's name.
  const formOnly = text.match(new RegExp(`\\b(?:took|taken|taking|had)\\s+(${QUANTITY})\\s+(${MED_FORMS})`, 'i'));
  if (formOnly) {
    return { name: '', dose: `${quantityToNumber(formOnly[1])} ${formOnly[2].toLowerCase()}` };
  }

  // "I took sumatriptan" — a name with no dose stated.
  const tookNamed = text.match(/\b(?:took|taken|taking|had)\s+(?:some\s+)?([a-z][a-z0-9-]{2,})/i);
  if (tookNamed && !NOT_A_MED.has(tookNamed[1].toLowerCase())) {
    return { name: titleCase(tookNamed[1]), dose: '' };
  }
  return null;
}

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

/**
 * Corrects a mis-transcribed drug name against the user's own history.
 *
 * Dictation mangles medication names badly — they aren't dictionary words, and
 * "two tablets of Treo" came back as "two tablets of trail", which is too far
 * off for the prefix matching used everywhere else. But the candidate list is
 * tiny and personal (people take the same few things), so a much looser
 * comparison is safe here in a way it wouldn't be against a real drug index.
 *
 * The first letter still has to agree, and the edit distance has to be under
 * half the word — enough for trail→Treo, not enough to turn aspirin into it.
 */
function correctAgainstHistory(spokenName: string, recentMeds: Array<{ name: string; dose: string }>) {
  const spoken = spokenName.toLowerCase();
  let best: { name: string; dose: string } | null = null;
  let bestDistance = Infinity;
  for (const med of recentMeds) {
    const known = med.name.toLowerCase();
    if (!known || known[0] !== spoken[0]) continue;
    const distance = editDistance(spoken, known);
    if (distance > Math.ceil(Math.max(spoken.length, known.length) / 2)) continue;
    if (distance < bestDistance) { bestDistance = distance; best = med; }
  }
  return best;
}

function extractMedication(
  text: string,
  recentMeds: Array<{ name: string; dose: string }>
): { name: string; dose: string } | null {
  // A dose stated out loud is about *this* time, so it wins over a remembered
  // one — "two tablets of Treo" when Treo is usually one.
  const spoken = extractMedicationByPhrasing(text);

  // History first: a name the user has logged before beats anything guessed
  // from phrasing, and it brings their usual dose with it.
  for (const med of recentMeds) {
    if (med.name && fuzzyIncludes(text, med.name)) {
      return { name: med.name, dose: spoken?.dose || med.dose };
    }
  }

  // Then the same list again, but forgivingly, against whatever name was
  // actually spoken — this is what turns "trail" back into "Treo".
  if (spoken?.name) {
    const corrected = correctAgainstHistory(spoken.name, recentMeds);
    if (corrected) return { name: corrected.name, dose: spoken.dose || corrected.dose };
  }

  return spoken;
}

/**
 * `rawText` is what was said about the pain (and anything else volunteered);
 * `startedText` is the separate answer to "when did it start?", kept apart so
 * its numbers can't be mistaken for severities.
 */
export function parseVoiceEntry(rawText: string, opts: VoiceParseOptions, startedText = ''): VoiceDraft {
  const text = rawText.trim();
  const { areas, heard } = extractAreas(text, opts.painAreas, extractSeverity(text));
  const symptoms = extractFromList(text, opts.symptoms);
  const reliefs = extractFromList(text, opts.reliefs);
  const triggers = extractFromList(text, opts.triggers);
  const medication = extractMedication(text, opts.recentMeds);
  // Parsed before the doses, which use it to disambiguate a bare hour: a dose
  // must fall between the attack starting and now.
  const started = startedText.trim();
  const startMinutesAgo = started ? parseStartOffset(started) : null;

  // Correct each dose's name the same way the single medication is corrected,
  // so a second "trail" becomes Treo too.
  const doses: VoiceDose[] = extractDoses(text, startMinutesAgo).map((d) => {
    const corrected = correctAgainstHistory(d.name, opts.recentMeds);
    return corrected ? { ...d, name: corrected.name } : d;
  });

  const areaNames = Object.keys(areas);
  // Only "we heard every severity" earns the one-tap save. A mix means at least
  // one number in the record is invented, and the user has to look at it.
  const severityHeard = areaNames.length > 0 && areaNames.every((n) => heard[n]);

  const matched: string[] = [];
  if (areaNames.length) {
    // Annotated per area, because they can differ: never print a guessed
    // severity the way a heard one is printed — at a glance "Eye right (5)"
    // reads as something the user said.
    matched.push(`Pain areas: ${areaNames
      .map((n) => (heard[n] ? `${n} (${areas[n]})` : `${n} (${areas[n]} — not heard)`))
      .join(', ')}`);
  }
  if (symptoms.length) matched.push(`Symptoms: ${symptoms.join(', ')}`);
  if (reliefs.length) matched.push(`Reliefs: ${reliefs.join(', ')}`);
  if (triggers.length) matched.push(`Triggers: ${triggers.join(', ')}`);
  if (medication) matched.push(`Medication: ${medication.name}${medication.dose ? ` ${medication.dose}` : ''}`);

  // The onset flag can be answered by either question — "I woke up with it" is
  // as likely to arrive as a description as it is as a time.
  const wokeWithMigraine = WOKE_RE.test(started) || WOKE_RE.test(text);

  return {
    areas, symptoms, reliefs, triggers, medication, doses,
    // The start answer joins the note too, so nothing said is lost even when
    // the time itself wasn't understood.
    note: [text, started].filter(Boolean).join(' · '),
    matched, severityHeard, startMinutesAgo, wokeWithMigraine, startedText: started,
  };
}
