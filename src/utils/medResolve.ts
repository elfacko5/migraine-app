import type { Attack, MedGuides, Medication, Snapshot } from '../types';
import { isRetired } from './retired';
import { localDayKey } from './stats';

// Reading the medication library, without writing anything. Everything here is
// a pure function of the library and the diary, added in 0a of the medication
// flows and **not yet called by any screen or count** — the callers move in 0b
// and the flows after it. See docs/plan-medication-flows.md.

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

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/**
 * Which library entry a logged dose belongs to. Order:
 *  1. the dose's own `medId`, when that entry still exists;
 *  2. else the entries whose name matches — exactly one wins;
 *  3. else, among same-name entries, the one whose derived `dose` text equals
 *     the dose's own text — exactly one wins;
 *  4. else **ambiguous**: it is never silently given to the first entry.
 *
 * A `medId` whose entry has been deleted resolves to nothing and is **not**
 * ambiguous, and does not fall back to the name: the id said which one it was,
 * and that one is gone.
 */
export function resolveDose(
  dose: { name: string; dose?: string; medId?: string } | null | undefined,
  library: Medication[],
): ResolvedDose {
  if (!dose || !norm(dose.name)) return { med: null, ambiguous: false, candidates: [] };
  if (dose.medId) {
    const byId = library.find((m) => m.id === dose.medId);
    return byId
      ? { med: byId, ambiguous: false, candidates: [byId] }
      : { med: null, ambiguous: false, candidates: [] };
  }
  const named = library.filter((m) => norm(m.name) === norm(dose.name));
  if (named.length === 0) return { med: null, ambiguous: false, candidates: [] };
  if (named.length === 1) return { med: named[0], ambiguous: false, candidates: named };
  const sameDose = named.filter((m) => norm(m.dose) === norm(dose.dose));
  if (sameDose.length === 1) return { med: sameDose[0], ambiguous: false, candidates: sameDose };
  return { med: null, ambiguous: true, candidates: named };
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

// ── Guides (stored shape only; nothing reads them yet) ─────────────────────

const GUIDE_KEYS = ['triptan', 'combination', 'simple', 'any'] as const;

/** A stored `guides` value cleaned to what the type allows: only the four
 *  known keys, only positive finite numbers. Anything else is dropped, so a
 *  hand-edited or future-shaped value cannot reach a reader. */
export function cleanGuides(value: unknown): MedGuides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: MedGuides = {};
  for (const key of GUIDE_KEYS) {
    const n = (value as Record<string, unknown>)[key];
    if (typeof n === 'number' && Number.isFinite(n) && n > 0) out[key] = n;
  }
  return out;
}
