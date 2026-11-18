// Checks for 0a of the medication flows: the merge, the sync row, the read-time
// migrations and the dose-resolution rule. No runner exists in this repo, so
// this is a plain script: `npm run med-checks` (tsx + node:assert). It touches
// no network, no localStorage and no account.
import assert from 'node:assert/strict';
import type { Attack, Medication } from '../../src/types/index.ts';
import { cleanDeleted, withDeleted, withoutDeleted, isDeletedName, doseCountOf, cleanGuides, countingOf, daysTakenOf, formOf, isLogged, parseStrength, resolveDose, sameMedicine, sameMedName, withGuide, strengthNeedsCheck, seedFromDose, editMakesDuplicate, otherVersionsWithOtherType, unitForForm, findDuplicate, usualDoseExceedsMax, sharedTypeForName, sameStrengthText, stampMedId, stampSnapshot, typeOfName } from '../../src/utils/medResolve.ts';
import { GUIDELINE, guideFor, guideKeyOf } from '../../src/utils/medGuardrails.ts';
import { classDaysInWindow } from '../../src/utils/stats.ts';
import { M3_MARKER_KEY, markM3Done, planM3, runM3 } from '../../src/utils/medMigrations.ts';
import { deletedForPush, guidesForPush, medicationsUpsertRow, mergeMedicationPrefs, type StoredMedications } from '../../src/utils/medPrefsMerge.ts';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log(`ok  ${name}`); };

const med = (id: string, name: string, dose: string, extra: Partial<Medication> = {}): Medication =>
  ({ id, name, dose, kind: 'acute', createdAt: '2026-01-01T00:00:00Z', ...extra });

// ── merge ──────────────────────────────────────────────────────────────────
const A = med('a', 'Sumatriptan', '50mg');
const local = (updatedAt: string, guides = {}, items = [A]): StoredMedications => ({ items, guides, updatedAt });

t('remote newer, with guides: adopt remote guides', () => {
  const m = mergeMedicationPrefs(local('2026-02-01T00:00:00Z', { triptan: 8 }), {
    medications: [A], medications_updated_at: '2026-03-01T00:00:00Z', medication_guides: { triptan: 12, any: 9 },
  });
  assert.equal(m.kind, 'adopt-remote');
  if (m.kind === 'adopt-remote') {
    assert.deepEqual(m.stored.guides, { triptan: 12, any: 9 });
    assert.equal(m.stored.updatedAt, '2026-03-01T00:00:00Z');
  }
});
t('remote newer, written by an older client (no guides): keep local guides', () => {
  const m = mergeMedicationPrefs(local('2026-02-01T00:00:00Z', { triptan: 8 }), {
    medications: [A], medications_updated_at: '2026-03-01T00:00:00Z',
  });
  assert.equal(m.kind, 'adopt-remote');
  if (m.kind === 'adopt-remote') assert.deepEqual(m.stored.guides, { triptan: 8 });
});
t('remote newer, guides column is junk: cleaned away, local kept', () => {
  const m = mergeMedicationPrefs(local('2026-02-01T00:00:00Z', { simple: 14 }), {
    medications: [A], medications_updated_at: '2026-03-01T00:00:00Z',
    medication_guides: { triptan: -1, foo: 3, any: '10', simple: 0 },
  });
  assert.equal(m.kind, 'adopt-remote');
  if (m.kind === 'adopt-remote') assert.deepEqual(m.stored.guides, { simple: 14 });
});
t('adopt-remote says whether the guides came from the remote (so M3 is not run over a clear)', () => {
  const at = '2026-03-01T00:00:00Z';
  const flag = (g: unknown) => {
    const m = mergeMedicationPrefs(local('2026-02-01T00:00:00Z', { triptan: 8 }), { medications: [A], medications_updated_at: at, ...(g === undefined ? {} : { medication_guides: g }) });
    return m.kind === 'adopt-remote' ? m.guidesFromRemote : 'not adopted';
  };
  assert.equal(flag({}), true);                 // a deliberate clear
  assert.equal(flag({ triptan: 12 }), true);
  assert.equal(flag(undefined), false);         // older client: M3 may still run
  assert.equal(flag({ triptan: -1 }), false);   // junk: local kept, nothing from the remote
});
t('markM3Done sets the marker without running M3', () => {
  const store = new Map<string, string>();
  markM3Done({ setItem: (k: string, v: string) => { store.set(k, v); } });
  assert.equal(store.get(M3_MARKER_KEY), '1');
});
t('local newer: push local', () => {
  const m = mergeMedicationPrefs(local('2026-04-01T00:00:00Z'), { medications: [A], medications_updated_at: '2026-03-01T00:00:00Z' });
  assert.equal(m.kind, 'push-local');
});
t('equal stamps: push local (unchanged behaviour)', () => {
  const m = mergeMedicationPrefs(local('2026-03-01T00:00:00Z'), { medications: [A], medications_updated_at: '2026-03-01T00:00:00Z' });
  assert.equal(m.kind, 'push-local');
});
t('no remote row, local has items: push local', () => {
  assert.equal(mergeMedicationPrefs(local('2026-03-01T00:00:00Z'), null).kind, 'push-local');
});
t('no remote row, empty local: nothing', () => {
  assert.equal(mergeMedicationPrefs(local('1970-01-01T00:00:00.000Z', {}, []), null).kind, 'nothing');
});
t('remote row exists but has no medications, empty local: nothing', () => {
  assert.equal(mergeMedicationPrefs(local('1970-01-01T00:00:00.000Z', {}, []), { medications: null, medications_updated_at: null }).kind, 'nothing');
});
t('remote older: push local, remote guides never read', () => {
  const m = mergeMedicationPrefs(local('2026-04-01T00:00:00Z', { triptan: 8 }), {
    medications: [A], medications_updated_at: '2026-03-01T00:00:00Z', medication_guides: { triptan: 99 },
  });
  assert.equal(m.kind, 'push-local');
});

// ── the row that is pushed ─────────────────────────────────────────────────
t('guidesForPush: empty means omit, never {}', () => {
  assert.equal(guidesForPush({}), undefined);
  assert.deepEqual(guidesForPush({ triptan: 8 }), { triptan: 8 });
});
t('upsert row: no medication_guides column unless guides are given (safe before the alter table)', () => {
  const without = medicationsUpsertRow([A], 'T', 'u', undefined, 'N');
  assert.deepEqual(Object.keys(without).sort(), ['medications', 'medications_updated_at', 'updated_at', 'user_id']);
  const withG = medicationsUpsertRow([A], 'T', 'u', { any: 10 }, 'N');
  assert.deepEqual(withG.medication_guides, { any: 10 });
  assert.equal(withG.medications_updated_at, 'T');
});

// ── M1 / M2, read-time ─────────────────────────────────────────────────────
t('M2: a value with no guides reads as {}', () => {
  assert.deepEqual(cleanGuides(undefined), {});
  assert.deepEqual(cleanGuides(null), {});
  assert.deepEqual(cleanGuides([1, 2]), {});
  assert.deepEqual(cleanGuides({ triptan: 10, gepant: 5, simple: Infinity, any: 'x' }), { triptan: 10 });
});
t('M1: form from unit, stored form wins, nothing is written', () => {
  const old = { unitLabel: 'capsule' };
  assert.equal(formOf({}), 'Tablet');
  assert.equal(formOf({ unitLabel: 'tablet' }), 'Tablet');
  assert.equal(formOf(old), 'Capsule');
  assert.equal(formOf({ unitLabel: 'puff' }), 'Nasal spray');
  assert.equal(formOf({ unitLabel: 'spray' }), 'Nasal spray');
  assert.equal(formOf({ unitLabel: 'injection' }), 'Injection');
  assert.equal(formOf({ unitLabel: ' sachet ' }), 'sachet');
  assert.equal(formOf({ unitLabel: 'tablet', form: 'Melt' }), 'Melt');
  assert.deepEqual(old, { unitLabel: 'capsule' });
});

// ── strength ───────────────────────────────────────────────────────────────
t('parseStrength: one number and one unit only', () => {
  assert.deepEqual(parseStrength('50 mg'), { value: 50, unit: 'mg' });
  assert.deepEqual(parseStrength('50mg'), { value: 50, unit: 'mg' });
  assert.deepEqual(parseStrength('0.5 g'), { value: 0.5, unit: 'g' });
  for (const bad of ['500/50 mg', '100 mg/5 ml', '2 x 25 mg', '', '0 mg', 'mg', '50', null, undefined]) {
    assert.equal(parseStrength(bad), null, String(bad));
  }
});

// ── resolveDose: the Q4 rule ───────────────────────────────────────────────
const s50 = med('s50', 'Sumatriptan', '50 mg', { class: 'triptan' });
const s100 = med('s100', 'Sumatriptan', '100 mg', { class: 'combination' });
const twin1 = med('t1', 'Treo', '1 tablet · 500/50 mg');
const twin2 = med('t2', 'Treo', '1 tablet · 500/50 mg', { class: 'simple' });
const lib = [s50, s100, twin1, twin2, med('i', 'Ibuprofen', '400 mg')];

t('resolveDose 1: medId wins, even against the name', () => {
  assert.equal(resolveDose({ name: 'Sumatriptan', dose: '50 mg', medId: 's100' }, lib).med?.id, 's100');
});
t('resolveDose 1b: an unknown medId + one name match counts under that entry', () => {
  const r = resolveDose({ name: 'Ibuprofen', dose: '', medId: 'not-synced-yet' }, lib);
  assert.deepEqual([r.med?.id, r.ambiguous], ['i', false]);
});
t('resolveDose 1b: an unknown medId + no name match resolves to nothing', () => {
  const r = resolveDose({ name: 'Nope', dose: '', medId: 'deleted' }, lib);
  assert.deepEqual([r.med, r.ambiguous, r.candidates.length], [null, false, 0]);
});
t('resolveDose 1b: an unknown medId + two same-name entries goes to step 3, then ambiguous', () => {
  assert.equal(resolveDose({ name: 'Sumatriptan', dose: '100 mg', medId: 'gone' }, lib).med?.id, 's100');
  const r = resolveDose({ name: 'Sumatriptan', dose: '25 mg', medId: 'gone' }, lib);
  assert.deepEqual([r.med, r.ambiguous], [null, true]);
});
t('resolveDose 2: one entry of that name', () => {
  assert.equal(resolveDose({ name: ' ibuprofen ', dose: '' }, lib).med?.id, 'i');
});
t('resolveDose 3: same name, told apart by dose text', () => {
  assert.equal(resolveDose({ name: 'sumatriptan', dose: '100 mg' }, lib).med?.id, 's100');
  assert.equal(resolveDose({ name: 'Sumatriptan', dose: '50 mg' }, lib).med?.id, 's50');
});
t('resolveDose 4: same name, same dose text, different types is ambiguous and goes to nobody', () => {
  const r = resolveDose({ name: 'Treo', dose: '1 tablet · 500/50 mg' }, lib);
  assert.equal(r.med, null);
  assert.equal(r.ambiguous, true);
  assert.deepEqual(r.candidates.map((c) => c.id), ['t1', 't2']);
});
t('resolveDose 4: same name, dose text matches neither is ambiguous', () => {
  const r = resolveDose({ name: 'Sumatriptan', dose: '25 mg' }, lib);
  assert.equal(r.ambiguous, true);
});
t('resolveDose: unknown or empty name matches nothing and is not ambiguous', () => {
  for (const d of [{ name: 'Nope', dose: '' }, { name: '  ', dose: '' }, null, undefined]) {
    const r = resolveDose(d as never, lib);
    assert.deepEqual([r.med, r.ambiguous, r.candidates.length], [null, false, 0]);
  }
});

// ── stamping: an id is written only when certain ───────────────────────────
t('stampMedId: certain gets an id and keeps its other fields', () => {
  assert.deepEqual(stampMedId({ name: 'Ibuprofen', dose: '400 mg', amount: 2 }, lib), { name: 'Ibuprofen', dose: '400 mg', amount: 2, medId: 'i' });
});
t('stampMedId: ambiguous, typed-in and already-stamped come back unchanged', () => {
  const amb = { name: 'Treo', dose: '1 tablet · 500/50 mg' };
  assert.equal(stampMedId(amb, lib), amb);
  const typed = { name: 'Something else', dose: '' };
  assert.equal(stampMedId(typed, lib), typed);
  const done = { name: 'Ibuprofen', dose: '', medId: 'zzz' };
  assert.equal(stampMedId(done, lib), done);
  assert.equal(stampMedId(null, lib), null);
});
t('stampSnapshot: same object when nothing changes', () => {
  const snap = { time: 'x', medication: null };
  assert.equal(stampSnapshot(snap, lib), snap);
});

// ── in the diary ───────────────────────────────────────────────────────────
const snap = (time: string, name: string, dose: string, medId?: string) => ({
  time, areas: { 'Temple left': 5 }, symptoms: [], reliefs: [], note: null, source: 'manual' as const,
  medication: { name, dose, ...(medId ? { medId } : {}) },
});
const attack = (id: number, snaps: ReturnType<typeof snap>[]): Attack => ({
  id, snapshots: snaps, end: null, triggers: [],
  notificationConfig: { enabled: false, mode: 'adaptive', fixedIntervalMinutes: 60 },
});
const diary = [
  attack(1, [snap('2026-10-01T08:00:00', 'Sumatriptan', '50 mg', 's50'), snap('2026-10-01T20:00:00', 'Sumatriptan', '50 mg', 's50')]),
  attack(2, [snap('2026-10-03T08:00:00', 'Sumatriptan', '100 mg'), snap('2026-10-05T08:00:00', 'Sumatriptan', '50 mg')]),
  attack(3, [snap('2026-10-07T08:00:00', 'Treo', '1 tablet · 500/50 mg')]),
  attack(4, [snap('2026-10-08T08:00:00', 'a beer', '')]),
];
t('daysTakenOf: distinct days, matched doses only, ambiguous counted apart', () => {
  assert.deepEqual(daysTakenOf(s50, lib, diary), { days: 2, ambiguousDoses: 0 }); // 1 Oct (two doses), 5 Oct
  assert.deepEqual(daysTakenOf(s100, lib, diary), { days: 1, ambiguousDoses: 0 }); // 3 Oct
  assert.deepEqual(daysTakenOf(twin1, lib, diary), { days: 0, ambiguousDoses: 1 });
  assert.deepEqual(daysTakenOf(twin2, lib, diary), { days: 0, ambiguousDoses: 1 });
});
t('isLogged: conservative about ambiguous doses; retired names are not doses', () => {
  assert.equal(isLogged(s50, lib, diary), true);
  assert.equal(isLogged(twin1, lib, diary), true);   // could be this one
  assert.equal(isLogged(lib[4], lib, diary), false); // Ibuprofen never logged
  assert.equal(isLogged(med('b', 'A beer', ''), [med('b', 'A beer', '')], diary), false);
});


// ── 0b: step 3 compares strengths with parseStrength ──────────────────────
t('resolveDose 3: "50mg" in the diary matches a library "50 mg"', () => {
  assert.equal(resolveDose({ name: 'Sumatriptan', dose: '50mg' }, lib).med?.id, 's50');
  assert.equal(resolveDose({ name: 'Sumatriptan', dose: '100  mg' }, lib).med?.id, 's100');
});
t('sameStrengthText: parsed → number and unit; unparsed → trimmed text, case ignored; no unit conversion', () => {
  assert.equal(sameStrengthText('50mg', '50 mg'), true);
  assert.equal(sameStrengthText('0.05 g', '50 mg'), false);
  assert.equal(sameStrengthText(' 1 Tablet · 500/50 mg ', '1 tablet · 500/50 mg'), true);
  assert.equal(sameStrengthText('500/50 mg', '500/50mg'), false);
  assert.equal(sameStrengthText('', ''), true);
});

// ── 0b: guideFor / guideKeyOf ─────────────────────────────────────────────
t('guideFor: stored number, else the guideline; junk is ignored', () => {
  assert.equal(guideFor('triptan', { triptan: 6 }), 6);
  assert.equal(guideFor('triptan', {}), 10);
  assert.deepEqual((['triptan', 'combination', 'simple', 'any'] as const).map((k) => guideFor(k, {})), [10, 10, 15, 10]);
  for (const bad of [0, -3, 2.5, NaN, '7' as never, null as never]) assert.equal(guideFor('simple', { simple: bad }), 15);
  assert.equal(GUIDELINE.any, 10);
});
t('guideKeyOf: classes map to themselves, a gepant has none, no class and "other" are Any', () => {
  assert.deepEqual(['triptan', 'combination', 'simple', 'gepant', 'other', undefined].map((c) => guideKeyOf(c as never)),
    ['triptan', 'combination', 'simple', null, 'any', 'any']);
});

// ── 0b: countingOf, typeOfName, classDaysInWindow ─────────────────────────
const cl = [
  med('t', 'Trip', '50 mg', { class: 'triptan' }), med('c', 'Combo', '1', { class: 'combination' }),
  med('p', 'Pain', '1', { class: 'simple' }), med('g', 'Gep', '1', { class: 'gepant' }),
  med('u', 'Unsure', '1'), med('o', 'Old', '1', { class: 'other' }),
  med('d1', 'Dup', '10 mg', { class: 'triptan' }), med('d2', 'Dup', '20 mg', { class: 'triptan' }),
  med('x1', 'Mixed', '10 mg', { class: 'triptan' }), med('x2', 'Mixed', '20 mg', { class: 'simple' }),
  med('y1', 'GepMix', '10 mg', { class: 'gepant' }), med('y2', 'GepMix', '20 mg', { class: 'gepant' }),
  med('z1', 'GepOnly', '10 mg', { class: 'gepant' }), med('z2', 'GepOnly', '20 mg', { class: 'combination' }),
];
const co = (name: string, dose = '', medId?: string) => countingOf({ name, dose, ...(medId ? { medId } : {}) }, cl);
t('countingOf: each class counts in its bar and under Any', () => {
  assert.deepEqual(co('Trip'), { bar: 'triptan', any: true, untyped: false });
  assert.deepEqual(co('Combo'), { bar: 'combination', any: true, untyped: false });
  assert.deepEqual(co('Pain'), { bar: 'simple', any: true, untyped: false });
});
t('countingOf: untyped, "other" and a dose in no library entry count under Any only', () => {
  for (const n of ['Unsure', 'Old', 'Typed by hand']) assert.deepEqual(co(n), { bar: null, any: true, untyped: true });
});
t('countingOf: a gepant is in no bar and not under Any, and is not "untyped"', () => {
  assert.deepEqual(co('Gep'), { bar: null, any: false, untyped: false });
});
t('countingOf: same-name entries of one class count under it (nothing lost)', () => {
  assert.deepEqual(co('Dup', '99 mg'), { bar: 'triptan', any: true, untyped: false });
});
t('countingOf: same-name entries of different classes → no bar, under Any, never the first entry', () => {
  assert.deepEqual(co('Mixed', '99 mg'), { bar: null, any: true, untyped: false });
  assert.deepEqual(co('GepMix', '99 mg'), { bar: null, any: false, untyped: false });   // two gepants: still no Any
  assert.deepEqual(co('GepOnly', '99 mg'), { bar: null, any: true, untyped: false });   // one candidate is not a gepant
});
t('countingOf: a medId picks its entry; an unknown id falls to the name', () => {
  assert.deepEqual(co('Mixed', '', 'x2'), { bar: 'simple', any: true, untyped: false });
  assert.deepEqual(co('Trip', '', 'never-synced'), { bar: 'triptan', any: true, untyped: false });
});
t('typeOfName: shared class, untyped, absent, and null when same-name entries disagree', () => {
  assert.equal(typeOfName('trip', cl), 'triptan');
  assert.equal(typeOfName('Dup', cl), 'triptan');
  assert.equal(typeOfName('Unsure', cl), undefined);
  assert.equal(typeOfName('Old', cl), undefined);
  assert.equal(typeOfName('Nobody', cl), undefined);
  assert.equal(typeOfName('Mixed', cl), null);
});
t('classDaysInWindow: per dose; Any is a union of days (two untyped drugs on one day = one day)', () => {
  const NOW = Date.parse('2026-11-10T12:00:00Z');
  const at = (dayAgo: number, name: string, dose = '', medId?: string) => ({
    time: new Date(NOW - dayAgo * 86400000).toISOString(), areas: {}, symptoms: [], reliefs: [], note: null, source: 'manual' as const,
    medication: { name, dose, ...(medId ? { medId } : {}) },
  });
  const atk = (...snaps: ReturnType<typeof at>[]): Attack => ({ id: 1, snapshots: snaps, end: null, triggers: [], notificationConfig: { enabled: false, mode: 'adaptive', fixedIntervalMinutes: 60 } } as unknown as Attack);
  const r = classDaysInWindow([
    atk(at(1, 'Unsure'), at(1, 'Typed by hand'), at(2, 'Old')),      // 2 untyped days, 3 untyped doses
    atk(at(3, 'Trip'), at(3, 'Pain')),                               // one day in two bars and Any
    atk(at(4, 'Mixed', '99 mg')),                                    // ambiguous types: Any only
    atk(at(5, 'Gep')),                                               // gepant: nothing
    atk(at(40, 'Trip')),                                             // outside the window
    atk(at(6, 'a beer')),                                            // retired
  ], (d) => countingOf(d, cl), 30 * 86400000, NOW);
  assert.deepEqual([r.triptan, r.combination, r.simple, r.any], [1, 0, 1, 4]);
  assert.deepEqual(r.untyped, ['Old', 'Typed by hand', 'Unsure']);
});


// ── 0b: M3 (the rule, and how it is run) ──────────────────────────────────
const lim = (id: string, cls: Medication['class'], limit?: number, extra: Partial<Medication> = {}) =>
  med(id, id, '1', { class: cls, ...(limit ? { maxDaysPerMonth: limit } : {}), ...extra });
const fakeStorage = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), has: (k: string) => m.has(k) };
};
t('M3: only ever lowers a guide — the lowest limit below the guideline is written', () => {
  const p = planM3([lim('a', 'triptan', 6), lim('b', 'triptan', 9), lim('c', 'combination', 8)], {}, false);
  assert.deepEqual(p.guides, { triptan: 6, combination: 8 });
});
t('M3: a limit at or above the guideline writes nothing and is listed', () => {
  const p = planM3([lim('a', 'triptan', 12), lim('b', 'simple', 15), lim('c', 'simple', 20)], {}, false);
  assert.deepEqual(p.guides, {});
  assert.deepEqual(p.notCopied.map((n) => [n.name, n.limit]), [['a', 12], ['b', 15], ['c', 20]]);
});
t('M3: 12 beside 8 → guide 8, the 12 listed; 12 alone → no write, listed', () => {
  const both = planM3([lim('a', 'triptan', 12), lim('b', 'triptan', 8)], {}, false);
  assert.deepEqual([both.guides, both.notCopied.map((n) => n.limit)], [{ triptan: 8 }, [12]]);
  const alone = planM3([lim('a', 'triptan', 12)], {}, false);
  assert.deepEqual([alone.guides, alone.notCopied.length], [{}, 1]);
});
t('M3: gepant and untyped limits are inert and listed; preventives are ignored', () => {
  const p = planM3([lim('g', 'gepant', 4), lim('u', undefined, 3), lim('o', 'other', 3), lim('p', 'triptan', 2, { kind: 'preventive' })], {}, false);
  assert.deepEqual([p.guides, p.inert.map((i) => i.name)], [{}, ['g', 'u', 'o']]);
});
t('M3: an EMPTY library does nothing and sets NO marker; it runs once a medicine exists', () => {
  const st = fakeStorage();
  const r = runM3([], {}, st);
  assert.deepEqual([r.changed, r.plan.gate, st.has(M3_MARKER_KEY)], [false, 'empty-library', false]);
  const later = runM3([lim('a', 'triptan', 6)], {}, st);
  assert.deepEqual([later.changed, later.guides, st.has(M3_MARKER_KEY)], [true, { triptan: 6 }, true]);
});
t('M3: non-empty guides are not run over, and M3 is marked done', () => {
  const st = fakeStorage();
  const r = runM3([lim('a', 'triptan', 6)], { triptan: 9 }, st);
  assert.deepEqual([r.changed, r.guides, r.plan.gate, st.has(M3_MARKER_KEY)], [false, { triptan: 9 }, 'guides-not-empty', true]);
});
t('M3: runs once — the marker stops a second run, and stops a refill after a clear', () => {
  const st = fakeStorage();
  const items = [lim('a', 'triptan', 6)];
  assert.equal(runM3(items, {}, st).changed, true);
  assert.equal(runM3(items, {}, st).changed, false);     // guides were cleared, M3 does not come back
});
t('M3: nothing below a guideline writes nothing but marks M3 done (provided the library was not empty)', () => {
  const st = fakeStorage();
  const r = runM3([lim('a', 'simple', 15)], {}, st);
  assert.deepEqual([r.changed, st.has(M3_MARKER_KEY)], [false, true]);
});

// ── 0b: the merge tells a missing column from an explicit {} ──────────────
const L = (updatedAt: string, guides: Record<string, number>): StoredMedications => ({ items: [A], guides, updatedAt });
const R = (updatedAt: string, guides?: unknown) => ({ medications: [A], medications_updated_at: updatedAt, ...(guides === undefined ? {} : { medication_guides: guides }) });
const guidesAfter = (m: ReturnType<typeof mergeMedicationPrefs>) => (m.kind === 'adopt-remote' ? m.stored.guides : 'not adopted');
t('merge: remote newer with explicit {} and local guides → adopts {} (the clear propagates)', () => {
  assert.deepEqual(guidesAfter(mergeMedicationPrefs(L('2026-02-01T00:00:00Z', { triptan: 6 }), R('2026-03-01T00:00:00Z', {}))), {});
});
t('merge: remote newer with null → keeps local guides', () => {
  assert.deepEqual(guidesAfter(mergeMedicationPrefs(L('2026-02-01T00:00:00Z', { triptan: 6 }), R('2026-03-01T00:00:00Z', null))), { triptan: 6 });
});
t('merge: remote newer with the column absent → keeps local guides', () => {
  assert.deepEqual(guidesAfter(mergeMedicationPrefs(L('2026-02-01T00:00:00Z', { triptan: 6 }), R('2026-03-01T00:00:00Z'))), { triptan: 6 });
});
t('merge: remote newer with a MIXED object (one valid key, one junk) → keeps local guides whole', () => {
  assert.deepEqual(guidesAfter(mergeMedicationPrefs(L('2026-02-01T00:00:00Z', { triptan: 6 }), R('2026-03-01T00:00:00Z', { triptan: 7, any: 'x' }))), { triptan: 6 });
  assert.deepEqual(guidesAfter(mergeMedicationPrefs(L('2026-02-01T00:00:00Z', { triptan: 6 }), R('2026-03-01T00:00:00Z', { triptan: 'abc' }))), { triptan: 6 });
  assert.deepEqual(guidesAfter(mergeMedicationPrefs(L('2026-02-01T00:00:00Z', { triptan: 6 }), R('2026-03-01T00:00:00Z', { triptan: 7, futureKey: 3 }))), { triptan: 6 });
});
t('merge: remote newer { triptan: 7.5 } over local { triptan: 6 } → keeps { triptan: 6 } (a decimal is not a valid guide)', () => {
  assert.deepEqual(guidesAfter(mergeMedicationPrefs(L('2026-02-01T00:00:00Z', { triptan: 6 }), R('2026-03-01T00:00:00Z', { triptan: 7.5 }))), { triptan: 6 });
  assert.deepEqual(cleanGuides({ triptan: 7.5, simple: 12 }), { simple: 12 });
});
t('merge: remote newer with an object whose every key is valid → adopted', () => {
  assert.deepEqual(guidesAfter(mergeMedicationPrefs(L('2026-02-01T00:00:00Z', { triptan: 6 }), R('2026-03-01T00:00:00Z', { triptan: 7, any: 9 }))), { triptan: 7, any: 9 });
});
t('merge: remote newer with a non-object value → treated as missing, keeps local guides', () => {
  assert.deepEqual(guidesAfter(mergeMedicationPrefs(L('2026-02-01T00:00:00Z', { triptan: 6 }), R('2026-03-01T00:00:00Z', 'junk'))), { triptan: 6 });
});
t('push rule: remote older with {} and local guides non-empty → local wins and the push sends the local guides', () => {
  const m = mergeMedicationPrefs(L('2026-03-01T00:00:00Z', { triptan: 6 }), R('2026-02-01T00:00:00Z', {}));
  assert.equal(m.kind, 'push-local');
  if (m.kind === 'push-local') assert.deepEqual(guidesForPush({ triptan: 6 }, m.remoteHadGuides), { triptan: 6 });
});
t('push rule: remote older with {} and local empty → local wins and the column is omitted', () => {
  const m = mergeMedicationPrefs(L('2026-03-01T00:00:00Z', {}), R('2026-02-01T00:00:00Z', {}));
  assert.equal(m.kind, 'push-local');
  if (m.kind === 'push-local') assert.equal(guidesForPush({}, m.remoteHadGuides), undefined);
});
t('push rule: local empty and the remote row last pulled had guides → an explicit {} is sent', () => {
  const m = mergeMedicationPrefs(L('2026-03-01T00:00:00Z', {}), R('2026-02-01T00:00:00Z', { triptan: 6 }));
  assert.equal(m.kind, 'push-local');
  if (m.kind === 'push-local') assert.deepEqual(guidesForPush({}, m.remoteHadGuides), {});
});
t('push rule: a remote row without the column (no alter table, or an older client) never gets one', () => {
  const m = mergeMedicationPrefs(L('2026-03-01T00:00:00Z', {}), R('2026-02-01T00:00:00Z'));
  if (m.kind === 'push-local') assert.equal(guidesForPush({}, m.remoteHadGuides), undefined);
  assert.equal(m.kind, 'push-local');
});
t('push rule: a clear whose push failed is retried by the next sync from the pulled row (same answer twice)', () => {
  const remote = R('2026-02-01T00:00:00Z', { triptan: 6 });
  const first = mergeMedicationPrefs(L('2026-03-01T00:00:00Z', {}), remote);
  const second = mergeMedicationPrefs(L('2026-03-01T00:00:00Z', {}), remote);   // the first push threw; nothing was recorded
  assert.deepEqual(first, second);
  if (second.kind === 'push-local') assert.deepEqual(guidesForPush({}, second.remoteHadGuides), {});
});
t('two devices: A clears and pushes {}; B pulls it, ends with empty guides and does not push its old ones back', () => {
  // A (guides cleared, newer) → remote row after A's push
  const remoteAfterA = { medications: [A], medications_updated_at: '2026-03-01T00:00:00Z', medication_guides: guidesForPush({}, true) };
  assert.deepEqual(remoteAfterA.medication_guides, {});
  // B still holds the old guides under the older stamp
  const b = mergeMedicationPrefs(L('2026-02-01T00:00:00Z', { triptan: 6 }), remoteAfterA);
  assert.equal(b.kind, 'adopt-remote');                       // adopts, so no push of its own
  assert.deepEqual(guidesAfter(b), {});
  // and a sync straight after, from B's now-adopted state, sends nothing new
  const again = mergeMedicationPrefs({ items: [A], guides: {}, updatedAt: '2026-03-01T00:00:00Z' }, remoteAfterA);
  assert.equal(again.kind, 'push-local');
  if (again.kind === 'push-local') assert.equal(guidesForPush({}, again.remoteHadGuides), undefined);
});

// ── add wizard (commit 1) ──────────────────────────────────────────────────
const S50 = med('s1', 'Sumatriptan', '50mg', { strength: '50mg', form: 'Tablet', class: 'triptan' });
t('sameMedicine: name case and spaces, "50 mg" vs "50mg" are the same', () => {
  assert.equal(sameMedicine({ name: ' sumatriptan ', strength: '50 mg', form: 'Tablet', dose: '' }, S50), true);
});
t('sameMedicine: a different form or a different strength is a different medicine', () => {
  assert.equal(sameMedicine({ name: 'Sumatriptan', strength: '50mg', form: 'Nasal spray', dose: '' }, S50), false);
  assert.equal(sameMedicine({ name: 'Sumatriptan', strength: '100mg', form: 'Tablet', dose: '' }, S50), false);
  assert.equal(sameMedicine({ name: 'Rizatriptan', strength: '50mg', form: 'Tablet', dose: '' }, S50), false);
});
t('sameMedicine: an old record with no stored form compares as its derived form, strength from dose', () => {
  const old = med('o', 'Treo', '500mg', { unitLabel: 'tablet' });
  assert.equal(sameMedicine({ name: 'treo', strength: '500 mg', form: 'Tablet', dose: '' }, old), true);
  assert.equal(sameMedicine({ name: 'treo', strength: '500 mg', form: 'Capsule', dose: '' }, old), false);
});
t('sameMedicine: an empty name is never a duplicate', () => {
  assert.equal(sameMedicine({ name: '  ', strength: '50mg', form: 'Tablet', dose: '' }, med('e', '', '50mg')), false);
});
t('names compare with doubled inner spaces collapsed', () => {
  assert.equal(sameMedName('Sumatriptan  succinate', ' sumatriptan succinate '), true);
  assert.equal(sameMedicine({ name: 'Sumatriptan  succinate', strength: '50mg', form: 'Tablet', dose: '' }, med('x', 'sumatriptan succinate', '50mg', { form: 'Tablet' })), true);
  assert.equal(sameMedName('', ' '), false);
});
t('withGuide sets, replaces and clears a type, never mutating, and refuses junk', () => {
  const g = { triptan: 8 };
  assert.deepEqual(withGuide(g, 'simple', 12), { triptan: 8, simple: 12 });
  assert.deepEqual(withGuide(g, 'triptan', 9), { triptan: 9 });
  assert.deepEqual(withGuide(g, 'triptan', undefined), {});
  assert.deepEqual(withGuide(g, 'triptan', 0), {});
  assert.deepEqual(withGuide(g, 'triptan', 2.5), {});
  assert.deepEqual(g, { triptan: 8 });
});
t('strengthNeedsCheck: only when the form moves to another way of taking it', () => {
  assert.equal(strengthNeedsCheck('Tablet', 'Melt'), false);
  assert.equal(strengthNeedsCheck('Tablet', 'Capsule'), false);
  assert.equal(strengthNeedsCheck('Tablet', 'Liquid'), false);
  assert.equal(strengthNeedsCheck('Tablet', 'Nasal spray'), true);
  assert.equal(strengthNeedsCheck('Nasal spray', 'Injection'), true);
  assert.equal(strengthNeedsCheck('Tablet', 'Sachet'), true);
  assert.equal(strengthNeedsCheck('sachet', 'Sachet'), false);
});
t('seedFromDose: strength and quantity from an old derived dose, never invented', () => {
  assert.deepEqual(seedFromDose('400mg'), { strength: '400mg' });
  assert.deepEqual(seedFromDose('1 tablet · 500/50mg'), { strength: '500/50mg', quantity: 1 });
  assert.deepEqual(seedFromDose('2 tablets'), { strength: '', quantity: 2 });
  assert.deepEqual(seedFromDose('2 tablets · 50mg'), { strength: '50mg', quantity: 2 });
  assert.deepEqual(seedFromDose('50 mg'), { strength: '50 mg' });
  assert.deepEqual(seedFromDose(''), { strength: '' });
});
t('editMakesDuplicate: an old record with no strength compares on its dose text', () => {
  const m12 = med('m12', 'Migraleve', '2 tablets');
  const m13 = med('m13', 'Migraleve', '1 tablet');
  // editing m12 but leaving its dose as it is: still not m13
  assert.equal(editMakesDuplicate(m12, { name: 'Migraleve', form: 'Tablet', strength: undefined, dose: '2 tablets' }, [m12, m13]), null);
  // rewriting its dose to "1 tablet" would make it m13's twin
  assert.equal(editMakesDuplicate(m12, { name: 'Migraleve', form: 'Tablet', strength: undefined, dose: '1 tablet' }, [m12, m13])?.id, 'm13');
});
t('unitForForm: standard forms write their unit, an own form writes "dose"', () => {
  assert.equal(unitForForm('Nasal spray'), 'spray');
  assert.equal(unitForForm('Capsule'), 'capsule');
  assert.equal(unitForForm('Sachet'), 'dose');
});
t('editMakesDuplicate: a new twin is caught, an existing pair is never trapped', () => {
  const a = med('a', 'Treo', '500mg', { strength: '500mg', form: 'Tablet' });
  const b = med('b', 'Treo', '500mg', { strength: '500mg', form: 'Tablet' });   // an old exact twin
  const c = med('c', 'Treo', '250mg', { strength: '250mg', form: 'Tablet' });
  // editing c to 500mg would make it a twin of a and b
  assert.equal(editMakesDuplicate(c, { name: 'Treo', form: 'Tablet', strength: '500 mg' }, [a, b, c])?.id, 'a');
  // a and b already match each other: editing a without changing that is allowed
  assert.equal(editMakesDuplicate(a, { name: 'Treo', form: 'Tablet', strength: '500mg' }, [a, b, c]), null);
  // changing c to something unique is fine
  assert.equal(editMakesDuplicate(c, { name: 'Treo', form: 'Tablet', strength: '100mg' }, [a, b, c]), null);
});
t('otherVersionsWithOtherType: same-name entries of another type, this one excluded', () => {
  const a = med('a', 'Sumatriptan', '50mg', { class: 'triptan' });
  const b = med('b', 'sumatriptan', '100mg', { class: 'triptan' });
  const c = med('c', 'Sumatriptan', '25mg');
  assert.deepEqual(otherVersionsWithOtherType(a, 'simple', [a, b, c]).map((m) => m.id), ['b', 'c']);
  assert.deepEqual(otherVersionsWithOtherType(a, 'triptan', [a, b, c]).map((m) => m.id), ['c']);
  assert.deepEqual(otherVersionsWithOtherType(a, undefined, [a, b, c]).map((m) => m.id), ['b']);
});
t('findDuplicate returns the matching entry, else null', () => {
  assert.equal(findDuplicate({ name: 'Sumatriptan', strength: '50mg', form: 'Tablet', dose: '' }, [med('x', 'Other', '1mg'), S50])?.id, 's1');
  assert.equal(findDuplicate({ name: 'Sumatriptan', strength: '25mg', form: 'Tablet', dose: '' }, [S50]), null);
});
t('usualDoseExceedsMax: only when both are set and the dose is larger', () => {
  assert.equal(usualDoseExceedsMax(3, 2), true);
  assert.equal(usualDoseExceedsMax(2, 2), false);
  assert.equal(usualDoseExceedsMax(2, undefined), false);
  assert.equal(usualDoseExceedsMax(undefined, 2), false);
  assert.equal(usualDoseExceedsMax(1, 0), false);
});
t('sharedTypeForName: the shared class, nothing when entries disagree or none exist', () => {
  const S100 = med('s2', 'Sumatriptan', '100mg', { class: 'triptan' });
  assert.equal(sharedTypeForName('sumatriptan', [S50, S100]), 'triptan');
  assert.equal(sharedTypeForName('Sumatriptan', [S50, med('s3', 'Sumatriptan', '25mg', { class: 'simple' })]), undefined);
  assert.equal(sharedTypeForName('Nurofen', [S50]), undefined);
  assert.equal(sharedTypeForName('Sumatriptan', [med('s4', 'Sumatriptan', '50mg')]), undefined);
});

// ── deleted names (commit 4) ───────────────────────────────────────────────
const DEL = (name: string) => ({ name, deletedAt: '2026-11-18T10:00:00Z' });
t('cleanDeleted: junk dropped, one entry per name, names trimmed', () => {
  assert.deepEqual(cleanDeleted([DEL(' Sumatriptan '), DEL('sumatriptan'), { name: '', deletedAt: 'x' }, { name: 'Treo' }, 7, null]), [DEL('Sumatriptan')]);
  assert.deepEqual(cleanDeleted('nope'), []);
  assert.deepEqual(cleanDeleted(undefined), []);
});
t('withDeleted adds once; withoutDeleted removes and returns the same array when absent', () => {
  const d = withDeleted([], 'Sumatriptan', '2026-11-18T10:00:00Z');
  assert.equal(d.length, 1);
  assert.equal(withDeleted(d, ' sumatriptan ', 'later'), d);
  assert.deepEqual(withoutDeleted(d, 'SUMATRIPTAN'), []);
  assert.equal(withoutDeleted(d, 'Treo'), d);
});
t('isDeletedName: deleted and in no entry only; an entry wins; a typed-in name was never deleted', () => {
  const lib = [med('t', 'Treo', '500mg')];
  assert.equal(isDeletedName('Sumatriptan', lib, [DEL('Sumatriptan')]), true);
  assert.equal(isDeletedName('Treo', lib, [DEL('Treo')]), false);
  assert.equal(isDeletedName('Ibuprofen', lib, [DEL('Sumatriptan')]), false);
});
t('countingOf: a deleted name counts nowhere; a typed-in name never in the library still counts under Any', () => {
  const lib = [med('t', 'Treo', '500mg', { class: 'combination' })];
  assert.deepEqual(countingOf({ name: 'Sumatriptan', dose: '50mg' }, lib, [DEL('Sumatriptan')]), { bar: null, any: false, untyped: false });
  assert.deepEqual(countingOf({ name: 'Ibuprofen', dose: '400mg' }, lib, [DEL('Sumatriptan')]), { bar: null, any: true, untyped: true });
  // added again: it has an entry, so it counts under its class
  const again = [med('s', 'Sumatriptan', '50mg', { class: 'triptan' })];
  assert.deepEqual(countingOf({ name: 'Sumatriptan', dose: '50mg' }, again, [DEL('Sumatriptan')]), { bar: 'triptan', any: true, untyped: false });
});
t('doseCountOf: the doses that belong to this medicine alone', () => {
  const a1 = med('a', 'Treo', '500mg'); const a2 = med('b', 'Treo', '250mg');
  const snap = (time: string, dose: string, medId?: string) => ({ time, areas: {}, symptoms: [], reliefs: [], medication: { name: 'Treo', dose, ...(medId ? { medId } : {}) }, note: null, source: 'manual' as const });
  const attacks = [{ id: 1, end: null, triggers: [], notificationConfig: { enabled: false, interval: 60 }, snapshots: [snap('2026-11-01T08:00:00Z', '500mg'), snap('2026-11-02T08:00:00Z', '250mg'), snap('2026-11-03T08:00:00Z', '1 tablet', 'b')] }] as unknown as Attack[];
  assert.equal(doseCountOf(a1, [a1, a2], attacks), 1);
  assert.equal(doseCountOf(a2, [a1, a2], attacks), 2);
});
t('merge: remote deleted names are adopted when newer, a clear included; junk or missing keeps local', () => {
  const at = '2026-03-01T00:00:00Z';
  const base = (d?: unknown) => mergeMedicationPrefs({ items: [A], guides: {}, deleted: [DEL('Old')], updatedAt: '2026-02-01T00:00:00Z' }, { medications: [A], medications_updated_at: at, ...(d === undefined ? {} : { medication_deleted: d }) });
  const names = (m: ReturnType<typeof base>) => (m.kind === 'adopt-remote' ? (m.stored.deleted ?? []).map((x) => x.name) : 'not adopted');
  assert.deepEqual(names(base([DEL('Sumatriptan')])), ['Sumatriptan']);
  assert.deepEqual(names(base([])), []);                 // a clear (a re-add on the other device)
  assert.deepEqual(names(base(undefined)), ['Old']);     // an older client: keep local
  assert.deepEqual(names(base([DEL('X'), { name: 7 }])), ['Old']);   // junk entry: keep local whole
  assert.deepEqual(names(base('nope')), ['Old']);
  const flag = (d?: unknown) => { const m = base(d); return m.kind === 'adopt-remote' ? m.deletedFromRemote : 'not adopted'; };
  assert.equal(flag([]), true); assert.equal(flag(undefined), false); assert.equal(flag([{ name: 7 }]), false);
});
t('push rule for deleted names: send when there are some, an explicit [] only to clear what the remote held, else omit', () => {
  assert.deepEqual(deletedForPush([DEL('Sumatriptan')], false), [DEL('Sumatriptan')]);
  assert.deepEqual(deletedForPush([], true), []);
  assert.equal(deletedForPush([], false), undefined);
  const row = medicationsUpsertRow([A], '2026-03-01T00:00:00Z', 'u', undefined, 'now', deletedForPush([], false));
  assert.equal('medication_deleted' in row, false);
  assert.deepEqual((medicationsUpsertRow([A], '2026-03-01T00:00:00Z', 'u', undefined, 'now', [DEL('Sumatriptan')]) as Record<string, unknown>).medication_deleted, [DEL('Sumatriptan')]);
  const m = mergeMedicationPrefs({ items: [A], guides: {}, updatedAt: '2026-03-01T00:00:00Z' }, { medications: [A], medications_updated_at: '2026-02-01T00:00:00Z', medication_deleted: [DEL('Sumatriptan')] });
  assert.equal(m.kind === 'push-local' && m.remoteHadDeleted, true);
});

console.log(`\n${n} checks passed`);
