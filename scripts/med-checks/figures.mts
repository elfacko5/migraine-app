// Prints every Today and Insights figure that depends on the medication
// library, for a fixed library, a fixed diary and a fixed clock, as plain
// text. `diff-figures.sh` runs it against the base commit and the working tree
// and diffs the two: 0a must produce an empty diff.
//
// ROOT is the tree to read from (default: this repo). Nothing here touches
// localStorage, the network or any account.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const FIXED = Date.parse('2026-11-10T12:00:00Z');
const RealDate = Date;
class FixedDate extends RealDate {
  constructor(...a: unknown[]) { super(...(a.length === 0 ? [FIXED] : a) as [number]); }
  static now() { return FIXED; }
}
(globalThis as { Date: unknown }).Date = FixedDate;

const root = path.resolve(process.env.ROOT ?? path.join(import.meta.dirname, '../..'));
const load = (p: string) => import(pathToFileURL(path.join(root, 'src', p)).href);

const stats = await load('utils/stats.ts');
const guard = await load('utils/medGuardrails.ts');
const { TodaySummary } = await load('components/TodaySummary.tsx');
const { MedicationInsights } = await load('components/MedicationInsights.tsx');

type Med = Record<string, unknown>;
const med = (id: string, name: string, dose: string, extra: Med = {}): Med =>
  ({ id, name, dose, kind: 'acute', createdAt: '2026-01-01T00:00:00Z', unitLabel: 'tablet', ...extra });

// A library that exercises every branch the 0b change will touch: each class, a
// drug's own label limit (Treo), a gepant, an untyped drug, a stopped-looking
// legacy 'other', and a preventive that must stay inert.
const library: Med[] = [
  med('m1', 'Sumatriptan', '50mg', { strength: '50mg', quantity: 1, class: 'triptan', maxPerDay: 2, minHoursBetween: 2 }),
  med('m2', 'Treo', '1 tablet · 500/50mg', { class: 'combination', maxDaysPerMonth: 8, maxPerDay: 4 }),
  med('m3', 'Ibuprofen', '400mg', { class: 'simple', maxPerDay: 3, minHoursBetween: 4 }),
  med('m4', 'Rizalief', '200mg'),
  med('m5', 'Nurtec', '75mg', { class: 'gepant' }),
  med('m6', 'Old thing', '1 tablet', { class: 'other' }),
  med('m7', 'Propranolol', '40mg', { kind: 'preventive' }),
];

const day = (d: number, h: number, m = 0) => new RealDate(FIXED - d * 86400000 + (h - 12) * 3600000 + m * 60000).toISOString();
let id = 1000;
// medId is attached to some doses on purpose: a new dose carries one, and
// nothing in 0a may read it.
const dose = (name: string, d: number, h: number, amount?: number, medId?: string) => ({
  time: day(d, h), areas: { 'Temple left': 6 }, symptoms: [], reliefs: [], note: null, source: 'manual',
  medication: { name, dose: '', ...(amount ? { amount } : {}), ...(medId ? { medId } : {}) },
});
const reading = (d: number, h: number, sev: number) => ({
  time: day(d, h), areas: { 'Temple left': sev }, symptoms: [], reliefs: [], medication: null, note: null, source: 'manual',
});
const attack = (snapshots: unknown[], end: string | null = 'x') => ({
  id: id++, snapshots, end: end === 'x' ? (snapshots[snapshots.length - 1] as { time: string }).time : end,
  triggers: [], notificationConfig: { enabled: false, mode: 'adaptive', fixedIntervalMinutes: 60 },
});

const attacks: unknown[] = [];
for (let d = 1; d <= 8; d++) attacks.push(attack([dose('Sumatriptan', d, 8, 1, d % 2 ? 'm1' : undefined), reading(d, 11, 2)]));      // triptan: 8 days (past 70% of 10)
for (let d = 10; d <= 17; d++) attacks.push(attack([dose('Treo', d, 9, 1, 'm2'), reading(d, 12, 3)]));                                 // combination: 8 days, own limit 8
for (let d = 18; d <= 29; d++) attacks.push(attack([dose('Ibuprofen', d, 10, 2), reading(d, 13, 4)]));                                // simple: 12 days
for (let d = 2; d <= 9; d++) attacks.push(attack([dose('Rizalief', d, 14), reading(d, 17, 3)]));                                       // untyped: 8 days
for (let d = 20; d <= 24; d++) attacks.push(attack([dose('Nurtec', d, 15), reading(d, 18, 2)]));                                       // gepant
attacks.push(attack([dose('Old thing', 26, 8), reading(26, 11, 3)]));                                                                  // legacy 'other'
attacks.push(attack([dose('Typed by hand', 12, 8), reading(12, 11, 3)]));                                                              // not in the library
attacks.push(attack([dose('a beer', 5, 8), reading(5, 11, 3)]));                                                                       // retired name
// Older doses, outside 30 days, for Insights' longer windows.
for (let d = 40; d <= 75; d += 3) attacks.push(attack([dose('Sumatriptan', d, 8, 1), reading(d, 11, 2)]));
// An ongoing attack with a dose 40 minutes ago, for Today's dose card.
const ongoing = attack([reading(0, 6, 7), { ...dose('Sumatriptan', 0, 11, 1, 'm1'), time: new RealDate(FIXED - 40 * 60000).toISOString() }], null);
attacks.push(ongoing);

const out: string[] = [];
const show = (title: string, v: unknown) => out.push(`## ${title}\n${typeof v === 'string' ? v : JSON.stringify(v, null, 1)}`);

const classOf = (name: string) => (library.find((m) => String(m.name).toLowerCase() === name.trim().toLowerCase()) as { class?: string } | undefined)?.class;
show('migraine days / attacks, last 30 days', [stats.migraineDaysInWindow(attacks), stats.attacksInWindow(attacks)]);
show('classDaysInWindow', stats.classDaysInWindow(attacks, classOf));
show('medicationDaysLastWindow', stats.medicationDaysLastWindow(attacks));
for (const w of [7, 30, 90]) show(`medicationDaysInWindow ${w}d`, stats.medicationDaysInWindow(attacks, FIXED - w * 86400000));
show('medicationDaysByMonth', stats.medicationDaysByMonth(attacks, FIXED));
show('medicationResponse 30d', stats.medicationResponse(attacks, FIXED - 30 * 86400000));
show('medicationFrequency', stats.medicationFrequency(attacks));
show('mohDaysFor each', library.map((m) => [m.name, guard.mohDaysFor(String(m.name), library)]));
show('mohDaysFor unknown names', ['Typed by hand', 'nothing'].map((n) => [n, guard.mohDaysFor(n, library)]));
show('checkDose (1 unit, now) each', library.map((m) => [m.name, guard.checkDose(m, attacks, String(m.name), 1)]));
show('unitsInWindow each', library.map((m) => [m.name, guard.unitsInWindow(attacks, String(m.name))]));
show('lastDoseAt each', library.map((m) => [m.name, guard.lastDoseAt(attacks, String(m.name))]));
show('findMedication ids', ['Sumatriptan', 'treo', 'Rizalief', 'Typed by hand'].map((n) => [n, (guard.findMedication(library, n) as { id?: string } | null)?.id ?? null]));
show('doseUnits of doses with and without medId', [guard.doseUnits({ dose: '', amount: 2, medId: 'm1' }), guard.doseUnits({ dose: '2 tablets' })]);

const html = (el: unknown) => renderToStaticMarkup(el as never).replace(/></g, '>\n<');
for (const attackMode of [false, true]) {
  show(`TodaySummary attackMode=${attackMode} (ongoing)`, html(createElement(TodaySummary, { attacks, ongoing, medications: library, attackMode })));
  show(`TodaySummary attackMode=${attackMode} (none ongoing)`, html(createElement(TodaySummary, { attacks, ongoing: null, medications: library, attackMode })));
}
show('MedicationInsights 30d', html(createElement(MedicationInsights, { attacks, medications: library, since: FIXED - 30 * 86400000, windowLabel: 'the last 30 days', monthScale: true })));
show('MedicationInsights 7d', html(createElement(MedicationInsights, { attacks, medications: library, since: FIXED - 7 * 86400000, windowLabel: 'the last 7 days', monthScale: true })));
show('MedicationInsights all time', html(createElement(MedicationInsights, { attacks, medications: library, since: null, windowLabel: 'all time', monthScale: false })));
console.log(out.join('\n\n'));
