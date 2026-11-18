import type { Attack, MedClass, MedGuides, Medication, Snapshot } from '../types';
import { isRetired } from './retired';
import { localDayKey, type DoseCounting } from './stats';

// Reading the medication library, without writing anything. Everything here is
// a pure function of the library and the diary. Added in 0a of the medication
// flows; 0b moves the counts onto `resolveDose` / `countingOf`, and the screens
// that use `isLogged` / `daysTakenOf` arrive with the flows after it. See
// docs/plan-medication-flows.md and docs/plan-medication-0b.md.

// ── Form (migration M1, read-time) ─────────────────────────────────────────

/** The eight standard forms, in the order the design lists them. */
export const STANDARD_FORMS = [
  'Tablet', 'Melt', 'Capsule', 'Effervescent', 'Nasal spray', 'Injection', 'Suppository', 'Liquid',
] as const;

/**
 * The form a medicine is taken in. `form` when it is stored; otherwise derived
 * from the old `unitLabel` — empty or tablet → Tablet, capsule → Capsule,
 * spray or puff → Nasal spray, injection → Injection, anything else (sachet,
 * drop…) → that text as the medicine's own form. Never written back here: it
 * is written on the next save of that medicine, so an old record is not
 * rewritten by merely being read.
 */
export function formOf(med: Pick<Medication, 'form' | 'unitLabel'>): string {
  const stored = med.form?.trim();
  if (stored) return stored;
  const unit = med.unitLabel?.trim().toLowerCase();
  if (!unit || unit === 'tablet') return 'Tablet';
  if (unit === 'capsule') return 'Capsule';
  if (unit === 'spray' || unit === 'puff') return 'Nasal spray';
  if (unit === 'injection') return 'Injection';
  return med.unitLabel!.trim();
}

// ── Strength ───────────────────────────────────────────────────────────────

export interface ParsedStrength { value: number; unit: string }

const STRENGTH = /^(\d+(?:\.\d+)?)\s*(mg|mcg|µg|g|ml|iu)$/i;

/**
 * A strength that is **one number and one unit** — "50 mg", "50mg", "0.5 g" —
 * else `null`. Anything else ("500/50 mg", "100 mg/5 ml", "2 x 25 mg") is
 * refused, never guessed: a total made from half of "500/50 mg" would be an
 * invented figure, the same reason `doseUnits` never reads "50mg" as 50
 * tablets. A caller shows the count with no total when this returns null.
 */
export function parseStrength(text: string | null | undefined): ParsedStrength | null {
  const m = (text ?? '').trim().match(STRENGTH);
  if (!m) return null;
  const value = Number(m[1]);
  return value > 0 ? { value, unit: m[2].toLowerCase() === 'iu' ? 'IU' : m[2].toLowerCase() } : null;
}

// ── Which library entry a dose belongs to ──────────────────────────────────

export interface ResolvedDose {
  /** The one entry the dose belongs to, or null when none does or it is ambiguous. */
  med: Medication | null;
  /** More than one entry could own it and nothing separates them. */
  ambiguous: boolean;
  /** Every entry that could own it: one when `med` is set, two or more when
   *  ambiguous, none when the dose matches nothing in the library. */
  candidates: Medication[];
}

/** Trimmed, lower-cased, runs of spaces inside collapsed to one (Q4 item 1). */
const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Do two names name the same medicine? (`norm`: case, outer and doubled spaces.) */
export const sameMedName = (a: string | null | undefined, b: string | null | undefined) => norm(a) !== '' && norm(a) === norm(b);

/** Do two strength texts name the same strength? Where **both** parse as one
 *  number and one unit (`parseStrength`), they match when number and unit are
 *  equal — "50mg" and "50 mg" are the same. Otherwise the trimmed text is
 *  compared, case ignored. A unit is never converted ("0.05 g" is not
 *  "50 mg"): a different spelling of another unit can only fail to match,
 *  which leaves a dose ambiguous rather than giving it to the wrong entry. */
export function sameStrengthText(a: string | null | undefined, b: string | null | undefined): boolean {
  const pa = parseStrength(a);
  const pb = parseStrength(b);
  if (pa && pb) return pa.value === pb.value && pa.unit === pb.unit;
  return norm(a) === norm(b);
}

/**
 * Which library entry a logged dose belongs to. Order:
 *  1. the dose's own `medId`, when that entry exists;
 *  1b. **a `medId` that matches no entry is not an answer: it falls through to
 *     the name.** The diary can reach a device before the medication list does
 *     (they sync and merge separately), so a dose stamped with an id this
 *     device has not received yet must still count by its name. A dose whose
 *     own entry was deleted therefore matches a same-name entry that still
 *     exists, and nothing at all when none does;
 *  2. else the entries whose name matches — exactly one wins;
 *  3. else, among same-name entries, the one whose dose text matches the
 *     dose's own (`sameStrengthText`: parsed strengths compare as a number and
 *     a unit, anything else as trimmed text) — exactly one wins;
 *  4. else **ambiguous**: it is never silently given to the first entry.
 */
export function resolveDose(
  dose: { name: string; dose?: string; medId?: string } | null | undefined,
  library: Medication[],
): ResolvedDose {
  if (!dose || !norm(dose.name)) return { med: null, ambiguous: false, candidates: [] };
  if (dose.medId) {
    const byId = library.find((m) => m.id === dose.medId);
    if (byId) return { med: byId, ambiguous: false, candidates: [byId] };
    // 1b: fall through to the name.
  }
  const named = library.filter((m) => norm(m.name) === norm(dose.name));
  if (named.length === 0) return { med: null, ambiguous: false, candidates: [] };
  if (named.length === 1) return { med: named[0], ambiguous: false, candidates: named };
  const sameDose = named.filter((m) => sameStrengthText(m.dose, dose.dose));
  if (sameDose.length === 1) return { med: sameDose[0], ambiguous: false, candidates: sameDose };
  return { med: null, ambiguous: true, candidates: named };
}

// ── Adding a medicine (commit 1, the add wizard) ───────────────────────────

/**
 * Is `candidate` the same medicine as an entry already in the library? Same
 * name (case and outer spaces ignored), same form (`formOf`, so an old record
 * that never stored one still compares as its derived form), and the same
 * strength (`sameStrengthText`: "50mg" and "50 mg" match, "0.05 g" does not).
 * A different form, or the same form at a different strength, is a different
 * medicine and is allowed. Strength falls back to the derived `dose` text on
 * an old record that has no `strength`.
 */
export function sameMedicine(
  a: Pick<Medication, 'name' | 'form' | 'unitLabel' | 'strength' | 'dose'>,
  b: Pick<Medication, 'name' | 'form' | 'unitLabel' | 'strength' | 'dose'>,
): boolean {
  if (!norm(a.name) || norm(a.name) !== norm(b.name)) return false;
  if (formOf(a).toLowerCase() !== formOf(b).toLowerCase()) return false;
  return sameStrengthText(a.strength ?? a.dose, b.strength ?? b.dose);
}

/** "Sumatriptan 50 mg tablet" — a medicine told back as name, strength, form. */
export const medLabel = (m: Pick<Medication, 'name' | 'form' | 'unitLabel' | 'strength' | 'dose'>) =>
  [m.name.trim(), (m.strength ?? m.dose)?.trim(), formOf(m).toLowerCase()].filter(Boolean).join(' ');

/** The library entry `candidate` duplicates, or null. The first, when several do. */
export function findDuplicate(
  candidate: Pick<Medication, 'name' | 'form' | 'unitLabel' | 'strength' | 'dose'>,
  library: Medication[],
): Medication | null {
  return library.find((m) => sameMedicine(candidate, m)) ?? null;
}

/**
 * Is the usual dose more units than the most the leaflet allows in 24 hours?
 * Only when both are set and positive: a missing limit says nothing. It is a
 * notice, never a block, and it is about the numbers typed in, not dosing.
 */
export function usualDoseExceedsMax(quantity: number | null | undefined, maxPerDay: number | null | undefined): boolean {
  if (typeof quantity !== 'number' || typeof maxPerDay !== 'number') return false;
  return quantity > 0 && maxPerDay > 0 && quantity > maxPerDay;
}

/**
 * The type to pre-select on the add wizard's type step for a name that already
 * has entries: the class they all share, else `undefined` (select nothing).
 * "Entries disagree" and "no entry" and "entries untyped" all give `undefined`:
 * a guess from one of two disagreeing entries would be the first one's class.
 */
export function sharedTypeForName(name: string, library: Medication[]): Exclude<MedClass, 'other'> | undefined {
  return typeOfName(name, library) ?? undefined;
}

// ── Editing a medicine (commit 3) ──────────────────────────────────────────

/** The unit each standard form writes. A form of the user's own writes "dose". */
export const FORM_UNIT: Record<string, string> = {
  Tablet: 'tablet', Melt: 'tablet', Capsule: 'capsule', Effervescent: 'tablet',
  'Nasal spray': 'spray', Injection: 'injection', Suppository: 'suppository', Liquid: 'dose',
};
export const unitForForm = (form: string): string => FORM_UNIT[form] ?? 'dose';

/** The way a form is taken: by mouth, or one of the others. A form of the
 *  user's own is its own way, since nothing is known about it. */
function wayOf(form: string): string {
  if (['Tablet', 'Melt', 'Capsule', 'Effervescent', 'Liquid'].includes(form)) return 'mouth';
  if (['Nasal spray', 'Injection', 'Suppository'].includes(form)) return form;
  return `own:${form.trim().toLowerCase()}`;
}

/** Should Strength be flagged to check after the form changed? Only when the
 *  form moves to another *way of taking it*: tablet ↔ melt or capsule is no
 *  flag, tablet ↔ nasal spray is (15f-2). */
export const strengthNeedsCheck = (before: string, after: string): boolean => wayOf(before) !== wayOf(after);

/** The same medicine, as an edit would leave it. */
export interface EditDraftShape { name: string; form: string; strength: string }

/**
 * The other entry an edit would turn this medicine into a twin of, or null.
 * **An entry that already matched before the edit does not count** (Q4 item 4):
 * an existing pair is never made worse and never trapped, so it can still be
 * renamed, changed or deleted.
 */
export function editMakesDuplicate(
  original: Medication,
  edited: EditDraftShape,
  library: Medication[],
): Medication | null {
  const after = { name: edited.name, form: edited.form, strength: edited.strength, dose: edited.strength };
  return library.find((m) => m.id !== original.id && sameMedicine(after, m) && !sameMedicine(original, m)) ?? null;
}

/** Same-name entries other than this one whose type differs from `cls` (Q10:
 *  versions of one drug share a type). Stopped entries are included. */
export function otherVersionsWithOtherType(
  original: Medication,
  cls: Exclude<MedClass, 'other'> | undefined,
  library: Medication[],
): Medication[] {
  return library.filter((m) => m.id !== original.id && sameMedName(m.name, original.name) && classOfEntry(m) !== cls);
}

// ── What a dose counts under (0b) ──────────────────────────────────────────

/** A class with the pre-v3 `'other'` read as no class at all. */
const classOfEntry = (m: Medication): Exclude<MedClass, 'other'> | undefined =>
  m.class === 'other' ? undefined : m.class;

/**
 * Where one logged dose is counted, from the entries `resolveDose` says it
 * could belong to. **Per dose, never "the first entry with that name".**
 *  - no entry at all (a typed-in drug, or a deleted one): **untyped** — counts
 *    under "Any" only;
 *  - every candidate shares one class: that class's bar if it is triptan /
 *    combination / simple, and "Any" unless it is a gepant (no guideline);
 *    "Not sure" or the old `other` is untyped;
 *  - candidates of **different** classes (old same-name pairs): in **no bar**,
 *    and under "Any" when at least one candidate is not a gepant. Nothing is
 *    given to the first entry.
 */
export function countingOf(
  dose: { name: string; dose?: string; medId?: string } | null | undefined,
  library: Medication[],
): DoseCounting {
  const { candidates } = resolveDose(dose, library);
  if (candidates.length === 0) return { bar: null, any: true, untyped: true };
  const classes = new Set(candidates.map(classOfEntry));
  if (classes.size === 1) {
    const [cls] = [...classes];
    if (cls === 'triptan' || cls === 'combination' || cls === 'simple') return { bar: cls, any: true, untyped: false };
    if (cls === 'gepant') return { bar: null, any: false, untyped: false };
    return { bar: null, any: true, untyped: true };
  }
  return { bar: null, any: candidates.some((m) => classOfEntry(m) !== 'gepant'), untyped: false };
}

/** `countingOf` for one library, remembering answers: a diary logs the same
 *  drug over and over, so each distinct (name, dose, id) is resolved once
 *  instead of rescanning the library for every snapshot. */
export function countingFor(library: Medication[]) {
  const cache = new Map<string, DoseCounting>();
  return (dose: { name: string; dose?: string; medId?: string }): DoseCounting => {
    const key = `${dose.medId ?? ''}|${norm(dose.name)}|${norm(dose.dose)}`;
    let c = cache.get(key);
    if (!c) { c = countingOf(dose, library); cache.set(key, c); }
    return c;
  };
}

/**
 * The class every library entry named `name` shares, for the per-name rows
 * (Insights, Today's attack mode). `undefined` = untyped or in no entry;
 * `null` = old same-name entries that **disagree**, so no limit can be said to
 * apply and no marker is drawn. Never the first entry's class.
 */
export function typeOfName(name: string, library: Medication[]): Exclude<MedClass, 'other'> | undefined | null {
  const named = library.filter((m) => norm(m.name) === norm(name));
  if (named.length === 0) return undefined;
  const classes = new Set(named.map(classOfEntry));
  return classes.size === 1 ? [...classes][0] : null;
}

/** `medication` with the library entry's id added, when exactly one entry owns
 *  it. Typed-in names that are not in the library, and ambiguous ones, come
 *  back unchanged: an id is only ever written when it is certain. */
export function stampMedId<M extends { name: string; dose?: string; medId?: string }>(
  medication: M | null,
  library: Medication[],
): M | null {
  if (!medication || medication.medId) return medication;
  const { med } = resolveDose(medication, library);
  return med ? { ...medication, medId: med.id } : medication;
}

/** `snapshot` with its dose stamped, or the same object when nothing changes. */
export function stampSnapshot<S extends { medication: Snapshot['medication'] }>(snapshot: S, library: Medication[]): S {
  const stamped = stampMedId(snapshot.medication, library);
  return stamped === snapshot.medication ? snapshot : { ...snapshot, medication: stamped };
}

// ── What a medicine has in the diary ───────────────────────────────────────

function* dosesInDiary(attacks: Attack[]): Generator<{ attackId: number; snap: Snapshot }> {
  for (const attack of attacks) {
    for (const snap of attack.snapshots) {
      const name = snap.medication?.name;
      if (!name || isRetired(name)) continue;
      yield { attackId: attack.id, snap };
    }
  }
}

/**
 * Has this medicine been logged? **Conservative: an ambiguous dose that it
 * could own counts as logged**, because this is what decides whether a delete
 * is "never logged" (nothing else changes) — and it must not say so about a
 * medicine that might have doses.
 */
export function isLogged(med: Medication, library: Medication[], attacks: Attack[]): boolean {
  for (const { snap } of dosesInDiary(attacks)) {
    const r = resolveDose(snap.medication, library);
    if (r.med?.id === med.id) return true;
    if (r.ambiguous && r.candidates.some((c) => c.id === med.id)) return true;
  }
  return false;
}

export interface DaysTaken {
  /** Distinct local days with a dose that resolves to this medicine. */
  days: number;
  /** Doses that could be this medicine or another of the same name. Not in `days`. */
  ambiguousDoses: number;
}

/** Distinct days this medicine was taken, over all of the diary — the "all 6
 *  days you took X" in the type-change warning. */
export function daysTakenOf(med: Medication, library: Medication[], attacks: Attack[]): DaysTaken {
  const days = new Set<string>();
  let ambiguousDoses = 0;
  for (const { snap } of dosesInDiary(attacks)) {
    const r = resolveDose(snap.medication, library);
    if (r.med?.id === med.id) days.add(localDayKey(new Date(snap.time)));
    else if (r.ambiguous && r.candidates.some((c) => c.id === med.id)) ambiguousDoses++;
  }
  return { days: days.size, ambiguousDoses };
}

// ── Guides (stored shape) ──────────────────────────────────────────────────

const GUIDE_KEYS = ['triptan', 'combination', 'simple', 'any'] as const;

/** A stored `guides` value cleaned to what the type allows: only the four
 *  known keys, only positive whole numbers (the same test `guideFor` applies, so the two
 *  guards agree and a decimal cannot be adopted and then ignored). Anything else is dropped, so a
 *  hand-edited or future-shaped value cannot reach a reader. */
export function cleanGuides(value: unknown): MedGuides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: MedGuides = {};
  for (const key of GUIDE_KEYS) {
    const n = (value as Record<string, unknown>)[key];
    if (typeof n === 'number' && Number.isInteger(n) && n > 0) out[key] = n;
  }
  return out;
}

/** `guides` with one type's days set, or removed (back to the guideline) when
 *  `days` is not a positive whole number. Never mutates; the same test
 *  `cleanGuides` and `guideFor` apply, so a number saved here is a number read. */
export function withGuide(guides: MedGuides, key: keyof MedGuides, days: number | undefined): MedGuides {
  const next: MedGuides = { ...guides };
  if (typeof days === 'number' && Number.isInteger(days) && days > 0) next[key] = days;
  else delete next[key];
  return next;
}
