import type { MedGuides, Medication } from '../types';
import { GUIDELINE, type GuideKey } from './medGuardrails';

// M3 — the one-time move of per-medicine limits into guides (0b of the
// medication flows; docs/plan-medication-0b.md section 2.4).
//
// **M3 only ever lowers a guide.** Per type, take the per-medicine
// `maxDaysPerMonth` values **below** the guideline; if there are any, the
// lowest becomes `guides[type]`. A limit at or above the guideline is listed
// and never copied: the guideline numbers are the ICHD-3 medication-overuse
// thresholds, and a one-time migration must not move a warning past them
// without the person seeing it. A gepant's limit has no guide to go in, and an
// untyped medicine's has none either: both stay inert and are listed.
//
// Pure: nothing here reads or writes storage. `useMedications` applies the
// result, and `scripts/med-checks/m3.mts` prints it as a plain table.

type CountedKey = Exclude<GuideKey, 'any'>;
const isKey = (c: unknown): c is CountedKey => c === 'triptan' || c === 'combination' || c === 'simple';

/** The device-local marker. Not synced: Export backs it up like any `hd_` key. */
export const M3_MARKER_KEY = 'hd_med_guides_m3';

export interface M3Result {
  /** 'run', or the reason M3 does nothing on this input. */
  gate: 'run' | 'empty-library' | 'guides-not-empty' | 'marker-set';
  /** The guides to store: `{}` unless `gate` is 'run' and something is below a guideline. */
  guides: MedGuides;
  /** One entry per `guides` value written, with where it came from. */
  writes: { type: CountedKey; value: number; guideline: number; from: { name: string; limit: number }[] }[];
  /** Limits at or above their guideline: "above the guideline, not copied". */
  notCopied: { name: string; type: CountedKey; limit: number; guideline: number }[];
  /** Limits with nowhere to go (gepant, untyped), and why. */
  inert: { name: string; limit: number; why: string }[];
  /** Whether the marker is set afterwards. */
  setsMarker: boolean;
}

export function planM3(items: Medication[], guides: MedGuides, markerSet: boolean): M3Result {
  const none = (gate: M3Result['gate'], setsMarker: boolean): M3Result =>
    ({ gate, guides: {}, writes: [], notCopied: [], inert: [], setsMarker });
  // An empty library is what a fresh install or a not-yet-synced device looks
  // like: do nothing and set NO marker, or M3 would never run once the real
  // list arrives.
  if (items.length === 0) return none('empty-library', false);
  if (markerSet) return none('marker-set', false);
  // Another device already wrote guides: never run over them, but remember M3
  // is done so a later clear is never refilled from stale per-medicine limits.
  if (Object.keys(guides).length > 0) return none('guides-not-empty', true);

  const below = new Map<CountedKey, { name: string; limit: number }[]>();
  const notCopied: M3Result['notCopied'] = [];
  const inert: M3Result['inert'] = [];
  for (const m of items) {
    const limit = m.maxDaysPerMonth;
    if (m.kind !== 'acute' || !limit || limit <= 0) continue;
    if (isKey(m.class)) {
      if (limit >= GUIDELINE[m.class]) notCopied.push({ name: m.name, type: m.class, limit, guideline: GUIDELINE[m.class] });
      else below.set(m.class, [...(below.get(m.class) ?? []), { name: m.name, limit }]);
    } else if (m.class === 'gepant') {
      inert.push({ name: m.name, limit, why: 'a gepant: guides has no gepant, so the number has nowhere to go' });
    } else {
      inert.push({ name: m.name, limit, why: 'no type set, so no guide to put it in' });
    }
  }
  const writes: M3Result['writes'] = [...below.entries()].map(([type, from]) => ({
    type, guideline: GUIDELINE[type], from, value: Math.min(...from.map((f) => f.limit)),
  }));
  const out: MedGuides = {};
  for (const w of writes) out[w.type] = w.value;
  return { gate: 'run', guides: out, writes, notCopied, inert, setsMarker: true };
}

/**
 * Run M3 against a stored library: sets the marker when the plan says to, and
 * returns the guides to keep (the stored ones when M3 wrote nothing). The
 * caller stores them **without** moving `updatedAt`: this is a migration, not
 * an edit by the person, so it must not make this device's list win a
 * last-write-wins merge it did not earn. A remote row that is newer and has no
 * guides keeps these (the merge's older-client rule), and an equal stamp pushes
 * them on the next sync.
 */
export function runM3(items: Medication[], guides: MedGuides, storage: Pick<Storage, 'getItem' | 'setItem'>): { guides: MedGuides; changed: boolean; plan: M3Result } {
  let markerSet = false;
  try { markerSet = storage.getItem(M3_MARKER_KEY) !== null; } catch { /* treat as unset */ }
  const plan = planM3(items, guides, markerSet);
  if (plan.setsMarker) { try { storage.setItem(M3_MARKER_KEY, '1'); } catch { /* the plan still applies for this run */ } }
  const changed = plan.gate === 'run' && Object.keys(plan.guides).length > 0;
  if (changed) {
    console.info('M3: per-medicine limits copied into guides:', plan.writes.map((w) => `${w.type} ${w.value} (from ${w.from.map((f) => f.name).join(', ')})`).join('; '),
      plan.notCopied.length ? `| not copied (at or above the guideline): ${plan.notCopied.map((n) => `${n.name} ${n.limit}`).join(', ')}` : '',
      plan.inert.length ? `| left inert: ${plan.inert.map((n) => `${n.name} ${n.limit}`).join(', ')}` : '');
  }
  return { guides: changed ? plan.guides : guides, changed, plan };
}
