// Prints every Today and Insights figure that depends on the medication
// library, for a fixed library, a fixed diary and a fixed clock, as plain
// text. The library and diary come from `seed.mts`. `diff-figures.sh` runs it
// against a base commit and the working tree and diffs the two.
//
// ROOT is the tree to read from (default: this repo). Nothing here touches
// localStorage, the network or any account.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { FIXED, library, attacks, ongoing } from './seed.mts';

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
// 0b: the tree being read may or may not have guides, M3 and per-dose counting
// (the base tree does not), so both shapes are handled and the section titles
// stay the same, which is what lets the diff line them up.
const resolve = await load('utils/medResolve.ts');
const mig = await load('utils/medMigrations.ts').catch(() => null);
const hasGuides = typeof guard.guideForName === 'function';
// The guides the app would hold after M3 ran on this library (none before 0b).
const guides = mig ? mig.planM3(library, {}, false).guides : {};

const out: string[] = [];
const show = (title: string, v: unknown) => out.push(`## ${title}\n${typeof v === 'string' ? v : JSON.stringify(v, null, 1)}`);

const classOf = (name: string) => (library.find((m) => String(m.name).toLowerCase() === name.trim().toLowerCase()) as { class?: string } | undefined)?.class;
show('migraine days / attacks, last 30 days', [stats.migraineDaysInWindow(attacks), stats.attacksInWindow(attacks)]);
show('guides in force (after M3)', guides);
show('classDaysInWindow', hasGuides ? stats.classDaysInWindow(attacks, (d: unknown) => resolve.countingOf(d, library)) : stats.classDaysInWindow(attacks, classOf));
show('medicationDaysLastWindow', stats.medicationDaysLastWindow(attacks));
for (const w of [7, 30, 90]) show(`medicationDaysInWindow ${w}d`, stats.medicationDaysInWindow(attacks, FIXED - w * 86400000));
show('medicationDaysByMonth', stats.medicationDaysByMonth(attacks, FIXED));
show('medicationResponse 30d', stats.medicationResponse(attacks, FIXED - 30 * 86400000));
show('medicationFrequency', stats.medicationFrequency(attacks));
const limitOf = (n: string) => (hasGuides ? guard.guideForName(n, library, guides) : guard.mohDaysFor(n, library));
show('days-a-month limit for each name', library.map((m) => [m.name, limitOf(String(m.name))]));
show('days-a-month limit for unknown names', ['Typed by hand', 'nothing'].map((n) => [n, limitOf(n)]));
show('checkDose (1 unit, now) each', library.map((m) => [m.name, guard.checkDose(m, attacks, String(m.name), 1)]));
show('unitsInWindow each', library.map((m) => [m.name, guard.unitsInWindow(attacks, String(m.name))]));
show('lastDoseAt each', library.map((m) => [m.name, guard.lastDoseAt(attacks, String(m.name))]));
show('findMedication ids', ['Sumatriptan', 'treo', 'Rizalief', 'Typed by hand'].map((n) => [n, (guard.findMedication(library, n) as { id?: string } | null)?.id ?? null]));
show('doseUnits of doses with and without medId', [guard.doseUnits({ dose: '', amount: 2, medId: 'm1' }), guard.doseUnits({ dose: '2 tablets' })]);

const html = (el: unknown) => renderToStaticMarkup(el as never).replace(/></g, '>\n<');
for (const attackMode of [false, true]) {
  show(`TodaySummary attackMode=${attackMode} (ongoing)`, html(createElement(TodaySummary, { attacks, ongoing, medications: library, guides, attackMode })));
  show(`TodaySummary attackMode=${attackMode} (none ongoing)`, html(createElement(TodaySummary, { attacks, ongoing: null, medications: library, guides, attackMode })));
}
show('MedicationInsights 30d', html(createElement(MedicationInsights, { attacks, medications: library, guides, since: FIXED - 30 * 86400000, windowLabel: 'the last 30 days', monthScale: true })));
show('MedicationInsights 7d', html(createElement(MedicationInsights, { attacks, medications: library, guides, since: FIXED - 7 * 86400000, windowLabel: 'the last 7 days', monthScale: true })));
show('MedicationInsights all time', html(createElement(MedicationInsights, { attacks, medications: library, guides, since: null, windowLabel: 'all time', monthScale: false })));
console.log(out.join('\n\n'));
