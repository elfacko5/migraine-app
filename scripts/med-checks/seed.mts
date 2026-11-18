// The seeded test library (docs/plan-medication-0b.md, docs/plan-medication-flows.md
// section 1.4). Test data only: not a person's diary, and nothing here comes
// from anyone's backup. Plain data with no import from `src/`, so the same
// file can be read by the working tree and by an extracted base commit.
//
//   tsx scripts/med-checks/seed.mts   writes scripts/med-checks/seed.json,
//                                     the { hd_medications, hd_attacks } pair
//                                     in the stored shapes, for pasting into
//                                     localStorage on a signed-out origin.
//
// Every case the 0b numbers depend on has a name here; `SEED_CASES` is what
// the PR table points at. The library is in the OLD stored shape on purpose:
// no `form`, no `guides`, no `medId` on any entry, so the read-time migrations
// are what get exercised.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const FIXED = Date.parse('2026-11-10T12:00:00Z');

type Rec = Record<string, unknown>;
const med = (id: string, name: string, dose: string, extra: Rec = {}): Rec =>
  ({ id, name, dose, kind: 'acute', createdAt: '2026-01-01T00:00:00Z', unitLabel: 'tablet', ...extra });

export const library: Rec[] = [
  // — the library 0a already used (kept as it was so the old figures still read) —
  med('m1', 'Sumatriptan', '50mg', { strength: '50mg', quantity: 1, class: 'triptan', maxPerDay: 2, minHoursBetween: 2 }),
  med('m2', 'Treo', '1 tablet · 500/50mg', { class: 'combination', maxDaysPerMonth: 8, maxPerDay: 4 }),      // case 1: limit 8, guideline 10
  med('m3', 'Ibuprofen', '400mg', { class: 'simple', maxPerDay: 3, minHoursBetween: 4 }),
  med('m4', 'Rizalief', '200mg', { maxDaysPerMonth: 7 }),                                                      // case 4: untyped (and a limit that has nowhere to go)
  med('m5', 'Nurtec', '75mg', { class: 'gepant', maxDaysPerMonth: 8 }),                                        // case 6: gepant (a limit, but no guide for a gepant)
  med('m6', 'Old thing', '1 tablet', { class: 'other' }),                                                      // case 5: old 'other'
  med('m7', 'Propranolol', '40mg', { kind: 'preventive' }),                                                    // inert
  // — added for the 0b cases —
  med('m8', 'Naproxen', '250mg', { strength: '250mg', class: 'simple', maxDaysPerMonth: 15 }),                 // case 2: limit equals the guideline (15)
  med('m9', 'Rizatriptan', '10mg', { strength: '10mg', class: 'triptan', maxDaysPerMonth: 6 }),                // case 3: two triptans, limits 6 and 9 ->
  med('m10', 'Zolmitriptan', '2.5mg', { strength: '2.5mg', class: 'triptan', maxDaysPerMonth: 9 }),           //         M3 takes the lowest, 6
  med('m11', 'Sumatriptan', '100mg', { strength: '100mg', quantity: 1, class: 'triptan' }),                    // case 7: second Sumatriptan, same type
  med('m12', 'Migraleve', '2 tablets', { class: 'combination' }),                                              // case 8: two old same-name versions,
  med('m13', 'Migraleve', '1 tablet', { class: 'simple' }),                                                    //         different types
  med('m14', 'Imigran', '50mg', { strength: '50mg', class: 'triptan' }),    // case 9: was the stopped one; stop using was dropped (item 214), doses still in the window
  med('m15', 'Diclofenac', '50 mg', { strength: '50 mg', class: 'simple' }),                                   // case 10: library "50 mg" ...
  med('m16', 'Diclofenac', '25 mg', { strength: '25 mg', class: 'simple' }),                                   //          ... old doses stored "50mg"
  med('m17', 'Eletriptan', '40mg', { strength: '40mg', class: 'triptan', maxDaysPerMonth: 12 }),               // case 11: a triptan at 12, ABOVE its guideline, beside lower ones: not copied
  med('m18', 'Aspirin', '500mg', { strength: '500mg', class: 'simple', maxDaysPerMonth: 20 }),                 // case 12: alone in its type and above the guideline (15): no write
];

export const SEED_CASES: Record<string, string> = {
  '1': 'Treo (combination): maxDaysPerMonth 8, guideline 10',
  '2': 'Naproxen (simple): maxDaysPerMonth 15, equals the guideline',
  '3': 'Rizatriptan 6 and Zolmitriptan 9, both triptan: lowest is 6',
  '4': 'Rizalief: untyped (carries a limit of 7 that has nowhere to go)',
  '5': 'Old thing: class "other"',
  '6': 'Nurtec: gepant (carries a limit of 8; guides has no gepant)',
  '7': 'Sumatriptan 50mg and Sumatriptan 100mg: same name, same type',
  '8': 'Migraleve (combination) and Migraleve (simple): same name, different types',
  '9': 'Imigran: stopped 2026-11-08, doses on 5 to 8 Nov (before the stop)',
  '10': 'Diclofenac "50 mg" / "25 mg" in the library; old doses stored "50mg"',
  '11': 'Eletriptan (triptan): maxDaysPerMonth 12, above the guideline, beside Rizatriptan 6 and Zolmitriptan 9: not copied',
  '12': 'Aspirin (simple): maxDaysPerMonth 20, above the guideline 15, the only limit in its type: no write, listed',
};

const day = (d: number, h: number, m = 0) => new Date(FIXED - d * 86400000 + (h - 12) * 3600000 + m * 60000).toISOString();
let id = 1000;
// `medId` is on some doses on purpose: a new dose carries one.
const dose = (name: string, d: number, h: number, amount?: number, medId?: string, text = '') => ({
  time: day(d, h), areas: { 'Temple left': 6 }, symptoms: [], reliefs: [], note: null, source: 'manual',
  medication: { name, dose: text, ...(amount ? { amount } : {}), ...(medId ? { medId } : {}) },
});
const reading = (d: number, h: number, sev: number) => ({
  time: day(d, h), areas: { 'Temple left': sev }, symptoms: [], reliefs: [], medication: null, note: null, source: 'manual',
});
const attack = (snapshots: unknown[], end: string | null = 'x') => ({
  id: id++, snapshots, end: end === 'x' ? (snapshots[snapshots.length - 1] as { time: string }).time : end,
  triggers: [], notificationConfig: { enabled: false, mode: 'adaptive', fixedIntervalMinutes: 60 },
});

export const attacks: unknown[] = [];
// — the diary 0a already used —
for (let d = 1; d <= 8; d++) attacks.push(attack([dose('Sumatriptan', d, 8, 1, d % 2 ? 'm1' : undefined), reading(d, 11, 2)]));   // triptan: 8 days
for (let d = 10; d <= 17; d++) attacks.push(attack([dose('Treo', d, 9, 1, 'm2'), reading(d, 12, 3)]));                              // combination: 8 days
for (let d = 18; d <= 27; d++) attacks.push(attack([dose('Ibuprofen', d, 10, 2), reading(d, 13, 4)]));                             // simple: 10 days (28 and 29 are left free on purpose, see case 8)
for (let d = 2; d <= 9; d++) attacks.push(attack([dose('Rizalief', d, 14), reading(d, 17, 3)]));                                    // untyped: 8 days
for (let d = 20; d <= 24; d++) attacks.push(attack([dose('Nurtec', d, 15), reading(d, 18, 2)]));                                    // gepant
attacks.push(attack([dose('Old thing', 26, 8), reading(26, 11, 3)]));                                                               // legacy 'other'
attacks.push(attack([dose('Typed by hand', 12, 8), reading(12, 11, 3)]));                                                           // in no library entry
attacks.push(attack([dose('a beer', 5, 8), reading(5, 11, 3)]));                                                                    // retired name
for (let d = 40; d <= 75; d += 3) attacks.push(attack([dose('Sumatriptan', d, 8, 1), reading(d, 11, 2)]));                         // older, outside 30 days
// — the 0b cases —
for (let d = 11; d <= 13; d++) attacks.push(attack([dose('Sumatriptan', d, 7, 1, 'm11', '100mg'), reading(d, 10, 3)]));            // case 7: the 100mg version, new doses with its id
for (let d = 14; d <= 16; d++) attacks.push(attack([dose('Migraleve', d, 7), reading(d, 10, 3)]));                                  // case 8: old doses, no id, no dose text
for (let d = 28; d <= 29; d++) attacks.push(attack([dose('Migraleve', d, 7), reading(d, 10, 3)]));                                  // case 8, on days nothing else covers: only Any can show them
for (let d = 5; d <= 8; d++) attacks.push(attack([dose('Imigran', d, 16), reading(d, 19, 3)]));                                     // case 9 (day 9 is left to Rizalief alone, case 4: an untyped-only day)
for (let d = 18; d <= 21; d++) attacks.push(attack([dose('Diclofenac', d, 16, 1, undefined, '50mg'), reading(d, 19, 3)]));         // case 10
for (let d = 1; d <= 4; d++) attacks.push(attack([dose('Naproxen', d, 20, 1, 'm8'), reading(d, 23, 3)]));                          // case 2 doses
for (let d = 22; d <= 25; d++) attacks.push(attack([dose('Rizatriptan', d, 7, 1, 'm9'), reading(d, 10, 3)]));                      // case 3 doses
for (let d = 26; d <= 28; d++) attacks.push(attack([dose('Zolmitriptan', d, 7, 1, 'm10'), reading(d, 10, 3)]));
// An ongoing attack with a dose 40 minutes ago, for Today's dose card.
export const ongoing = attack([reading(0, 6, 7), { ...dose('Sumatriptan', 0, 11, 1, 'm1'), time: new Date(FIXED - 40 * 60000).toISOString() }], null);
attacks.push(ongoing);

/** The stored shapes, old-shape on purpose: no `guides`. */
export const stored = () => ({
  hd_medications: { items: library, updatedAt: '2026-11-01T00:00:00Z' },
  hd_attacks: attacks,
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = path.join(path.dirname(process.argv[1]), 'seed.json');
  writeFileSync(out, JSON.stringify(stored(), null, 2) + '\n');
  console.log(`wrote ${out}`);
}
